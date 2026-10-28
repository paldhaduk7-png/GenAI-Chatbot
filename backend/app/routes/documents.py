"""
Document management routes for Phase 4 Step 3: PDF Upload and Text Extraction.
Handles authenticated PDF upload, secure Cloudinary storage, PDF text extraction,
and document lifecycle status management.
"""
import logging
import os
import tempfile
import uuid
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.models import Document, User
from app.db.session import get_db
from app.schemas.chunk import VectorSearchRequest, VectorSearchResponse
from app.schemas.document import DocumentResponse, DocumentUploadResponse
from app.services.cloudinary_service import delete_file, upload_pdf_file
from app.services.document_chunk_service import persist_document_chunks
from app.services.embedding_service import embed_chunks
from app.services.pdf_service import (
    MAX_UPLOAD_SIZE_BYTES,
    PDFExtractionError,
    extract_text_from_pdf,
    validate_pdf_content,
    validate_pdf_metadata,
)
from app.services.retrieval_service import search_by_text
from app.services.text_splitter_service import split_document_pages

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.post("/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentUploadResponse:
    """
    POST /api/documents/upload
    Authenticated PDF upload and text extraction.
    - Validates file extension, content-type, magic bytes, and max size (10 MB).
    - Stores document with initial 'pending' status in database.
    - Securely uploads PDF to Cloudinary under authenticated delivery mode.
    - Updates status to 'processing' and performs page-level text extraction with PyPDFLoader.
    - Updates status to 'completed' on success or 'failed' on failure.
    - Performs compensating cleanup of orphaned Cloudinary files on extraction failure.
    - Reliably cleans up temporary files.
    - Does NOT return extracted text in the API response.
    """
    # 1. Validate filename and content-type metadata
    validate_pdf_metadata(file.filename, file.content_type)

    # 2. Stream uploaded file into a secure temporary file while strictly enforcing size limit
    temp_file = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_path = temp_file.name
    total_size = 0
    header_bytes = b""

    try:
        chunk_size = 64 * 1024  # 64 KB chunks
        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            if not header_bytes:
                header_bytes = chunk[:16]
            total_size += len(chunk)
            if total_size > MAX_UPLOAD_SIZE_BYTES:
                temp_file.close()
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
                    if hasattr(status, "HTTP_413_CONTENT_TOO_LARGE")
                    else 413,
                    detail=f"File exceeds maximum allowed upload size of {MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB.",
                )
            temp_file.write(chunk)
        temp_file.flush()
        temp_file.close()

        # 3. Validate content signature and non-emptiness
        validate_pdf_content(header_bytes, total_size)

        # 4. Generate unique server-side identifier and safe sanitized filename
        doc_id = str(uuid.uuid4())
        safe_filename = os.path.basename(file.filename or f"document_{doc_id}.pdf")
        storage_reference = f"chatbot_documents/{current_user.id}/{doc_id}"

        # 5. Create initial document record with 'pending' status
        document = Document(
            id=doc_id,
            user_id=current_user.id,
            filename=safe_filename,
            file_path=storage_reference,
            status="pending",
        )
        db.add(document)
        db.commit()
        db.refresh(document)

        # 6. Upload PDF to Cloudinary under authenticated mode
        try:
            upload_pdf_file(
                file_path=temp_path,
                user_id=current_user.id,
                document_id=doc_id,
                folder_prefix="chatbot_documents",
            )
        except Exception as upload_exc:
            logger.error("Storage upload failed for document %s: %s", doc_id, upload_exc)
            document.status = "failed"
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to securely upload document to storage provider.",
            ) from upload_exc

        # 7. Transition status to 'processing'
        document.status = "processing"
        db.commit()

        # 8. Extract PDF text page-by-page
        try:
            extraction = extract_text_from_pdf(temp_path)
        except (PDFExtractionError, Exception) as extract_exc:
            logger.error("PDF text extraction failed for document %s: %s", doc_id, extract_exc)
            document.status = "failed"
            db.commit()
            delete_file(storage_reference)
            raise HTTPException(
                status_code=422,
                detail=f"PDF extraction failed: {str(extract_exc)}",
            ) from extract_exc

        # 9. Chunking, Embedding Generation, and Persistence (Step 5)
        chunk_count = 0
        try:
            if extraction["pages_with_text"] > 0:
                chunks = split_document_pages(
                    pages=extraction["pages"],
                    document_id=document.id,
                )
                if chunks:
                    enriched_chunks = embed_chunks(chunks)
                    persisted_chunks = persist_document_chunks(
                        db=db,
                        document_id=document.id,
                        user_id=current_user.id,
                        chunks=enriched_chunks,
                    )
                    chunk_count = len(persisted_chunks)

            # Mark completed only after chunks and embeddings are persisted
            document.status = "completed"
            db.commit()

        except Exception as proc_exc:
            logger.error(
                "Chunking, embedding, or persistence failed for document %s: %s",
                doc_id,
                proc_exc,
                exc_info=True,
            )
            db.rollback()
            # Update status to failed in a clean transaction
            try:
                document.status = "failed"
                db.commit()
            except Exception as status_err:
                logger.error("Failed to update status to failed for %s: %s", doc_id, status_err)

            delete_file(storage_reference)
            raise HTTPException(
                status_code=422,
                detail=f"Document processing failed during chunking/embedding persistence: {str(proc_exc)}",
            ) from proc_exc

        # 10. Formulate appropriate user-facing message
        if extraction["pages_with_text"] == 0:
            message = "Document uploaded successfully, but no extractable text was found (pages may be scanned images)."
        else:
            message = (
                f"Document uploaded and text extracted successfully from {extraction['pages_with_text']} "
                f"of {extraction['total_pages']} pages ({chunk_count} chunks indexed)."
            )

        return DocumentUploadResponse(
            document_id=document.id,
            id=document.id,
            filename=document.filename,
            status=document.status,
            page_count=extraction["total_pages"],
            pages_with_text=extraction["pages_with_text"],
            chunk_count=chunk_count,
            message=message,
        )

    finally:
        # Reliably clean up the temporary file
        try:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
        except Exception as clean_err:
            logger.warning("Could not unlink temp file %s: %s", temp_path, clean_err)


