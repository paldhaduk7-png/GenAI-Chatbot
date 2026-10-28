"""
Document chunk persistence service for Phase 4 Step 5.
Stores chunks and vector embeddings into the document_chunks table.
Enforces document existence, user ownership, dimension validation, idempotency, and transactional consistency.
"""
import logging
import uuid
from typing import List

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import EMBEDDING_DIMENSION
from app.db.models import Document, DocumentChunk
from app.schemas.chunk import ChunkData

logger = logging.getLogger(__name__)


class ChunkPersistenceError(Exception):
    """Raised when document chunk persistence fails."""
    pass


def persist_document_chunks(
    db: Session,
    document_id: str,
    user_id: str,
    chunks: List[ChunkData],
) -> List[DocumentChunk]:
    """
    Persist a list of ChunkData items into the document_chunks PostgreSQL table.

    Guarantees:
    - Verifies document existence.
    - Strictly enforces user ownership (rejects mismatch).
    - Validates that each chunk embedding has exactly 384 dimensions.
    - Avoids duplicate chunk insertion upon retries by atomically deleting prior chunks for document_id.
    - Leaves transaction in flushed state for caller's atomic commit alongside document status update.

    Args:
        db: SQLAlchemy database session.
        document_id: UUID string of the target document.
        user_id: ID of the authenticated user attempting persistence.
        chunks: List of ChunkData instances to insert.

    Returns:
        List of persisted DocumentChunk ORM models.

    Raises:
        ValueError: If document does not exist or embedding dimensions are invalid.
        PermissionError: If document is not owned by user_id.
        ChunkPersistenceError: If database persistence fails.
    """
    if not document_id:
        raise ValueError("document_id must not be empty.")

    # 1. Verify document exists
    document = db.scalar(select(Document).where(Document.id == document_id))
    if document is None:
        raise ValueError(f"Document with ID '{document_id}' does not exist.")

    # 2. Verify ownership matches
    if document.user_id != user_id:
        raise PermissionError(
            f"User '{user_id}' does not have ownership of document '{document_id}'."
        )

    # 3. If chunks list is empty, clear existing chunks (if retrying) and return
    if not chunks:
        logger.info("No chunks provided to persist for document %s.", document_id)
        db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document_id))
        db.flush()
        return []

    # 4. Validate embeddings
    for chunk in chunks:
        if chunk.embedding is not None:
            actual_dim = len(chunk.embedding)
            if actual_dim != EMBEDDING_DIMENSION:
                raise ValueError(
                    f"Invalid embedding dimension in chunk index {chunk.chunk_index}: "
                    f"expected {EMBEDDING_DIMENSION}, got {actual_dim}."
                )

    try:
        # 5. Idempotent cleanup: Delete any pre-existing chunks for this document
        db.execute(delete(DocumentChunk).where(DocumentChunk.document_id == document_id))

        # 6. Build ORM models
        db_chunks: List[DocumentChunk] = []
        for chunk in chunks:
            db_chunk = DocumentChunk(
                id=str(uuid.uuid4()),
                document_id=document_id,
                content=chunk.content,
                page_number=chunk.page_number,
                chunk_index=chunk.chunk_index,
                embedding=chunk.embedding,
            )
            db_chunks.append(db_chunk)

        # 7. Add to session and flush to verify constraints without closing transaction
        db.add_all(db_chunks)
        db.flush()

        logger.info(
            "Persisted %d chunks with embeddings for document %s (user: %s).",
            len(db_chunks),
            document_id,
            user_id,
        )
        return db_chunks

    except (ValueError, PermissionError):
        raise
    except Exception as exc:
        logger.error(
            "Database error while persisting chunks for document %s: %s",
            document_id,
            exc,
            exc_info=True,
        )
        raise ChunkPersistenceError(f"Failed to persist document chunks: {str(exc)}") from exc

