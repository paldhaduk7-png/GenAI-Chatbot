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
    # pool_pre_ping=True ensures idle or suspended Neon connections are verified
    # pool_recycle=300 recycles connections every 5 minutes to prevent stale timeouts
    engine = create_engine(
        normalized_database_url,
        pool_pre_ping=True,
        pool_recycle=300,
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
