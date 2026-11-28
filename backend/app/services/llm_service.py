import logging
import os
from typing import List, Union

from fastapi import HTTPException
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_mistralai import ChatMistralAI

from app.config import (
    GEMINI_MODEL,
    GOOGLE_API_KEY,
    MISTRAL_API_KEY,
    MISTRAL_MODEL,
    settings,
)
from app.core.retry import (
    RetryPolicy,
    execute_with_retry,
    extract_status_code,
    is_permanent_error,
    is_transient_error,
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
    """
    Determine if an exception is eligible for provider fallback (rate limits, quotas,
    timeouts, or transient server/network errors).
    Permanent client/auth/validation/programming errors do NOT trigger fallback.
    """
    # Programming errors in local code should not trigger provider fallback
    if isinstance(exc, (TypeError, ValueError, KeyError, IndexError, AttributeError, NameError)):
        return False

    status_code = extract_status_code(exc)

    # Explicit client/auth/validation failures should not fall back
    if status_code in {400, 401, 404, 422}:
        return False

    # Quota/payment/tier errors (402, 403) should immediately fall back to secondary provider
    if status_code in {402, 403}:
        return True

    if is_transient_error(exc):
        return True

    error_text = str(exc).lower()
    quota_indicators = (
        "quota",
        "resource exhausted",
        "resource_exhausted",
        "tier_not_allowed",
        "subscription tier",
        "credits",
    )
    return any(indicator in error_text for indicator in quota_indicators)


def _build_llm_retry_policy() -> RetryPolicy:
    """Construct bounded retry policy for LLM provider calls from settings."""
    return RetryPolicy(
        max_retries=settings.LLM_MAX_RETRIES,
        initial_delay=settings.LLM_INITIAL_RETRY_DELAY,
        max_delay=settings.LLM_MAX_RETRY_DELAY,
        jitter=settings.LLM_RETRY_JITTER,
        respect_retry_after=True,
    )


def convert_messages_to_langchain(messages: List[Message]):
    """Convert validated message schemas into LangChain message objects."""
    langchain_messages = []
    for msg in messages:
        if msg.role == "user":
            langchain_messages.append(HumanMessage(content=msg.content))
        elif msg.role == "assistant":
            langchain_messages.append(AIMessage(content=msg.content))
        elif msg.role == "system":
            langchain_messages.append(SystemMessage(content=msg.content))
    return langchain_messages


def generate_chat_response(messages: List[Message]) -> ChatResponse:
    """
    Generate chat response using Mistral as primary LLM and Gemini as fallback.
    Preserves conversation history across providers.
    """
    mistral_key = MISTRAL_API_KEY or os.getenv("MISTRAL_API_KEY", "")
    google_key = GOOGLE_API_KEY or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY", "")

    # Check for missing primary API key
    if not mistral_key:
        logger.error("Primary provider configuration error: MISTRAL_API_KEY is missing.")
        raise HTTPException(
            status_code=500,
            detail="AI service configuration error: MISTRAL_API_KEY is not configured.",
        )

    langchain_messages = convert_messages_to_langchain(messages)
    retry_policy = _build_llm_retry_policy()

    # 1. Primary provider: Mistral (SDK max_retries=0 to prevent overlapping duplicate retries)
    logger.info(
        "Dispatching chat request to primary LLM provider.",
        extra={"event": "llm_request_started", "provider": "mistral"},
    )
    try:
        mistral_llm = ChatMistralAI(
            model=MISTRAL_MODEL,
            mistral_api_key=mistral_key,
            timeout=settings.MISTRAL_TIMEOUT_SECONDS,
            max_retries=0,
        )
        result = execute_with_retry(
            lambda: mistral_llm.invoke(langchain_messages),
            policy=retry_policy,
            is_retryable=is_transient_error,
            operation_name="mistral_chat",
        )
        text_content = extract_text_from_content(result.content)
        logger.info(
            "Chat response generated successfully.",
            extra={"event": "llm_success", "provider": "mistral"},
        )
        return ChatResponse(role="assistant", content=text_content, provider="mistral")

    except Exception as primary_exc:
        # Re-raise standard HTTP exceptions directly without fallback
        if isinstance(primary_exc, HTTPException):
            raise primary_exc

        # If error is not a temporary provider / quota / rate limit issue, reject fallback
        if not is_provider_fallback_error(primary_exc):
            logger.error("Primary provider failed with non-fallback error: %s", type(primary_exc).__name__, exc_info=True)
            status_code = extract_status_code(primary_exc)

            if status_code == 401:
                raise HTTPException(
                    status_code=500,
                    detail="AI service configuration error: Primary provider authentication failed.",
                )
            if status_code in {400, 422} and not is_permanent_error(ValueError()):
                raise HTTPException(
                    status_code=400,
                    detail="The chat request could not be processed by the AI provider.",
                )

            raise HTTPException(
                status_code=500,
                detail="An internal error occurred while processing the chat request.",
            )

        logger.warning(
            "Primary provider (Mistral) failed (%s). Falling back to Gemini.",
            type(primary_exc).__name__,
            extra={
                "event": "llm_fallback",
                "provider": "gemini",
                "reason": type(primary_exc).__name__,
            },
        )

        # 2. Fallback provider: Gemini (SDK max_retries=0 to prevent overlapping duplicate retries)
        try:
            if not google_key:
                logger.error("Fallback provider configuration error: GOOGLE_API_KEY / GEMINI_API_KEY is missing.")
                raise HTTPException(
                    status_code=503,
                    detail="Both primary (Mistral) and fallback (Gemini) AI providers are currently unavailable. Please try again later.",
                )

            gemini_llm = ChatGoogleGenerativeAI(
                model=GEMINI_MODEL,
                google_api_key=google_key,
                timeout=settings.GEMINI_TIMEOUT_SECONDS,
                max_retries=0,
            )
            result = execute_with_retry(
                lambda: gemini_llm.invoke(langchain_messages),
                policy=retry_policy,
                is_retryable=is_transient_error,
                operation_name="gemini_chat_fallback",
            )
            text_content = extract_text_from_content(result.content)
            logger.info(
                "Chat response generated successfully via fallback provider.",
                extra={"event": "llm_success", "provider": "gemini"},
            )
            return ChatResponse(role="assistant", content=text_content, provider="gemini")
        except HTTPException as http_exc:
            raise http_exc
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
