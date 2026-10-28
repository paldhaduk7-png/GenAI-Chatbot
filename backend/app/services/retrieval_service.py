"""
Vector retrieval service for Phase 4 Step 5.
Performs semantic similarity search over document_chunks using pgvector cosine distance.
Enforces strict user ownership, query dimension validation, and top-k filtering.
"""
import logging
from typing import List, Optional

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import EMBEDDING_DIMENSION
from app.db.models import Document, DocumentChunk
from app.schemas.chunk import RetrievedChunk
from app.services.embedding_service import generate_embedding

logger = logging.getLogger(__name__)


def search_similar_chunks(
    db: Session,
    user_id: str,
    query_embedding: List[float],
    document_id: Optional[str] = None,
    top_k: int = 5,
) -> List[RetrievedChunk]:
    """
    Search document_chunks for vectors nearest to query_embedding using cosine distance.

    Enforces:
    - Query embedding dimension strictly matches EMBEDDING_DIMENSION (384).
    - User ownership: Only chunks belonging to documents owned by user_id are returned.
    - Excludes chunks with NULL embeddings.
    - Optional document_id filter.
    - Limits results to top_k.

    Args:
        db: SQLAlchemy database session.
        user_id: ID of the authenticated user.
        query_embedding: 384-dimensional query vector.
        document_id: Optional document ID to restrict search.
        top_k: Maximum number of results to return (default: 5).

    Returns:
        List of RetrievedChunk instances ordered by similarity (most similar first).

    Raises:
        ValueError: If query_embedding dimension is not 384 or user_id is empty.
    """
    if not user_id:
        raise ValueError("user_id must not be empty.")

    if not query_embedding:
        raise ValueError("query_embedding must not be empty.")

    actual_dim = len(query_embedding)
    if actual_dim != EMBEDDING_DIMENSION:
        raise ValueError(
            f"Query embedding dimension mismatch: expected {EMBEDDING_DIMENSION}, got {actual_dim}."
        )

    k = max(1, top_k)

    # Check dialect: PostgreSQL uses native pgvector operator <=>
    dialect_name = db.bind.dialect.name if db.bind else ""

    if dialect_name == "postgresql":
        # Native pgvector cosine distance: DocumentChunk.embedding.cosine_distance(query_embedding)
        distance_expr = DocumentChunk.embedding.cosine_distance(query_embedding)

        stmt = (
            select(DocumentChunk, distance_expr.label("distance"))
            .join(Document, DocumentChunk.document_id == Document.id)
            .where(
                Document.user_id == user_id,
                DocumentChunk.embedding.isnot(None),
            )
        )

        if document_id:
            stmt = stmt.where(DocumentChunk.document_id == document_id)

        stmt = stmt.order_by(distance_expr.asc()).limit(k)

        rows = db.execute(stmt).all()

        retrieved: List[RetrievedChunk] = []
        for chunk, dist_val in rows:
            dist = float(dist_val) if dist_val is not None else 0.0
            similarity = float(1.0 - dist)
            retrieved.append(
                RetrievedChunk(
                    chunk_id=chunk.id,
                    document_id=chunk.document_id,
                    content=chunk.content,
                    page_number=chunk.page_number,
                    chunk_index=chunk.chunk_index,
                    similarity_score=round(similarity, 6),
                    distance=round(dist, 6),
                )
            )
        return retrieved

    else:
        # Fallback for SQLite / unit-test environments without native pgvector extension
        stmt = (
            select(DocumentChunk)
            .join(Document, DocumentChunk.document_id == Document.id)
            .where(
                Document.user_id == user_id,
                DocumentChunk.embedding.isnot(None),
            )
        )

        if document_id:
            stmt = stmt.where(DocumentChunk.document_id == document_id)

        candidate_chunks = db.scalars(stmt).all()

        query_vec = np.array(query_embedding, dtype=np.float32)
        query_norm = np.linalg.norm(query_vec)
        if query_norm == 0:
            query_norm = 1.0

        scored_chunks = []
        for chunk in candidate_chunks:
            if chunk.embedding is None:
                continue
            chunk_vec = np.array(chunk.embedding, dtype=np.float32)
            chunk_norm = np.linalg.norm(chunk_vec)
            if chunk_norm == 0:
                chunk_norm = 1.0

            # Cosine similarity: (u . v) / (||u|| * ||v||)
            sim = float(np.dot(query_vec, chunk_vec) / (query_norm * chunk_norm))
            dist = float(1.0 - sim)
            scored_chunks.append((chunk, dist, sim))

        # Sort by distance ascending (nearest / most similar first)
        scored_chunks.sort(key=lambda item: item[1])
        top_scored = scored_chunks[:k]

        return [
            RetrievedChunk(
                chunk_id=chunk.id,
                document_id=chunk.document_id,
                content=chunk.content,
                page_number=chunk.page_number,
                chunk_index=chunk.chunk_index,
                similarity_score=round(sim, 6),
                distance=round(dist, 6),
            )
            for chunk, dist, sim in top_scored
        ]


def search_by_text(
    db: Session,
    user_id: str,
    query_text: str,
    document_id: Optional[str] = None,
    top_k: int = 5,
) -> List[RetrievedChunk]:
    """
    Convenience method: Embeds query text and executes vector similarity retrieval.

    Args:
        db: SQLAlchemy database session.
        user_id: ID of the authenticated user.
        query_text: User question string.
        document_id: Optional document ID filter.
        top_k: Top-k cutoff count.

    Returns:
        List of RetrievedChunk instances.
    """
    clean_query = (query_text or "").strip()
    if not clean_query:
        raise ValueError("query_text must not be empty.")

    query_embedding = generate_embedding(clean_query)
    return search_similar_chunks(
        db=db,
        user_id=user_id,
        query_embedding=query_embedding,
        document_id=document_id,
        top_k=top_k,
    )

