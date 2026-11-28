import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.exception_handlers import (
    http_exception_handler,
    request_validation_exception_handler,
)
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import DEFAULT_DEV_JWT_SECRET, settings
from app.core.deps import limiter, rate_limit_exceeded_handler
from app.core.logging import (
    REQUEST_ID_HEADER,
    configure_logging,
    reset_request_id,
    set_request_id,
    validate_or_generate_request_id,
)
from app.db import Base, Conversation, Document, DocumentChunk, Message as DbMessage, engine
from app.routes.auth import router as auth_router
from app.routes.chat import router as chat_router
from app.routes.conversations import router as conversations_router
from app.routes.documents import router as documents_router

configure_logging(
    environment=settings.ENVIRONMENT,
    log_level=settings.LOG_LEVEL,
    log_format=settings.LOG_FORMAT,
)

logger = logging.getLogger(__name__)


class RequestContextMiddleware:
    """
    Pure ASGI middleware that assigns a validated or generated X-Request-ID
    to each HTTP request, binds it to contextvars for request-scoped logging,
    logs request lifecycle (start/completion/duration), and sets X-Request-ID
    on every HTTP response (including errors).
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Extract incoming X-Request-ID header (case-insensitive)
        incoming_id = None
        for header_name, header_val in scope.get("headers", []):
            if header_name.lower() == b"x-request-id":
                try:
                    incoming_id = header_val.decode("latin-1")
                except Exception:
                    incoming_id = None
                break

        request_id = validate_or_generate_request_id(incoming_id)
        token = set_request_id(request_id)
        start_time = time.perf_counter()

        method = scope.get("method", "")
        path = scope.get("path", "")  # Excludes query_string to avoid logging sensitive params
        status_code = 500
        unhandled_error = False

        try:
            logger.info(
                "Request started: %s %s",
                method,
                path,
                extra={"event": "request_started", "method": method, "path": path},
            )
        except Exception:
            pass

        async def send_with_request_id(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message.get("status", 500)
                raw_headers = [
                    (k, v)
                    for k, v in message.get("headers", [])
                    if k.lower() != b"x-request-id"
                ]
                raw_headers.append((b"x-request-id", request_id.encode("ascii")))
                message["headers"] = raw_headers
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        except Exception:
            unhandled_error = True
            raise
        finally:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            try:
                log_extra = {
                    "event": "request_completed",
                    "method": method,
                    "path": path,
                    "status_code": status_code,
                    "duration_ms": duration_ms,
                }
                if unhandled_error or status_code >= 500:
                    logger.error(
                        "Request failed: %s %s -> %d (%.2fms)",
                        method,
                        path,
                        status_code,
                        duration_ms,
                        extra=log_extra,
                    )
                elif status_code >= 400:
                    logger.warning(
                        "Request completed with client error: %s %s -> %d (%.2fms)",
                        method,
                        path,
                        status_code,
                        duration_ms,
                        extra=log_extra,
                    )
                else:
                    logger.info(
                        "Request completed: %s %s -> %d (%.2fms)",
                        method,
                        path,
                        status_code,
                        duration_ms,
                        extra=log_extra,
                    )
            except Exception:
                pass
            finally:
                reset_request_id(token)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler to initialize database tables and verify configuration on startup."""
    if settings.ENVIRONMENT.lower() in {"development", "dev"}:
        if settings.JWT_SECRET_KEY == DEFAULT_DEV_JWT_SECRET:
            logger.warning(
                "Running in development mode with default JWT_SECRET_KEY. "
                "Set a secure, unique key before deploying to production."
            )

    if settings.RATE_LIMITING_ENABLED:
        logger.info("Rate limiting enabled with storage backend: %s", settings.RATE_LIMIT_STORAGE_URL)
        if settings.ENVIRONMENT.lower() in {"production", "prod", "staging"}:
            if settings.RATE_LIMIT_STORAGE_URL.startswith("memory://"):
                logger.warning(
                    "Rate limiting is running with in-memory storage in a production environment (%s). "
                    "For multi-worker or distributed deployments, configure RATE_LIMIT_STORAGE_URL (e.g. redis://...).",
                    settings.ENVIRONMENT,
                )
    else:
        logger.warning("Rate limiting is explicitly disabled via RATE_LIMITING_ENABLED=False.")

    if engine is not None:
        try:
            logger.info("Verifying and creating database tables...")
            Base.metadata.create_all(bind=engine)
            from app.db.migrations.run_migrations import apply_migrations
            apply_migrations()
            logger.info("Database tables initialized successfully.")
        except Exception as exc:
            logger.error("Failed to initialize database tables: %s", exc)
            raise exc
    yield


# Initialize FastAPI application
app = FastAPI(
    title="GenAI Chatbot API",
    description="Modular FastAPI backend with LangChain fallback from Mistral to Gemini",
    version="1.0.0",
    lifespan=lifespan,
)

# Attach rate limiter instance and register middleware/handlers
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# Enable CORS for frontend integration with explicit origin whitelist
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "Origin",
        "X-Requested-With",
        REQUEST_ID_HEADER,
    ],
    expose_headers=[REQUEST_ID_HEADER],
)

# Outermost middleware: binds X-Request-ID and logs request lifecycle
app.add_middleware(RequestContextMiddleware)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler for unexpected unhandled server exceptions.
    Logs the exception with traceback server-side and returns a sanitized HTTP 500 response.
    Preserves standard Starlette/FastAPI HTTPExceptions, RateLimitExceeded, and RequestValidationErrors.
    """
    if isinstance(exc, RateLimitExceeded):
        return rate_limit_exceeded_handler(request, exc)
    if isinstance(exc, StarletteHTTPException):
        return await http_exception_handler(request, exc)
    if isinstance(exc, RequestValidationError):
        return await request_validation_exception_handler(request, exc)

    logger.exception("Unhandled server exception processing %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please try again later."},
    )

# Register routers
app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(conversations_router)
app.include_router(documents_router)


@app.get("/health")
@limiter.exempt
def health_check():
    return {
        "status": "ok",
        "message": "GenAI Chatbot backend is running",
    }

