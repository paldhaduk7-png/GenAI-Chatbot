from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import Conversation
from app.db.session import get_db
from app.schemas.conversation import (
    ConversationCreate,
    ConversationDeleteResponse,
    ConversationDetailResponse,
    ConversationResponse,
    ConversationUpdate,
)

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("", response_model=List[ConversationResponse])
def list_conversations(db: Session = Depends(get_db)) -> List[ConversationResponse]:
    """
    GET /api/conversations
    Return all conversations sorted by updated_at, newest first.
    Includes id, title, pinned, created_at, and updated_at.
    """
    stmt = select(Conversation).order_by(Conversation.updated_at.desc())
    conversations = db.scalars(stmt).all()
    return conversations


@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def create_conversation(
    payload: Optional[ConversationCreate] = None,
    db: Session = Depends(get_db),
) -> ConversationResponse:
    """
    POST /api/conversations
    Create a new conversation session.
    """
    title = (payload.title if payload and payload.title else "New Conversation").strip()
    conversation = Conversation(title=title)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation(
    conversation_id: str, db: Session = Depends(get_db)
) -> ConversationDetailResponse:
    """
    GET /api/conversations/{conversation_id}
    Return the conversation and its messages in chronological order.
    Returns 404 if the conversation doesn't exist.
    """
    stmt = (
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.messages))
    )
    conversation = db.scalars(stmt).first()

    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation with id '{conversation_id}' was not found.",
        )
    return conversation


@router.patch("/{conversation_id}", response_model=ConversationResponse)
def update_conversation_title(
    conversation_id: str,
    payload: ConversationUpdate,
    db: Session = Depends(get_db),
) -> ConversationResponse:
    """
    PATCH /api/conversations/{conversation_id}
    Allow updating the conversation title.
    Validates that the title isn't empty.
    Returns 404 if the conversation doesn't exist.
    """
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation with id '{conversation_id}' was not found.",
        )

    conversation.title = payload.title
    conversation.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.patch("/{conversation_id}/pin", response_model=ConversationResponse)
def toggle_conversation_pin(
    conversation_id: str,
    db: Session = Depends(get_db),
) -> ConversationResponse:
    """
    PATCH /api/conversations/{conversation_id}/pin
    Toggle the conversation's pinned status.
    Returns the updated pinned status and metadata.
    Returns 404 if the conversation doesn't exist.
    """
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation with id '{conversation_id}' was not found.",
        )

    conversation.pinned = not conversation.pinned
    conversation.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.delete("/{conversation_id}", response_model=ConversationDeleteResponse)
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
) -> ConversationDeleteResponse:
    """
    DELETE /api/conversations/{conversation_id}
    Delete the conversation and its associated messages.
    Returns 404 if the conversation doesn't exist.
    """
    conversation = db.get(Conversation, conversation_id)
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation with id '{conversation_id}' was not found.",
        )

    db.delete(conversation)
    db.commit()
    return ConversationDeleteResponse(
        id=conversation_id,
        message="Conversation deleted successfully",
    )
