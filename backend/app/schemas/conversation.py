from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    provider: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationCreate(BaseModel):
    title: Optional[str] = Field(None, max_length=255, description="Initial conversation title")

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: Optional[str]) -> Optional[str]:
        if value is not None:
            trimmed = value.strip()
            if not trimmed:
                raise ValueError("Title cannot be empty or blank if provided.")
            return trimmed
        return value


class ConversationUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Updated conversation title")

    @field_validator("title")
    @classmethod
    def validate_title_not_empty(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Title cannot be empty or blank.")
        return trimmed


class ConversationResponse(BaseModel):
    id: str
    title: str
    pinned: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationDetailResponse(BaseModel):
    id: str
    title: str
    pinned: bool
    created_at: datetime
    updated_at: datetime
    messages: List[MessageResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ConversationDeleteResponse(BaseModel):
    id: str
    message: str = "Conversation deleted successfully"
