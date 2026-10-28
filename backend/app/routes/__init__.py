"""Routes package initialization."""
from app.routes.auth import router as auth_router
from app.routes.chat import router as chat_router
from app.routes.conversations import router as conversations_router
from app.routes.documents import router as documents_router

__all__ = ["auth_router", "chat_router", "conversations_router", "documents_router"]
