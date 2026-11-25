"""Services package initialization."""
from app.services.cloudinary_service import (
    delete_file,
    get_signed_download_url,
    init_cloudinary,
    upload_pdf_file,
)
from app.services.document_chunk_service import (
    ChunkPersistenceError,
    persist_document_chunks,
)
from app.services.embedding_service import (
    EmbeddingError,
    embed_chunks,
    generate_embedding,
    generate_embeddings,
    get_embedding_model,
)
from app.services.llm_service import generate_chat_response
from app.services.pdf_service import (
    MAX_UPLOAD_SIZE_BYTES,
    PDFExtractionError,
    extract_text_from_pdf,
    validate_pdf_content,
    validate_pdf_metadata,
)
from app.services.retrieval_service import (
    search_by_text,
    search_similar_chunks,
)
from app.services.rag_prompts import get_rag_prompt_template
from app.services.rag_service import (
    build_rag_chain,
    execute_rag,
    get_rag_chain,
)
from app.services.text_splitter_service import (
    DEFAULT_CHUNK_OVERLAP,
    DEFAULT_CHUNK_SIZE,
    get_text_splitter,
    split_document_pages,
    split_text,
)

__all__ = [
    "generate_chat_response",
    "init_cloudinary",
    "upload_pdf_file",
    "delete_file",
    "get_signed_download_url",
    "MAX_UPLOAD_SIZE_BYTES",
    "PDFExtractionError",
    "validate_pdf_metadata",
    "validate_pdf_content",
    "extract_text_from_pdf",
    "DEFAULT_CHUNK_SIZE",
    "DEFAULT_CHUNK_OVERLAP",
    "get_text_splitter",
    "split_document_pages",
    "split_text",
    "EmbeddingError",
    "get_embedding_model",
    "generate_embedding",
    "generate_embeddings",
    "embed_chunks",
    "persist_document_chunks",
    "ChunkPersistenceError",
    "search_similar_chunks",
    "search_by_text",
    "get_rag_prompt_template",
    "build_rag_chain",
    "get_rag_chain",
    "execute_rag",
]
