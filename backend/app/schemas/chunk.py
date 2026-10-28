"""
Data schemas for text chunks and vector embeddings.
Matches the structure expected by the DocumentChunk database model without committing data to PostgreSQL.
"""
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ChunkData(BaseModel):
    """
    Represents an individual text chunk extracted from a document,
    annotated with its sequential chunk index, originating page number,
    optional 384-dimensional embedding, and metadata dictionary.
    """
    chunk_index: int = Field(..., description="Zero-based sequential index of the chunk in the document")
    content: str = Field(..., min_length=1, description="Non-empty text content of the chunk")
    page_number: Optional[int] = Field(None, description="Original page number where text originated (1-indexed)")
    embedding: Optional[List[float]] = Field(None, description="384-dimensional vector embedding")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional chunk or document metadata")

    model_config = ConfigDict(from_attributes=True)


class RetrievedChunk(BaseModel):
    """
    Represents a chunk returned from a vector similarity retrieval query.
    """
    chunk_id: str = Field(..., description="Unique ID of the document chunk")
    document_id: str = Field(..., description="ID of the parent document")
    content: str = Field(..., description="Text content of the retrieved chunk")
    page_number: Optional[int] = Field(None, description="Source page number")
    chunk_index: int = Field(..., description="Sequential index within the document")
    similarity_score: float = Field(..., description="Cosine similarity score (higher is more similar)")
    distance: float = Field(..., description="Cosine distance metric (lower is closer)")

    model_config = ConfigDict(from_attributes=True)


class VectorSearchRequest(BaseModel):
    """
    Request model for vector similarity retrieval.
    """
    query: str = Field(..., min_length=1, description="Search query string")
    document_id: Optional[str] = Field(None, description="Optional document filter")
    top_k: int = Field(5, ge=1, le=50, description="Maximum number of relevant chunks to return")


class VectorSearchResponse(BaseModel):
    """
    Response model containing retrieved relevant chunks.
    """
    query: str
    results: List[RetrievedChunk]
    total_results: int

    model_config = ConfigDict(from_attributes=True)

