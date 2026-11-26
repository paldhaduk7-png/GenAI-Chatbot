import json
from pathlib import Path
from typing import List, Union
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Default fallback key used exclusively for local development
DEFAULT_DEV_JWT_SECRET: str = "dev-jwt-secret-key-change-in-production"
MIN_JWT_SECRET_LENGTH: int = 32

# Resolve path to backend/.env
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_PATH,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application Environment
    ENVIRONMENT: str = "development"

    MISTRAL_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""
    GEMINI_API_KEY: str = ""

    # Default models
    MISTRAL_MODEL: str = "open-mistral-7b"
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"

    # Embedding configuration
    EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384

    # Database configuration
    DATABASE_URL: str = ""

    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return []
            if v.startswith("[") and v.endswith("]"):
                try:
                    parsed = json.loads(v)
                    if isinstance(parsed, list):
                        return [str(origin).strip() for origin in parsed if str(origin).strip()]
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        elif isinstance(v, list):
            return [str(origin).strip() for origin in v if str(origin).strip()]
        return v

    # JWT Authentication
    JWT_SECRET_KEY: str = DEFAULT_DEV_JWT_SECRET
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    @model_validator(mode="after")
    def validate_jwt_secret_for_environment(self) -> "Settings":
        env = (self.ENVIRONMENT or "").strip().lower()
        secret = (self.JWT_SECRET_KEY or "").strip()
        is_production = env in {"production", "prod", "staging"}

        if is_production:
            if not secret:
                raise ValueError(
                    "JWT_SECRET_KEY is required in production environments but was missing or empty."
                )
            if secret == DEFAULT_DEV_JWT_SECRET:
                raise ValueError(
                    "JWT_SECRET_KEY cannot use the default development fallback in production environments."
                )
            if len(secret) < MIN_JWT_SECRET_LENGTH:
                raise ValueError(
                    f"JWT_SECRET_KEY is insecure. It must be at least {MIN_JWT_SECRET_LENGTH} characters long in production environments."
                )
        return self

    # Cloudinary configuration
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    CLOUD_NAME: str = ""
    API_KEY: str = ""
    API_SECRET: str = ""

    # Rate Limiting & Abuse Protection
    RATE_LIMITING_ENABLED: bool = True
    RATE_LIMIT_STORAGE_URL: str = "memory://"
    RATE_LIMIT_DEFAULT: str = "120/minute"
    RATE_LIMIT_AUTH_LOGIN: str = "10/minute"
    RATE_LIMIT_AUTH_REGISTER: str = "10/minute"
    RATE_LIMIT_CHAT: str = "30/minute"
    RATE_LIMIT_DOCUMENT_UPLOAD: str = "20/minute"
    RATE_LIMIT_DOCUMENT_SEARCH: str = "60/minute"

    @property
    def cloudinary_cloud_name(self) -> str:
        return self.CLOUDINARY_CLOUD_NAME or self.CLOUD_NAME

    @property
    def cloudinary_api_key(self) -> str:
        return self.CLOUDINARY_API_KEY or self.API_KEY

    @property
    def cloudinary_api_secret(self) -> str:
        return self.CLOUDINARY_API_SECRET or self.API_SECRET


settings = Settings()

# Direct module-level exports for backwards compatibility with existing imports
MISTRAL_API_KEY: str = settings.MISTRAL_API_KEY
GOOGLE_API_KEY: str = settings.GOOGLE_API_KEY or settings.GEMINI_API_KEY
MISTRAL_MODEL: str = settings.MISTRAL_MODEL
GEMINI_MODEL: str = settings.GEMINI_MODEL
DATABASE_URL: str = settings.DATABASE_URL

JWT_SECRET_KEY: str = settings.JWT_SECRET_KEY
JWT_ALGORITHM: str = settings.JWT_ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES: int = settings.ACCESS_TOKEN_EXPIRE_MINUTES

ENVIRONMENT: str = settings.ENVIRONMENT

CLOUDINARY_CLOUD_NAME: str = settings.cloudinary_cloud_name
CLOUDINARY_API_KEY: str = settings.cloudinary_api_key
CLOUDINARY_API_SECRET: str = settings.cloudinary_api_secret

CORS_ORIGINS: List[str] = settings.CORS_ORIGINS

EMBEDDING_MODEL_NAME: str = settings.EMBEDDING_MODEL_NAME
EMBEDDING_DIMENSION: int = settings.EMBEDDING_DIMENSION

RATE_LIMITING_ENABLED: bool = settings.RATE_LIMITING_ENABLED
RATE_LIMIT_STORAGE_URL: str = settings.RATE_LIMIT_STORAGE_URL
RATE_LIMIT_DEFAULT: str = settings.RATE_LIMIT_DEFAULT
RATE_LIMIT_AUTH_LOGIN: str = settings.RATE_LIMIT_AUTH_LOGIN
RATE_LIMIT_AUTH_REGISTER: str = settings.RATE_LIMIT_AUTH_REGISTER
RATE_LIMIT_CHAT: str = settings.RATE_LIMIT_CHAT
RATE_LIMIT_DOCUMENT_UPLOAD: str = settings.RATE_LIMIT_DOCUMENT_UPLOAD
RATE_LIMIT_DOCUMENT_SEARCH: str = settings.RATE_LIMIT_DOCUMENT_SEARCH

