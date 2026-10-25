from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.deps import get_current_user
from app.db.models import Conversation, User
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
def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[ConversationResponse]:
    """
    GET /api/conversations
    Return all conversations belonging to the authenticated user, sorted by updated_at descending.
    Legacy unassigned conversations (user_id=NULL) and other users' records are strictly excluded.
    """
    stmt = (
        select(Conversation)
        .where(Conversation.user_id == current_user.id)
        .order_by(Conversation.pinned.desc(), Conversation.updated_at.desc())
    )
    conversations = db.scalars(stmt).all()
    return conversations


@router.post("", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
def create_conversation(
    payload: Optional[ConversationCreate] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConversationResponse:
    """
    POST /api/conversations
    Create a new conversation session assigned to the authenticated user.
    """
    title = (payload.title if payload and payload.title else "New Conversation").strip()
    conversation = Conversation(
        title=title,
        user_id=current_user.id,
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConversationDetailResponse:
    """
    GET /api/conversations/{conversation_id}
    Return the conversation and its chronological messages if owned by current_user.
    Returns 404 if the conversation does not exist or belongs to another user.
    """
    stmt = (
        select(Conversation)
        .where(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        )
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConversationResponse:
    """
    PATCH /api/conversations/{conversation_id}
    Allow updating the conversation title if owned by current_user.
    Returns 404 if the conversation does not exist or belongs to another user.
    """
    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id,
    )
    conversation = db.scalars(stmt).first()
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConversationResponse:
    """
    PATCH /api/conversations/{conversation_id}/pin
    Toggle the conversation's pinned status for current_user.
    Enforces a maximum of 7 pinned conversations per user.
    Returns 404 if the conversation does not exist or belongs to another user.
    """
    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id,
    )
    conversation = db.scalars(stmt).first()
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation with id '{conversation_id}' was not found.",
        )

    if not conversation.pinned:
        pinned_count = db.scalar(
            select(func.count(Conversation.id)).where(
                Conversation.user_id == current_user.id,
                Conversation.pinned.is_(True),
            )
        )
        if (pinned_count or 0) >= 7:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You can pin up to 7 conversations. Please unpin one first.",
            )

    conversation.pinned = not conversation.pinned
    conversation.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(conversation)
    return conversation


@router.delete("/{conversation_id}", response_model=ConversationDeleteResponse)
def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConversationDeleteResponse:
    """
    DELETE /api/conversations/{conversation_id}
    Delete the conversation and its associated messages if owned by current_user.
    Returns 404 if the conversation does not exist or belongs to another user.
    """
    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id,
    )
    conversation = db.scalars(stmt).first()
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
