/**
 * TypeScript definitions for Document Management and Selection in RAG operations.
 */

export type DocumentProcessingStatus = "pending" | "processing" | "completed" | "failed";

/**
 * Represents an uploaded document entity returned by GET /api/documents.
 */
export interface DocumentItem {
  id: string;
  user_id?: string;
  filename: string;
  file_path?: string;
  status: DocumentProcessingStatus;
  created_at: string;
  updated_at?: string;
  page_count?: number;
  chunk_count?: number;
}

/**
 * Response payload returned upon PDF upload at POST /api/documents/upload.
 */
export interface DocumentUploadResponse {
  document_id: string;
  id?: string;
  filename: string;
  status: DocumentProcessingStatus;
  page_count: number;
  pages_with_text: number;
  chunk_count?: number;
  message: string;
}

/**
 * Response payload returned upon document deletion at DELETE /api/documents/{id}.
 */
export interface DocumentDeleteResponse {
  message: string;
  document_id: string;
}
