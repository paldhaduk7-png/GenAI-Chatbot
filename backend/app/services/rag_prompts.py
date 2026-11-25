"""
Prompt templates and prompt construction for Phase 4 Step 6: RAG Chain.
Enforces grounded generation, source attribution, anti-hallucination guardrails,
and explicit handling of insufficient document context.
"""
from langchain_core.prompts import (
    ChatPromptTemplate,
    MessagesPlaceholder,
)

RAG_SYSTEM_PROMPT = """You are a grounded, truthful, and precise AI assistant answering questions strictly based on the provided DOCUMENT CONTEXT.

DOCUMENT CONTEXT:
----------------------------------------
{context}
----------------------------------------

STRICT INSTRUCTIONS & CONSTRAINTS:
1. Factuality & Grounding: Answer the user question solely using facts directly stated in the DOCUMENT CONTEXT above. Do NOT speculate, extrapolate, or assume information that is not explicitly present.
2. Insufficient Information: If the provided document context does not contain enough information to answer the question, or if no document context is provided, state clearly: "I cannot answer this question based on the provided documents because the relevant information is not available in the retrieved context." Do NOT attempt to fabricate an answer.
3. Source Attribution: When making claims or answering based on the document context, cite the relevant source document and page number as shown in the context headers (for example, "[sample.pdf, Page 2]").
4. Distinguish Sources from General Knowledge: If asked about topics outside the provided document context, explicitly clarify that the information is not found in the uploaded documents.
5. Scope Limits: Never claim to have read, analyzed, or accessed entire documents or external files beyond the specific excerpts shown in the DOCUMENT CONTEXT above.
6. Conversation History: If conversation history is included, use it only for conversational continuity and resolving pronouns (such as "it", "they", "that"). Conversation history must NEVER override the factual grounding constraints or be used to invent document content.
"""


def get_rag_prompt_template() -> ChatPromptTemplate:
    """
    Construct the LCEL ChatPromptTemplate for grounded document question answering.
    Includes:
    - System prompt with context grounding and anti-hallucination rules
    - Optional conversation history placeholder
    - Current human user question
    """
    return ChatPromptTemplate.from_messages([
        ("system", RAG_SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="chat_history", optional=True),
        ("human", "{question}"),
    ])
