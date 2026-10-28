"""
PDF validation and text extraction service using PyPDFLoader from langchain-community.
Enforces file format, magic bytes, size limits, and graceful error handling.
Does NOT perform chunking or embedding generation (Phase 4 Step 3 scope).
"""
import logging
import os
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from langchain_community.document_loaders import PyPDFLoader

logger = logging.getLogger(__name__)

# Maximum allowed upload size: 10 MB
MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"application/pdf", "application/x-pdf"}
PDF_MAGIC_BYTES = b"%PDF"


class PDFExtractionError(Exception):
    """Raised when PDF text extraction fails due to malformed or corrupted file content."""
    pass


def validate_pdf_metadata(
    filename: Optional[str],
    content_type: Optional[str],
) -> None:
    """
    Validate the filename extension and MIME content type.

    Raises:
        HTTPException(400): If the extension or content-type is not a valid PDF.
    """
    if not filename or not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file extension. Only .pdf files are accepted.",
        )

    if not content_type or content_type.lower() not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid content type '{content_type}'. Must be 'application/pdf'.",
        )


def validate_pdf_content(header_bytes: bytes, total_size: int) -> None:
    """
    Validate PDF magic bytes signature and non-empty file size.

    Raises:
        HTTPException(400): If empty or signature does not start with %PDF.
    """
    if total_size <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes).",
        )

    if not header_bytes.startswith(PDF_MAGIC_BYTES):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File signature validation failed. The uploaded file is not a valid PDF.",
        )


def extract_text_from_pdf(pdf_path: str) -> Dict[str, Any]:
    """
    Extract text page-by-page from a local PDF file using PyPDFLoader.

    Preserves original page numbers and detects documents with no extractable text.
    Handles malformed PDFs gracefully.

    Args:
        pdf_path: Local path to the PDF file.

    Returns:
        Dict containing:
            - total_pages: Total number of pages
            - pages_with_text: Number of pages with extractable text
            - has_extractable_text: True if at least one page has non-empty text
            - pages: List of dicts with page_number and text_length

    Raises:
        PDFExtractionError: If PyPDFLoader fails to parse the PDF.
    """
    if not os.path.exists(pdf_path):
        raise PDFExtractionError(f"File not found at path: {pdf_path}")

    try:
        loader = PyPDFLoader(pdf_path)
        pages = loader.load()
    except Exception as exc:
        logger.error("PyPDFLoader failed to parse PDF at %s: %s", pdf_path, exc)
        raise PDFExtractionError(f"Failed to read or parse PDF structure: {str(exc)}") from exc

    total_pages = len(pages)
    if total_pages == 0:
        raise PDFExtractionError("PDF contains 0 pages or could not be parsed.")

    pages_with_text = 0
    pages_summary: List[Dict[str, Any]] = []

    for idx, page in enumerate(pages):
        # PyPDFLoader assigns 0-indexed 'page' in metadata; original page number is index + 1
        page_num = page.metadata.get("page", idx) + 1 if isinstance(page.metadata.get("page"), int) else (idx + 1)
        raw_text = page.page_content or ""
        clean_text = raw_text.strip()
        has_text = len(clean_text) > 0

        if has_text:
            pages_with_text += 1

        pages_summary.append(
            {
                "page_number": page_num,
                "text": clean_text,
                "text_length": len(clean_text),
                "has_text": has_text,
            }
        )

    has_extractable_text = pages_with_text > 0

    logger.info(
        "Extracted PDF %s: %d total pages, %d pages with text (has_extractable_text=%s)",
        pdf_path,
        total_pages,
        pages_with_text,
        has_extractable_text,
    )

    return {
        "total_pages": total_pages,
        "pages_with_text": pages_with_text,
        "has_extractable_text": has_extractable_text,
        "pages": pages_summary,
    }

