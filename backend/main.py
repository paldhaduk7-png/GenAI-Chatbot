import logging
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

from app.config import DEFAULT_DEV_JWT_SECRET, settings
from app.core.deps import limiter, rate_limit_exceeded_handler
from app.db import Base, Conversation, Document, DocumentChunk, Message, engine
from app.routes.auth import router as auth_router
from app.routes.chat import router as chat_router
from app.routes.conversations import router as conversations_router
from app.routes.documents import router as documents_router


logger = logging.getLogger(__name__)


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
    ],
)


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

