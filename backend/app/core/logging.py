"""
Structured logging configuration and request-scoped Request ID context management.
Supports JSON-formatted logs in production and readable structured logs in development,
with automatic Request ID injection via contextvars and privacy-safe redaction.
"""
import json
import logging
import re
import sys
import uuid
from contextvars import ContextVar, Token
from datetime import datetime, timezone
from typing import Any, Dict, Optional

REQUEST_ID_HEADER = "X-Request-ID"
MAX_REQUEST_ID_LENGTH = 64
_VALID_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")

# Patterns for defensive redaction of accidental secret leakage in log messages
_BEARER_TOKEN_PATTERN = re.compile(r"(Bearer\s+)[A-Za-z0-9\-._~+/]+=*", re.IGNORECASE)
_SECRET_KEY_PATTERN = re.compile(r"\b(sk-[A-Za-z0-9]{16,}|AIza[0-9A-Za-z\-_]{20,})\b")

# Allowlisted structured extra attributes included in log records
_ALLOWLISTED_EXTRA_FIELDS = (
    "event",
    "method",
    "path",
    "status_code",
    "duration_ms",
    "provider",
    "operation",
    "attempt",
    "max_attempts",
    "reason",
    "delay_s",
    "retry_after_used",
    "document_id",
    "chunk_count",
    "page_count",
    "pages_with_text",
)

# Request-local context variable for Request ID isolation across concurrent requests
_request_id_ctx: ContextVar[Optional[str]] = ContextVar("request_id", default=None)


def get_request_id() -> Optional[str]:
    """Return the current request's ID from contextvars, or None if outside a request."""
    return _request_id_ctx.get()


def set_request_id(request_id: Optional[str]) -> Token:
    """Bind a request ID to the current execution context and return a reset token."""
    return _request_id_ctx.set(request_id)


def reset_request_id(token: Token) -> None:
    """Restore the previous request ID context using the token from set_request_id."""
    _request_id_ctx.reset(token)


def is_valid_request_id(value: Optional[str]) -> bool:
    """
    Validate an incoming X-Request-ID header value.
    Rejects empty, oversized (>64 chars), control characters, whitespace, and unsafe characters.
    """
    if not value or not isinstance(value, str):
        return False
    stripped = value.strip()
    if not stripped or len(stripped) > MAX_REQUEST_ID_LENGTH:
        return False
    # Reject if original value had leading/trailing whitespace or control characters
    if stripped != value:
        return False
    return bool(_VALID_REQUEST_ID_PATTERN.match(stripped))


def validate_or_generate_request_id(incoming: Optional[str]) -> str:
    """Return the incoming request ID if valid and safe, otherwise generate a fresh UUID4."""
    if is_valid_request_id(incoming):
        return incoming  # type: ignore[return-value]
    return str(uuid.uuid4())


def sanitize_log_message(message: str) -> str:
    """Defensively redact accidental Bearer tokens or API key patterns from log strings."""
    if not message:
        return message
    sanitized = _BEARER_TOKEN_PATTERN.sub(r"\1[REDACTED]", message)
    sanitized = _SECRET_KEY_PATTERN.sub("[REDACTED_KEY]", sanitized)
    return sanitized


class RequestContextFilter(logging.Filter):
    """Injects the current contextvar request_id onto every LogRecord."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id") or record.request_id is None:
            record.request_id = get_request_id()
        return True


class StructuredJsonFormatter(logging.Formatter):
    """Formats log records as single-line JSON objects for production observability."""

    def format(self, record: logging.LogRecord) -> str:
        timestamp = datetime.fromtimestamp(record.created, tz=timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%S.%f"
        )[:-3] + "Z"

        payload: Dict[str, Any] = {
            "timestamp": timestamp,
            "level": record.levelname,
            "logger": record.name,
            "message": sanitize_log_message(record.getMessage()),
        }

        request_id = getattr(record, "request_id", None) or get_request_id()
        if request_id:
            payload["request_id"] = request_id

        for field in _ALLOWLISTED_EXTRA_FIELDS:
            val = getattr(record, field, None)
            if val is not None:
                payload[field] = val

        if record.exc_info and record.exc_info[0] is not None:
            payload["exception"] = sanitize_log_message(self.formatException(record.exc_info))

        return json.dumps(payload, default=str, ensure_ascii=False)


class DevConsoleFormatter(logging.Formatter):
    """Human-readable structured formatter for local development."""

    def format(self, record: logging.LogRecord) -> str:
        timestamp = datetime.fromtimestamp(record.created, tz=timezone.utc).strftime(
            "%Y-%m-%d %H:%M:%S"
        )
        request_id = getattr(record, "request_id", None) or get_request_id()
        req_part = f" [req:{request_id}]" if request_id else ""
        msg = sanitize_log_message(record.getMessage())

        extras = []
        for field in _ALLOWLISTED_EXTRA_FIELDS:
            val = getattr(record, field, None)
            if val is not None:
                extras.append(f"{field}={val}")
        extra_str = f" | {' '.join(extras)}" if extras else ""

        line = f"{timestamp} | {record.levelname:<7}{req_part} | {record.name} | {msg}{extra_str}"
        if record.exc_info and record.exc_info[0] is not None:
            line += "\n" + sanitize_log_message(self.formatException(record.exc_info))
        return line


def configure_logging(environment: str = "development", log_level: str = "INFO", log_format: str = "auto") -> None:
    """
    Configure root logging safely without creating duplicate handlers.
    Uses JSON formatting in production/staging and readable structured logs in development.
    """
    root_logger = logging.getLogger()

    numeric_level = getattr(logging, (log_level or "INFO").upper(), logging.INFO)
    root_logger.setLevel(numeric_level)

    env_lower = (environment or "development").strip().lower()
    fmt_lower = (log_format or "auto").strip().lower()
    use_json = fmt_lower == "json" or (fmt_lower == "auto" and env_lower in {"production", "prod", "staging"})

    formatter: logging.Formatter = StructuredJsonFormatter() if use_json else DevConsoleFormatter()

    # Reuse existing app-managed handler if already configured to prevent duplicate logs
    app_handler = None
    for handler in root_logger.handlers:
        if getattr(handler, "_is_genai_app_handler", False):
            app_handler = handler
            break

    if app_handler is None:
        # Remove unformatted default StreamHandlers only if we are installing the primary app handler
        if not root_logger.handlers:
            app_handler = logging.StreamHandler(sys.stdout)
            app_handler._is_genai_app_handler = True  # type: ignore[attr-defined]
            root_logger.addHandler(app_handler)
        else:
            # Integrate with existing handlers (e.g., pytest caplog or uvicorn) without duplicating
            app_handler = root_logger.handlers[0]
            app_handler._is_genai_app_handler = True  # type: ignore[attr-defined]

    app_handler.setFormatter(formatter)

    # Ensure RequestContextFilter is attached once to the root handler(s)
    for handler in root_logger.handlers:
        if not any(isinstance(f, RequestContextFilter) for f in handler.filters):
            handler.addFilter(RequestContextFilter())
