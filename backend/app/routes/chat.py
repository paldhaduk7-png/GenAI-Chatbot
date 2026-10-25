import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.models import Conversation, Message as DbMessage, User
from app.db.session import get_db
from app.schemas.chat import ChatRequest, ChatResponse, Message
from app.services.llm_service import generate_chat_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(
    request: ChatRequest,
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
    for msg in reversed(request.messages):
        if msg.role == "user":
            latest_user_message = msg
            break

    if not latest_user_message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chat request must contain at least one user message.",
        )

    # 2. Resolve or create conversation with ownership enforcement
    if request.conversation_id:
        stmt = select(Conversation).where(
            Conversation.id == request.conversation_id,
            Conversation.user_id == current_user.id,
        )
        conversation = db.scalars(stmt).first()
        if not conversation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conversation with id '{request.conversation_id}' was not found.",
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

    # 4. Formulate LLM context:
    # Existing chronological history from DB + new latest user message
    llm_context: List[Message] = [
        Message(role=m.role, content=m.content) for m in existing_db_messages
    ]

    # If DB was empty but request provided earlier history (e.g. migration or initial turns)
    if not existing_db_messages and len(request.messages) > 1:
        for prev_msg in request.messages:
            if prev_msg is not latest_user_message:
                llm_context.append(Message(role=prev_msg.role, content=prev_msg.content))

    llm_context.append(Message(role="user", content=latest_user_message.content))

    # 5. Call LLM service safely (without committing user message prematurely)
    try:
        llm_response = generate_chat_response(llm_context)
    except Exception as exc:
        db.rollback()
        raise exc

    # 6. Save messages to DB atomically upon successful LLM response
    # If DB was empty and earlier history was passed, persist it once
    if not existing_db_messages and len(request.messages) > 1:
        for prev_msg in request.messages:
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
            content=llm_response.content,
            provider=llm_response.provider,
        )
    )

    # Update conversation's updated_at timestamp
    conversation.updated_at = datetime.now(timezone.utc)
    db.commit()

    return ChatResponse(
        conversation_id=conversation.id,
        role="assistant",
        content=llm_response.content,
        provider=llm_response.provider,
    )
