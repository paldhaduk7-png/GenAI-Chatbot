"""
Embedding service for Phase 4 Step 4.
Generates 384-dimensional vector embeddings using sentence-transformers/all-MiniLM-L6-v2.
Provides thread-safe singleton model caching, batch inference, dimension validation,
and graceful error handling.

Note:
    The SentenceTransformer model downloads weights (~80-120 MB) upon initial invocation
    and caches them locally in the Hugging Face cache directory (~/.cache/huggingface/hub).
"""
import logging
import threading
from typing import List, Optional

from sentence_transformers import SentenceTransformer

from app.config import EMBEDDING_DIMENSION, EMBEDDING_MODEL_NAME
from app.schemas.chunk import ChunkData

logger = logging.getLogger(__name__)

# Module-level thread-safe singleton cache
_model_lock = threading.Lock()
_cached_model: Optional[SentenceTransformer] = None


class EmbeddingError(Exception):
    """Raised when model loading or vector embedding generation fails."""
    pass


def get_embedding_model(model_name: Optional[str] = None) -> SentenceTransformer:
    """
    Retrieve or initialize the cached SentenceTransformer singleton instance.
    Guarantees thread-safe single initialization across concurrent requests.

    Args:
        model_name: Optional custom model identifier; defaults to EMBEDDING_MODEL_NAME.

    Returns:
        SentenceTransformer instance.

    Raises:
        EmbeddingError: If the model weights cannot be loaded.
    """
    global _cached_model

    target_model_name = model_name or EMBEDDING_MODEL_NAME

    if _cached_model is not None:
        return _cached_model

    with _model_lock:
        # Double-check pattern inside lock
        if _cached_model is not None:
            return _cached_model

        logger.info("Initializing SentenceTransformer singleton with model: %s", target_model_name)
        try:
            model = SentenceTransformer(target_model_name)
            _cached_model = model
            logger.info("SentenceTransformer model successfully loaded: %s", target_model_name)
            return _cached_model
        except Exception as exc:
            logger.error("Failed to load SentenceTransformer model '%s': %s", target_model_name, exc)
            raise EmbeddingError(f"Failed to load embedding model '{target_model_name}': {str(exc)}") from exc


def generate_embedding(text: str, model: Optional[SentenceTransformer] = None) -> List[float]:
    """
    Generate a 384-dimensional embedding for a single text string.

    Args:
        text: Input string to embed.
        model: Optional pre-loaded model instance (uses singleton if None).

    Returns:
        List of floats with length equal to EMBEDDING_DIMENSION (384).

    Raises:
        EmbeddingError: On empty input, inference failure, or dimension mismatch.
    """
    clean_text = (text or "").strip()
    if not clean_text:
        raise EmbeddingError("Cannot generate embedding for empty or whitespace-only text.")

    batch_result = generate_embeddings([clean_text], model=model, batch_size=1)
    return batch_result[0]


def generate_embeddings(
    texts: List[str],
    batch_size: int = 32,
    model: Optional[SentenceTransformer] = None,
) -> List[List[float]]:
    """
    Generate 384-dimensional vector embeddings for multiple text strings in batches.

    Args:
        texts: List of text strings to embed.
        batch_size: Batch size for model inference (default: 32).
        model: Optional SentenceTransformer instance.

    Returns:
        List of numerical float vectors, one per input string.

    Raises:
        EmbeddingError: If model inference fails or vector dimension does not equal 384.
    """
    if not texts:
        return []

    transformer = model or get_embedding_model()

    try:
        # Generate embeddings as numpy arrays
        embeddings_array = transformer.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
    except Exception as exc:
        logger.error("Embedding generation failed for batch of %d items: %s", len(texts), exc)
        raise EmbeddingError(f"Failed to generate embeddings: {str(exc)}") from exc

    # Convert to pure Python List[List[float]] and validate dimensions
    embeddings_list: List[List[float]] = []
    for idx, vec in enumerate(embeddings_array):
        vector = [float(x) for x in vec]
        actual_dim = len(vector)
        if actual_dim != EMBEDDING_DIMENSION:
            raise EmbeddingError(
                f"Embedding dimension mismatch at index {idx}: expected {EMBEDDING_DIMENSION}, got {actual_dim}."
            )
        embeddings_list.append(vector)

    return embeddings_list


def embed_chunks(
    chunks: List[ChunkData],
    batch_size: int = 32,
    model: Optional[SentenceTransformer] = None,
) -> List[ChunkData]:
    """
    Enrich a list of ChunkData instances with their corresponding vector embeddings.
    Embeddings are computed in batches. Does NOT store records in PostgreSQL (Step 4 scope).

    Args:
        chunks: List of ChunkData objects.
        batch_size: Batch size for model inference (default: 32).
        model: Optional SentenceTransformer instance.

    Returns:
        The updated list of ChunkData with 'embedding' populated.
    """
    if not chunks:
        return []

    texts = [chunk.content for chunk in chunks]
    vectors = generate_embeddings(texts, batch_size=batch_size, model=model)

    for chunk, vector in zip(chunks, vectors):
        chunk.embedding = vector

    logger.info("Successfully generated embeddings for %d chunks", len(chunks))
    return chunks

