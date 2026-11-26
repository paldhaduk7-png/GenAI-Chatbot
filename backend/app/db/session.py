import logging
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import DATABASE_URL

logger = logging.getLogger(__name__)


def get_normalized_database_url(url: str) -> str:
    """
    Normalizes the database connection URL for SQLAlchemy compatibility.
    Specifically converts legacy 'postgres://' prefixes to 'postgresql://'.
    """
    if not url:
        return ""
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql://", 1)
    return url


normalized_database_url = get_normalized_database_url(DATABASE_URL)

if normalized_database_url:
    # Neon serverless PostgreSQL connection pooling configuration:
    # - pool_pre_ping=True: Actively validates connection health before checkout, handling Neon compute suspension/resume.
    # - pool_recycle=300: Recycles connections every 5 minutes to prevent stale TCP sockets.
    # - pool_size=10, max_overflow=20: Manages concurrent connection bursts while staying safely within Neon tier limits.
    # - pool_timeout=30: Fail-fast timeout for connection pool exhaustion.
    engine_kwargs = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }
    if not normalized_database_url.startswith("sqlite"):
        engine_kwargs.update({
            "pool_size": 10,
            "max_overflow": 20,
            "pool_timeout": 30,
        })
    engine = create_engine(
        normalized_database_url,
        **engine_kwargs,
    )
    SessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
    )
else:
    engine = None
    SessionLocal = None


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency yielding a scoped SQLAlchemy session per request.
    Ensures that sessions are properly closed after the request completes.
    """
    if SessionLocal is None:
        raise RuntimeError(
            "DATABASE_URL is not configured. Database sessions cannot be established."
        )

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
