import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import Base, Conversation, Message, engine
from app.routes.chat import router as chat_router
from app.routes.conversations import router as conversations_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler to initialize database tables on startup."""
    if engine is not None:
        try:
            logger.info("Verifying and creating database tables...")
            Base.metadata.create_all(bind=engine)
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

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(chat_router)
app.include_router(conversations_router)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "message": "GenAI Chatbot backend is running",
    }
