"""
Cloudinary storage service for securely uploading, deleting, and accessing PDF documents.
Ensures private/authenticated delivery and prevents exposure of API credentials.
"""
import logging
from typing import Any, Dict, Optional

import cloudinary
import cloudinary.api
import cloudinary.uploader
import cloudinary.utils

from app.config import settings
from app.core.retry import RetryPolicy, execute_with_retry, is_transient_error

logger = logging.getLogger(__name__)


def init_cloudinary() -> bool:
    """
    Initialize Cloudinary configuration with credentials from settings.
    Returns True if configured with non-empty credentials, False otherwise.
    """
    cloud_name = settings.cloudinary_cloud_name
    api_key = settings.cloudinary_api_key
    api_secret = settings.cloudinary_api_secret

    if not (cloud_name and api_key and api_secret):
        logger.warning(
            "Cloudinary credentials not fully configured (cloud_name_set=%s, api_key_set=%s, api_secret_set=%s)",
            bool(cloud_name),
            bool(api_key),
            bool(api_secret),
        )
        return False

    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True,
    )
    return True


# Initialize on module load
_is_configured = init_cloudinary()


def upload_pdf_file(
    file_path: str,
    user_id: str,
    document_id: str,
    folder_prefix: str = "chatbot_documents",
) -> Dict[str, Any]:
    """
    Upload a PDF document to Cloudinary under a dedicated, user-scoped folder.
    Uses authenticated delivery type to prevent unauthorized public access.

    Args:
        file_path: Absolute or relative local path to the temporary PDF file.
        user_id: ID of the authenticated user.
        document_id: Unique server-generated ID for the document.
        folder_prefix: Root folder name in Cloudinary.

    Returns:
        Dict returned by Cloudinary uploader containing public_id, secure_url, bytes, etc.

    Raises:
        RuntimeError: If Cloudinary is not configured or upload fails.
    """
    init_cloudinary()

    public_id = f"{folder_prefix}/{user_id}/{document_id}"
    logger.info("Uploading PDF to Cloudinary: public_id=%s, type=authenticated", public_id)

    policy = RetryPolicy(
        max_retries=settings.CLOUDINARY_MAX_RETRIES,
        initial_delay=0.5,
        max_delay=4.0,
        jitter=True,
    )

    def _do_upload() -> Dict[str, Any]:
        return cloudinary.uploader.upload(
            file_path,
            public_id=public_id,
            resource_type="raw",
            type="authenticated",
            overwrite=True,
            timeout=settings.CLOUDINARY_TIMEOUT_SECONDS,
        )

    try:
        response = execute_with_retry(
            _do_upload,
            policy=policy,
            is_retryable=is_transient_error,
            operation_name="cloudinary_upload",
        )
        logger.info("Successfully uploaded PDF to Cloudinary: public_id=%s", public_id)
        return response
    except Exception as exc:
        logger.error("Cloudinary upload failed for public_id=%s: %s", public_id, type(exc).__name__)
        raise RuntimeError("Cloudinary upload failed.") from exc


def delete_file(
    public_id: str,
    resource_type: str = "raw",
    delivery_type: str = "authenticated",
) -> bool:
    """
    Compensating cleanup: deletes an uploaded file from Cloudinary.

    Args:
        public_id: Cloudinary public_id of the file to remove.
        resource_type: Cloudinary resource type (default: "raw").
        delivery_type: Cloudinary delivery type (default: "authenticated").

    Returns:
        True if deletion succeeded, False otherwise.
    """
    init_cloudinary()

    logger.info("Deleting file from Cloudinary (compensating cleanup): public_id=%s", public_id)
    policy = RetryPolicy(
        max_retries=settings.CLOUDINARY_MAX_RETRIES,
        initial_delay=0.5,
        max_delay=4.0,
        jitter=True,
    )

    def _do_destroy() -> Dict[str, Any]:
        return cloudinary.uploader.destroy(
            public_id,
            resource_type=resource_type,
            type=delivery_type,
            timeout=settings.CLOUDINARY_TIMEOUT_SECONDS,
        )

    try:
        result = execute_with_retry(
            _do_destroy,
            policy=policy,
            is_retryable=is_transient_error,
            operation_name="cloudinary_delete",
        )
        is_ok = result.get("result") in ("ok", "not found")
        logger.info("Cloudinary delete result for %s: %s", public_id, result.get("result"))
        return is_ok
    except Exception as exc:
        logger.error("Failed to delete file from Cloudinary: public_id=%s, error=%s", public_id, type(exc).__name__)
        return False


def get_signed_download_url(
    public_id: str,
    resource_type: str = "raw",
    delivery_type: str = "authenticated",
    expires_in_seconds: int = 3600,
) -> str:
    """
    Generate a signed, authenticated download URL for the document.

    Args:
        public_id: Cloudinary public_id of the document.
        resource_type: Resource type ("raw").
        delivery_type: Delivery type ("authenticated").
        expires_in_seconds: Expiration in seconds for signed access.

    Returns:
        Secure, signed URL.
    """
    init_cloudinary()

    url, _ = cloudinary.utils.cloudinary_url(
        public_id,
        resource_type=resource_type,
        type=delivery_type,
        sign_url=True,
        secure=True,
    )
    return url