@router.get("", response_model=List[DocumentResponse])
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[DocumentResponse]:
    """
    GET /api/documents
    List all documents owned by the authenticated user.
    """
    stmt = (
        select(Document)
        .where(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
    )
    documents = db.scalars(stmt).all()
    return list(documents)


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentResponse:
    """
    GET /api/documents/{document_id}
    Retrieve details and status of a document owned by the authenticated user.
    Returns 404 if not found or belongs to another user.
    """
    stmt = select(Document).where(
        Document.id == document_id,
        Document.user_id == current_user.id,
    )
    document = db.scalar(stmt)
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )
    return document


@router.delete("/{document_id}", status_code=status.HTTP_200_OK)
def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    DELETE /api/documents/{document_id}
    Delete a document owned by current_user from the database and Cloudinary.
    """
    stmt = select(Document).where(
        Document.id == document_id,
        Document.user_id == current_user.id,
    )
    document = db.scalar(stmt)
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    storage_ref = document.file_path
    db.delete(document)
    db.commit()

    if storage_ref:
        delete_file(storage_ref)

    return {"message": "Document deleted successfully", "document_id": document_id}


@router.post("/search", response_model=VectorSearchResponse)
def search_documents(
    payload: VectorSearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> VectorSearchResponse:
    """
    POST /api/documents/search
    Perform semantic vector similarity search across document chunks.
    Strictly scoped to documents owned by the authenticated user.
    """
    results = search_by_text(
        db=db,
        user_id=current_user.id,
        query_text=payload.query,
        document_id=payload.document_id,
        top_k=payload.top_k,
    )
    return VectorSearchResponse(
        query=payload.query,
        results=results,
        total_results=len(results),
    )

