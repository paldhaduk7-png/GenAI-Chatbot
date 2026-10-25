from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve path to backend/.env
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_PATH,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    MISTRAL_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""
    GEMINI_API_KEY: str = ""

    # Default models
    MISTRAL_MODEL: str = "open-mistral-7b"
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"

    # Database configuration
    DATABASE_URL: str = ""

    # JWT Authentication
    JWT_SECRET_KEY: str = "dev-jwt-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30


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
