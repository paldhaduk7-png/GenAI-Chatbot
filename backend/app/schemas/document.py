from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class DocumentUploadResponse(BaseModel):
    """
    Response model returned upon PDF upload and text extraction.
    Does NOT return extracted text in the payload.
    """
    document_id: str
    id: Optional[str] = None
    filename: str
    status: str
    page_count: int
    pages_with_text: int
    chunk_count: Optional[int] = 0
    message: str

    model_config = ConfigDict(from_attributes=True)


class DocumentResponse(BaseModel):
    """
    Response model for document metadata and processing status.
    """
    id: str
    user_id: str
    filename: str
    file_path: str
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

