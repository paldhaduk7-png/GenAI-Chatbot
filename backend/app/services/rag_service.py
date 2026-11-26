"""
Reusable RAG (Retrieval-Augmented Generation) Service for Phase 4 Step 6.
Constructs an end-to-end LangChain Runnable (LCEL) pipeline:
User Question
    │
    ▼
Generate Question Embedding (embedding_service)
    │
    ▼
Vector Similarity Search (retrieval_service on Neon pgvector)
    │
    ▼
Retrieve Top 5 Chunks (user ownership & doc filtering)
    │
    ▼
Build Document Context & Source References
    │
    ▼
ChatPromptTemplate (rag_prompts)
    │
    ▼
LangChain Runnable Chain (|)
    │
    ▼
Existing LLM Service Adapter (Mistral primary -> Gemini fallback)
    │
    ▼
Answer + Preserved Source Metadata (RAGResponse)
"""
import logging
from typing import Any, Dict, List, Optional, Tuple, Union

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import (
    Runnable,
    RunnableLambda,
    RunnablePassthrough,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Document
from app.schemas.chat import ChatResponse, Message
from app.schemas.chunk import RetrievedChunk
from app.schemas.rag import RAGResponse, RAGSource
from app.services.embedding_service import generate_embedding
from app.services.llm_service import generate_chat_response
from app.services.rag_prompts import get_rag_prompt_template
from app.services.retrieval_service import search_similar_chunks

logger = logging.getLogger(__name__)

# Default retrieval parameters
DEFAULT_TOP_K = 5
MAX_HISTORY_TURNS = 6  # Last 3 user + 3 assistant turns


def retrieve_context_and_sources(
    db: Session,
    user_id: str,
    question: str,
    document_id: Optional[str] = None,
    top_k: int = DEFAULT_TOP_K,
) -> Dict[str, Any]:
    """
    Step 3 & Step 6: Embed user question, retrieve nearest chunks via existing
    retrieval service, query document filenames, and format context and source citations.

    Enforces:
    - User ownership: only documents owned by user_id are returned.
    - Optional document_id filter.
    - Top-k chunk limit.
    - Graceful handling of empty retrieval results.
    - Deduplication of source citations.

    Returns:
        Dict with keys:
            - context: str (formatted document text for prompt)
            - sources: List[RAGSource] (preserved citation metadata)
            - has_sufficient_context: bool (True if at least one chunk retrieved)
    """
    clean_question = (question or "").strip()
    if not clean_question:
        raise ValueError("User question cannot be empty.")
    if not user_id:
        raise ValueError("user_id cannot be empty.")

    # 1. Generate question embedding using existing embedding service
    query_embedding = generate_embedding(clean_question)

    # 2. Vector search using existing retrieval service (Neon pgvector)
    retrieved_chunks: List[RetrievedChunk] = search_similar_chunks(
        db=db,
        user_id=user_id,
        query_embedding=query_embedding,
        document_id=document_id,
        top_k=top_k,
    )

    if not retrieved_chunks:
        logger.info("RAG retrieval returned 0 chunks for user %s.", user_id)
        return {
            "context": "NO RELEVANT DOCUMENT CONTEXT FOUND.",
            "sources": [],
            "has_sufficient_context": False,
        }

    # 3. Resolve document filenames for preserved source metadata
    # Optimization: Use document_filename directly from the retrieval join.
    # Only execute a secondary query if any chunk lacks document_filename.
    doc_map: Dict[str, str] = {}
    missing_doc_ids = list({
        chunk.document_id
        for chunk in retrieved_chunks
        if not getattr(chunk, "document_filename", None)
    })
    if missing_doc_ids:
        try:
            doc_stmt = select(Document.id, Document.filename).where(
                Document.id.in_(missing_doc_ids),
                Document.user_id == user_id,
            )
            doc_rows = db.execute(doc_stmt).all()
            doc_map = {row[0]: row[1] for row in doc_rows}
        except Exception as exc:
            logger.warning("Could not resolve document filenames from db: %s", exc)

    # 4. Build deduplicated sources list
    sources: List[RAGSource] = []
    seen_chunks = set()
    for chunk in retrieved_chunks:
        if chunk.chunk_id in seen_chunks:
            continue
        seen_chunks.add(chunk.chunk_id)

        doc_name = (
            getattr(chunk, "document_filename", None)
            or doc_map.get(chunk.document_id)
            or f"document_{chunk.document_id[:8]}.pdf"
        )
        sources.append(
            RAGSource(
                document_id=chunk.document_id,
                document_filename=doc_name,
                page_number=chunk.page_number,
                chunk_id=chunk.chunk_id,
                similarity_score=chunk.similarity_score,
            )
        )

    # 5. Build structured document context string
    context_blocks: List[str] = []
    for idx, chunk in enumerate(retrieved_chunks, start=1):
        doc_name = (
            doc_map.get(chunk.document_id)
            or getattr(chunk, "document_filename", None)
            or f"document_{chunk.document_id[:8]}.pdf"
        )
        page_label = f", Page {chunk.page_number}" if chunk.page_number is not None else ""
        header = f"[Source {idx}: {doc_name}{page_label}]"
        context_blocks.append(f"{header}\n{chunk.content.strip()}")

    formatted_context = "\n\n".join(context_blocks)
    return {
        "context": formatted_context,
        "sources": sources,
        "has_sufficient_context": True,
    }


def prepare_chat_history(
    history: Optional[List[Union[Message, dict, BaseMessage]]] = None,
    max_turns: int = MAX_HISTORY_TURNS,
) -> List[BaseMessage]:
    """
    Step 7: Format and truncate conversation history into LangChain BaseMessage objects.
    Preserves recent turns for conversational continuity without overwhelming prompt tokens.
    """
    if not history:
        return []

    recent_history = history[-max_turns:]
    langchain_messages: List[BaseMessage] = []

    for item in recent_history:
        if isinstance(item, BaseMessage):
            langchain_messages.append(item)
        elif isinstance(item, Message):
            if item.role == "user":
                langchain_messages.append(HumanMessage(content=item.content))
            elif item.role == "assistant":
                langchain_messages.append(AIMessage(content=item.content))
            elif item.role == "system":
                langchain_messages.append(SystemMessage(content=item.content))
        elif isinstance(item, dict):
            role = item.get("role")
            content = item.get("content", "")
            if role == "user":
                langchain_messages.append(HumanMessage(content=content))
            elif role == "assistant":
                langchain_messages.append(AIMessage(content=content))
            elif role == "system":
                langchain_messages.append(SystemMessage(content=content))

    return langchain_messages


def call_llm_service_adapter(prompt_value: Any) -> AIMessage:
    """
    Step 5: Adapter bridging LangChain LCEL prompt values to the existing generate_chat_response.
    Reuses existing Mistral primary and Gemini fallback logic without duplication or modification.
    """
    # 1. Extract messages from ChatPromptValue or List[BaseMessage]
    if hasattr(prompt_value, "to_messages"):
        raw_messages = prompt_value.to_messages()
    elif isinstance(prompt_value, list):
        raw_messages = prompt_value
    else:
        raw_messages = [HumanMessage(content=str(prompt_value))]

    # 2. Convert to list of app.schemas.chat.Message
    chat_messages: List[Message] = []
    for msg in raw_messages:
        if isinstance(msg, SystemMessage):
            chat_messages.append(Message(role="system", content=msg.content))
        elif isinstance(msg, AIMessage):
            chat_messages.append(Message(role="assistant", content=msg.content))
        else:
            chat_messages.append(Message(role="user", content=str(msg.content)))

    # 3. Call existing generate_chat_response from app.services.llm_service
    response: ChatResponse = generate_chat_response(chat_messages)

    # 4. Return AIMessage with provider metadata
    return AIMessage(
        content=response.content,
        response_metadata={"provider": response.provider, "role": response.role},
    )


def build_rag_chain() -> Runnable:
    """
    Step 2: Construct the complete RAG Runnable pipeline using LangChain Expression Language (LCEL).

    Workflow:
    Input: {"db": db, "user_id": user_id, "question": str, "document_id": Optional[str], "top_k": int, "chat_history": Optional[list]}
        │
        ▼ (RunnablePassthrough.assign)
    Retrieve Chunks & Sources (retrieve_context_and_sources)
        │
        ▼ (RunnablePassthrough.assign)
    Format Chat History & Prompt Inputs
        │
        ▼ (ChatPromptTemplate | llm_adapter | StrOutputParser)
    Execute LLM Generation with Mistral primary / Gemini fallback
        │
        ▼ (RunnableLambda)
    Output: RAGResponse(answer, sources, provider, has_sufficient_context)
    """
    rag_prompt = get_rag_prompt_template()
    llm_runnable = RunnableLambda(call_llm_service_adapter)
    str_parser = StrOutputParser()

    # LCEL generation sub-chain: prompt | adapter | parser
    generation_chain = (
        rag_prompt
        | llm_runnable
        | RunnableLambda(
            lambda msg: {
                "answer": str_parser.invoke(msg),
                "provider": msg.response_metadata.get("provider", "unknown") if hasattr(msg, "response_metadata") else "unknown",
            }
        )
    )

    # Full composable RAG chain
    rag_chain = (
        RunnablePassthrough.assign(
            retrieval=RunnableLambda(
                lambda inputs: retrieve_context_and_sources(
                    db=inputs["db"],
                    user_id=inputs["user_id"],
                    question=inputs["question"],
                    document_id=inputs.get("document_id"),
                    top_k=inputs.get("top_k", DEFAULT_TOP_K),
                )
            )
        )
        | RunnablePassthrough.assign(
            context=lambda state: state["retrieval"]["context"],
            sources=lambda state: state["retrieval"]["sources"],
            has_sufficient_context=lambda state: state["retrieval"]["has_sufficient_context"],
            chat_history=lambda state: prepare_chat_history(state.get("chat_history")),
        )
        | RunnablePassthrough.assign(
            llm_result=lambda state: generation_chain.invoke({
                "context": state["context"],
                "question": state["question"],
                "chat_history": state["chat_history"],
            })
        )
        | RunnableLambda(
            lambda state: RAGResponse(
                answer=state["llm_result"]["answer"],
                sources=state["sources"],
                provider=state["llm_result"]["provider"],
                has_sufficient_context=state["has_sufficient_context"],
            )
        )
    )

    return rag_chain


# Cached singleton instance of the runnable chain
_rag_chain_instance: Optional[Runnable] = None


def get_rag_chain() -> Runnable:
    """Return or initialize the singleton RAG Runnable chain."""
    global _rag_chain_instance
    if _rag_chain_instance is None:
        _rag_chain_instance = build_rag_chain()
    return _rag_chain_instance


def execute_rag(
    db: Session,
    user_id: str,
    question: str,
    document_id: Optional[str] = None,
    top_k: int = DEFAULT_TOP_K,
    chat_history: Optional[List[Any]] = None,
) -> RAGResponse:
    """
    Main entry point: Executes the RAG Runnable pipeline end-to-end.

    Args:
        db: SQLAlchemy database session.
        user_id: Authenticated user ID.
        question: User's query string.
        document_id: Optional document ID to restrict search.
        top_k: Maximum number of chunks to retrieve (default: 5).
        chat_history: Optional previous conversation messages.

    Returns:
        RAGResponse with grounded answer, source references, and provider metadata.
    """
    chain = get_rag_chain()
    return chain.invoke({
        "db": db,
        "user_id": user_id,
        "question": question,
        "document_id": document_id,
        "top_k": top_k,
        "chat_history": chat_history,
    })
