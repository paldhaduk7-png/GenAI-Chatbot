"""
Database migration runner.
Applies safe, idempotent schema updates to the PostgreSQL database in numerical order.
"""
import logging
from pathlib import Path
from sqlalchemy import text, inspect
from app.db.session import engine

logger = logging.getLogger(__name__)
MIGRATIONS_DIR = Path(__file__).resolve().parent


def apply_migrations():
    """
    Applies explicit migration scripts non-destructively in sorted sequence.
    """
    if engine is None:
        raise RuntimeError("DATABASE_URL is not configured.")

    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not migration_files:
        logger.warning("No migration SQL files found in %s", MIGRATIONS_DIR)
        return {}

    with engine.begin() as connection:
        for migration_file in migration_files:
            logger.info("Executing migration %s...", migration_file.name)
            sql_script = migration_file.read_text(encoding="utf-8")
            connection.execute(text(sql_script))
            logger.info("Migration %s executed successfully.", migration_file.name)

    # Verify tables and columns
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    conv_cols = [c["name"] for c in inspector.get_columns("conversations")] if "conversations" in tables else []
    user_cols = [c["name"] for c in inspector.get_columns("users")] if "users" in tables else []
    doc_cols = [c["name"] for c in inspector.get_columns("documents")] if "documents" in tables else []
    chunk_cols = [c["name"] for c in inspector.get_columns("document_chunks")] if "document_chunks" in tables else []

    return {
        "tables": tables,
        "conversations_columns": conv_cols,
        "users_columns": user_cols,
        "documents_columns": doc_cols,
        "document_chunks_columns": chunk_cols,
    }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = apply_migrations()
    print("Migration Verification Result:")
    print("Tables:", result["tables"])
    print("Documents columns:", result.get("documents_columns"))
    print("Document chunks columns:", result.get("document_chunks_columns"))
