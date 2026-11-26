import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.deps import get_current_user, get_rate_limit_key, limiter
from app.db.models import Conversation, Document, Message as DbMessage, User
from app.db.session import get_db
from app.schemas.chat import ChatRequest, ChatResponse, Message
from app.services.llm_service import generate_chat_response
from app.services.rag_service import execute_rag

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
@limiter.limit(settings.RATE_LIMIT_CHAT, key_func=get_rate_limit_key)
def chat_endpoint(
    request: Request,
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatResponse:
    """
    POST /api/chat endpoint with user authentication, database persistence, and LLM fallback.
    - Requires valid Bearer authentication (401 if unauthenticated).
    - If conversation_id is omitted, auto-creates a new conversation assigned to current_user.
    - If conversation_id is provided, validates that it exists and is owned by current_user (404 otherwise).
    - Restores existing conversation history from PostgreSQL as LLM context.
    - Appends latest user message and assistant reply with provider tracking.
    - Safe transaction handling: LLM failures do not commit incomplete user messages.
    """
    # 1. Identify latest user message in incoming payload
    latest_user_message = None
    for msg in reversed(payload.messages):
        if msg.role == "user":
            latest_user_message = msg
            break

    if not latest_user_message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chat request must contain at least one user message.",
        )

    # 2. Resolve or create conversation with ownership enforcement
    if payload.conversation_id:
        stmt = select(Conversation).where(
            Conversation.id == payload.conversation_id,
            Conversation.user_id == current_user.id,
        )
        conversation = db.scalars(stmt).first()
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conversation with id '{payload.conversation_id}' was not found.",
            )
    else:
        # Generate clean title snippet from the first user prompt
        title_snippet = latest_user_message.content.strip().replace("\n", " ")
        if len(title_snippet) > 50:
            title_snippet = title_snippet[:47] + "..."
        conversation = Conversation(
            title=title_snippet or "New Conversation",
            user_id=current_user.id,
        )
        db.add(conversation)
        db.flush()  # Assigns conversation.id without committing transaction

    # 3. Retrieve existing conversation history from PostgreSQL
    existing_db_messages = (
        db.scalars(
            select(DbMessage)
            .where(DbMessage.conversation_id == conversation.id)
            .order_by(DbMessage.created_at.asc())
        ).all()
    )

    # 4. Formulate preceding conversation history:
    history_context: List[Message] = [
        Message(role=m.role, content=m.content) for m in existing_db_messages
    ]

    # If DB was empty but request provided earlier history (e.g. migration or initial turns)
    if not existing_db_messages and len(payload.messages) > 1:
        for prev_msg in payload.messages:
            if prev_msg is not latest_user_message:
                history_context.append(Message(role=prev_msg.role, content=prev_msg.content))

    # 5. Check if RAG is explicitly enabled with a selected document
    is_rag_active = bool(payload.use_rag and payload.document_id)

    if is_rag_active:
        # Validate that selected document exists and belongs to current_user
        doc_stmt = select(Document).where(
            Document.id == payload.document_id,
            Document.user_id == current_user.id,
        )
        document = db.scalar(doc_stmt)
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document with id '{payload.document_id}' was not found.",
            )

        try:
            rag_result = execute_rag(
                db=db,
                user_id=current_user.id,
                question=latest_user_message.content,
                document_id=payload.document_id,
                chat_history=history_context,
            )
            answer_content = rag_result.answer
            provider_name = rag_result.provider
            sources = rag_result.sources
            has_sufficient_context = rag_result.has_sufficient_context
        except Exception as exc:
            db.rollback()
            raise exc
    else:
        # Normal chat flow: append latest user message to full chronological context
        llm_context: List[Message] = list(history_context)
        llm_context.append(Message(role="user", content=latest_user_message.content))
        try:
            llm_response = generate_chat_response(llm_context)
            answer_content = llm_response.content
            provider_name = llm_response.provider
            sources = []
            has_sufficient_context = None
        except Exception as exc:
            db.rollback()
            raise exc

    # 6. Save messages to DB atomically upon successful LLM response
    # If DB was empty and earlier history was passed, persist it once
    if not existing_db_messages and len(payload.messages) > 1:
        for prev_msg in payload.messages:
            if prev_msg is not latest_user_message:
                db.add(
                    DbMessage(
                        conversation_id=conversation.id,
                        role=prev_msg.role,
                        content=prev_msg.content,
                    )
                )


    # Save latest user message
    db.add(
        DbMessage(
            conversation_id=conversation.id,
            role="user",
            content=latest_user_message.content,
        )
    )

    # Save assistant message with provider metadata
    db.add(
        DbMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=answer_content,
            provider=provider_name,
        )
    )

    # Update conversation's updated_at timestamp
    conversation.updated_at = datetime.now(timezone.utc)
    db.commit()

    return ChatResponse(
        conversation_id=conversation.id,
        role="assistant",
        content=answer_content,
        provider=provider_name,
        sources=sources,
        has_sufficient_context=has_sufficient_context,
    )
