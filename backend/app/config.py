import os
from pathlib import Path
from dotenv import load_dotenv

# Resolve path to backend/.env
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

# Load environment variables
load_dotenv(dotenv_path=ENV_PATH)

MISTRAL_API_KEY: str = os.getenv("MISTRAL_API_KEY", "")
GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY", "")

# Default models
MISTRAL_MODEL: str = os.getenv("MISTRAL_MODEL", "open-mistral-7b")
GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

# Database configuration
DATABASE_URL: str = os.getenv("DATABASE_URL", "")
