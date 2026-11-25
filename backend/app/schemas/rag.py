"""
Data schemas for Phase 4 Step 6: RAG Chain with LangChain Runnables (LCEL).
Defines request, response, and source reference models for grounded retrieval-augmented generation.
"""
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class RAGSource(BaseModel):
    """
    Preserved source citation metadata for a retrieved document chunk.
    """
    document_id: str = Field(..., description="UUID of the source document")
    document_filename: str = Field(..., description="Original filename of the document")
    page_number: Optional[int] = Field(None, description="Page number where the chunk originated (1-indexed)")
    chunk_id: str = Field(..., description="UUID of the retrieved document chunk")
    similarity_score: Optional[float] = Field(None, description="Cosine similarity score (higher is more relevant)")

    model_config = ConfigDict(from_attributes=True)


class RAGRequest(BaseModel):
    """
    Request model for RAG question-answering.
    """
    question: str = Field(..., min_length=1, description="User question for RAG")
    document_id: Optional[str] = Field(None, description="Optional document ID to restrict retrieval")
    top_k: int = Field(5, ge=1, le=50, description="Maximum number of relevant chunks to retrieve")
    conversation_id: Optional[str] = Field(None, description="Optional conversation ID for context continuity")


class RAGResponse(BaseModel):
    """
    Response model containing grounded answer, source references, and provider metadata.
    """
    answer: str = Field(..., description="Synthesized answer grounded in document context")
    sources: List[RAGSource] = Field(default_factory=list, description="Preserved source references for retrieved chunks")
    provider: str = Field(..., description="AI model provider that generated the response (e.g. mistral, gemini)")
    has_sufficient_context: bool = Field(..., description="Whether relevant document context was retrieved")

    model_config = ConfigDict(from_attributes=True)
