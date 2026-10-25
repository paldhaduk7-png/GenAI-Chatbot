from typing import List, Literal
from pydantic import BaseModel, Field, field_validator


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, description="Text content of the message")

    @field_validator("content")
    @classmethod
    def validate_content_not_empty(cls, value: str) -> str:
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("Message content cannot be empty or blank.")
        return trimmed


class ChatRequest(BaseModel):
    messages: List[Message] = Field(..., min_length=1, description="Conversation history messages")


class ChatResponse(BaseModel):
    role: str = "assistant"
    content: str
    provider: str
