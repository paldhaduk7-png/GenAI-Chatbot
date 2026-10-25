"""
Migration runner for Phase 3 Step 2.
Applies safe, idempotent schema updates to the PostgreSQL database.
"""
import logging
from pathlib import Path
from sqlalchemy import text, inspect
from app.db.session import engine

logger = logging.getLogger(__name__)
MIGRATIONS_DIR = Path(__file__).resolve().parent


def apply_migrations():
    """
    Applies explicit migration scripts non-destructively.
    """
    if engine is None:
        raise RuntimeError("DATABASE_URL is not configured.")

    migration_file = MIGRATIONS_DIR / "001_create_users_and_add_user_id.sql"
    sql_script = migration_file.read_text(encoding="utf-8")

    logger.info("Executing migration 001_create_users_and_add_user_id.sql...")
    with engine.begin() as connection:
        # PostgreSQL supports multi-statement execution via raw connection or text
        connection.execute(text(sql_script))
    
    logger.info("Migration completed successfully.")

    # Verify tables and columns
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    conv_cols = [c["name"] for c in inspector.get_columns("conversations")]
    user_cols = [c["name"] for c in inspector.get_columns("users")]

    return {
        "tables": tables,
        "conversations_columns": conv_cols,
        "users_columns": user_cols,
    }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = apply_migrations()
    print("Migration Verification Result:")
    print("Tables:", result["tables"])
    print("Conversations columns:", result["conversations_columns"])
    print("Users columns:", result["users_columns"])
