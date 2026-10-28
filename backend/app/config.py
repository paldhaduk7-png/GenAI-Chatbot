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

    # Embedding configuration
    EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384

    # Database configuration
    DATABASE_URL: str = ""

    # JWT Authentication
    JWT_SECRET_KEY: str = "dev-jwt-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Cloudinary configuration
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    CLOUD_NAME: str = ""
    API_KEY: str = ""
    API_SECRET: str = ""

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

CLOUDINARY_CLOUD_NAME: str = settings.cloudinary_cloud_name
CLOUDINARY_API_KEY: str = settings.cloudinary_api_key
CLOUDINARY_API_SECRET: str = settings.cloudinary_api_secret

EMBEDDING_MODEL_NAME: str = settings.EMBEDDING_MODEL_NAME
EMBEDDING_DIMENSION: int = settings.EMBEDDING_DIMENSION
