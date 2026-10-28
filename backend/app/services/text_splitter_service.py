"""
Text splitting service for Phase 4 Step 4.
Splits document text into manageable, overlapping chunks using LangChain's RecursiveCharacterTextSplitter.
Preserves page numbers, generates sequential zero-based chunk indices, and rejects empty chunks.
"""
import logging
from typing import Any, Dict, List, Optional

from langchain_core.documents import Document as LangChainDocument
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.schemas.chunk import ChunkData

logger = logging.getLogger(__name__)

DEFAULT_CHUNK_SIZE = 1000
DEFAULT_CHUNK_OVERLAP = 200
DEFAULT_SEPARATORS = ["\n\n", "\n", " ", ""]


def get_text_splitter(
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
    separators: Optional[List[str]] = None,
) -> RecursiveCharacterTextSplitter:
    """
    Factory function returning a configured RecursiveCharacterTextSplitter instance.

    Args:
        chunk_size: Maximum characters per chunk (default: 1000).
        chunk_overlap: Overlapping character count between adjacent chunks (default: 200).
        separators: Priority list of string separators (default: ["\n\n", "\n", " ", ""]).

    Returns:
        Configured RecursiveCharacterTextSplitter.
    """
    if chunk_overlap >= chunk_size:
        raise ValueError(
            f"chunk_overlap ({chunk_overlap}) must be strictly less than chunk_size ({chunk_size})"
        )

    return RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=separators or DEFAULT_SEPARATORS,
        strip_whitespace=True,
    )


def split_document_pages(
    pages: List[Dict[str, Any]],
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
    document_id: Optional[str] = None,
) -> List[ChunkData]:
    """
    Split page-extracted PDF content into sequential chunks while strictly preserving page numbers.

    Source-Page Attribution Strategy:
        Each page's text is chunked within that page boundary with the specified overlap.
        This provides unambiguous, 1:1 attribution so every chunk is tied directly to its
        originating page_number. Empty or whitespace-only pages/chunks are cleanly omitted.
        Sequential chunk_index increments monotonically starting from 0 across the entire document.

    Args:
        pages: List of page dictionaries, each containing 'page_number' and 'text'.
        chunk_size: Target maximum characters per chunk.
        chunk_overlap: Overlap between adjacent chunks within a page.
        document_id: Optional ID of the parent document for metadata tracing.

    Returns:
        List of ChunkData objects with chunk_index, content, and page_number.
    """
    if not pages:
        return []

    splitter = get_text_splitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    chunks: List[ChunkData] = []
    current_chunk_index = 0

    for page in pages:
        page_num = page.get("page_number")
        raw_text = page.get("text") or ""
        clean_text = raw_text.strip()

        if not clean_text:
            continue

        page_chunks = splitter.split_text(clean_text)

        for text in page_chunks:
            trimmed = text.strip()
            if not trimmed:
                continue

            metadata: Dict[str, Any] = {
                "char_length": len(trimmed),
            }
            if document_id:
                metadata["document_id"] = document_id
            if page_num is not None:
                metadata["page_number"] = page_num

            chunks.append(
                ChunkData(
                    chunk_index=current_chunk_index,
                    content=trimmed,
                    page_number=page_num,
                    metadata=metadata,
                )
            )
            current_chunk_index += 1

    logger.info(
        "Split %d pages into %d chunks (chunk_size=%d, chunk_overlap=%d)",
        len(pages),
        len(chunks),
        chunk_size,
        chunk_overlap,
    )
    return chunks


def split_text(
    text: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
    page_number: Optional[int] = None,
    document_id: Optional[str] = None,
) -> List[ChunkData]:
    """
    Split a raw text string into non-empty sequential chunks.

    Args:
        text: Plaintext string to split.
        chunk_size: Maximum characters per chunk.
        chunk_overlap: Overlapping character count.
        page_number: Optional single page number to assign to all resulting chunks.
        document_id: Optional document ID.

    Returns:
        List of ChunkData objects with zero-based chunk indices.
    """
    clean_text = (text or "").strip()
    if not clean_text:
        return []

    splitter = get_text_splitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
    raw_chunks = splitter.split_text(clean_text)

    chunks: List[ChunkData] = []
    for idx, chunk_text in enumerate(raw_chunks):
        trimmed = chunk_text.strip()
        if not trimmed:
            continue

        metadata: Dict[str, Any] = {
            "char_length": len(trimmed),
        }
        if document_id:
            metadata["document_id"] = document_id
        if page_number is not None:
            metadata["page_number"] = page_number

        chunks.append(
            ChunkData(
                chunk_index=len(chunks),
                content=trimmed,
                page_number=page_number,
                metadata=metadata,
            )
        )

    return chunks

