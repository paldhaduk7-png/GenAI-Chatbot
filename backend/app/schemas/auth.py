"""
Authentication and user Pydantic schemas for request validation and response serialization.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserRegister(BaseModel):
    """Schema for registering a new user."""
    email: EmailStr = Field(..., description="Valid user email address")
    password: str = Field(..., min_length=8, max_length=128, description="Password (at least 8 characters)")
    full_name: Optional[str] = Field(None, max_length=100, description="Optional user full name")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("password")
    @classmethod
    def validate_password_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Password cannot be empty or contain only whitespace.")
        return value

    @field_validator("full_name")
    @classmethod
    def sanitize_full_name(cls, value: Optional[str]) -> Optional[str]:
        if value is not None:
            trimmed = value.strip()
            return trimmed if trimmed else None
        return None


class UserLogin(BaseModel):
    """Schema for user login credentials."""
    email: EmailStr = Field(..., description="Registered user email address")
    password: str = Field(..., min_length=1, description="User password")

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()


class UserOut(BaseModel):
    """
    Public user profile schema for API responses.
    Strictly excludes password and sensitive credentials.
    """
    id: str
    email: EmailStr
    full_name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    """Schema for JWT access token response."""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Schema for decoded JWT token payload data."""
    user_id: Optional[str] = None
    email: Optional[str] = None
