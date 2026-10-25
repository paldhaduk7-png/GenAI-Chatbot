import logging
from typing import List, Union

from fastapi import HTTPException
from langchain_core.messages import AIMessage, HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_mistralai import ChatMistralAI

from app.config import (
    GEMINI_MODEL,
    GOOGLE_API_KEY,
    MISTRAL_API_KEY,
    MISTRAL_MODEL,
)
from app.schemas.chat import ChatResponse, Message

logger = logging.getLogger(__name__)


def extract_text_from_content(content: Union[str, list, object]) -> str:
    """Extract plain text string from model response content."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and "text" in item:
                parts.append(item["text"])
            elif hasattr(item, "text"):
                parts.append(getattr(item, "text"))
            else:
                parts.append(str(item))
        return "".join(parts)
    return str(content)


def is_provider_fallback_error(exc: Exception) -> bool:
    """Determine if an exception is eligible for provider fallback (rate limits, quotas, server/network errors)."""
    # Programming errors in local code should not trigger provider fallback
    if isinstance(exc, (TypeError, ValueError, KeyError, IndexError, AttributeError, NameError)):
        return False

    # Check for HTTP status code on exception or inner response
    status_code = getattr(exc, "status_code", None)
    if status_code is None and hasattr(exc, "response") and exc.response is not None:
        status_code = getattr(exc.response, "status_code", None)

    # 402 (Payment/Quota), 403 (Tier/Quota), 408 (Timeout), 429 (Rate Limit), 5xx (Server Errors)
    if status_code in {402, 403, 408, 429, 500, 502, 503, 504}:
        return True

    # Common connection and timeout errors
    if isinstance(exc, (TimeoutError, ConnectionError)):
        return True

    error_text = str(exc).lower()
    fallback_indicators = [
        "rate limit",
        "rate_limited",
        "ratelimit",
        "too many requests",
        "quota",
        "resource exhausted",
        "resource_exhausted",
        "tier_not_allowed",
        "subscription tier",
        "credits",
        "timeout",
        "timed out",
        "temporarily unavailable",
        "service unavailable",
        "server error",
        "internal server error",
        "bad gateway",
        "connection refused",
        "connection reset",
        "500",
        "502",
        "503",
        "504",
        "429",
    ]
    return any(indicator in error_text for indicator in fallback_indicators)


def convert_messages_to_langchain(messages: List[Message]):
    """Convert validated message schemas into LangChain message objects."""
    langchain_messages = []
    for msg in messages:
        if msg.role == "user":
            langchain_messages.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            langchain_messages.append(AIMessage(content=msg.content))
    return langchain_messages


def generate_chat_response(messages: List[Message]) -> ChatResponse:
    """
    Generate chat response using Mistral as primary LLM and Gemini as fallback.
    Preserves conversation history across providers.
    """
    langchain_messages = convert_messages_to_langchain(messages)

    # 1. Primary provider: Mistral
    try:
        if not MISTRAL_API_KEY:
            raise ValueError("MISTRAL_API_KEY is not configured.")

        mistral_llm = ChatMistralAI(model=MISTRAL_MODEL, mistral_api_key=MISTRAL_API_KEY)
        result = mistral_llm.invoke(langchain_messages)
        text_content = extract_text_from_content(result.content)
        return ChatResponse(role="assistant", content=text_content, provider="mistral")

    except Exception as primary_exc:
        # Re-raise standard HTTP exceptions directly without fallback
        if isinstance(primary_exc, HTTPException):
            raise primary_exc

        # If error is not a temporary provider / quota / rate limit issue, reject fallback
        if not is_provider_fallback_error(primary_exc):
            logger.error("Primary provider failed with non-fallback error: %s", primary_exc, exc_info=True)
            raise HTTPException(
                status_code=500,
                detail="An internal error occurred while processing the chat request.",
            )

        logger.warning(
            "Primary provider (Mistral) encountered provider error (%s). Falling back to Gemini.",
            type(primary_exc).__name__,
        )

        # 2. Fallback provider: Gemini
        try:
            if not GOOGLE_API_KEY:
                raise ValueError("GOOGLE_API_KEY / GEMINI_API_KEY is not configured.")

            gemini_llm = ChatGoogleGenerativeAI(model=GEMINI_MODEL, google_api_key=GOOGLE_API_KEY)
            result = gemini_llm.invoke(langchain_messages)
            text_content = extract_text_from_content(result.content)
            return ChatResponse(role="assistant", content=text_content, provider="gemini")
        except Exception as fallback_exc:
            logger.error(
                "Fallback provider (Gemini) also failed: %s",
                type(fallback_exc).__name__,
                exc_info=True,
            )
            # Safe message without exposing keys or sensitive API error internals
            raise HTTPException(
                status_code=503,
                detail="Both primary (Mistral) and fallback (Gemini) AI providers are currently unavailable. Please try again later.",
            )
