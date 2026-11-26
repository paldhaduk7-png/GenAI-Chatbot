"""
Authentication and request dependencies.
Provides `get_current_user` for securing endpoints via JWT Bearer authentication.
"""
import logging
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import PyJWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.models import User
from app.db.session import get_db

logger = logging.getLogger(__name__)

# HTTPBearer scheme with auto_error=False to provide consistent, explicit 401 responses
security_scheme = HTTPBearer(
    auto_error=False,
    description="JWT Bearer token authorization header: 'Bearer <token>'",
)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency that extracts and validates the JWT bearer token
    from the HTTP Authorization header and returns the authenticated User.

    Raises:
        HTTPException(401): If token is missing, invalid, expired, malformed,
                            or if the corresponding user record does not exist.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None or not credentials.credentials:
        logger.debug("Authentication failed: Missing or empty Authorization header.")
        raise credentials_exception

    token = credentials.credentials.strip()
    if not token:
        logger.debug("Authentication failed: Empty token string.")
        raise credentials_exception

    try:
        payload = decode_access_token(token)
    except PyJWTError as exc:
        logger.debug("Authentication failed: Token validation error: %s", exc)
        raise credentials_exception
    except Exception as exc:
        logger.warning("Authentication failed: Unexpected error decoding token: %s", exc)
        raise credentials_exception

    user_id: Optional[str] = payload.get("sub")
    if not user_id or not isinstance(user_id, str):
        logger.debug("Authentication failed: Token payload missing valid 'sub' claim.")
        raise credentials_exception

    # Query the user from the database
    user = db.scalar(select(User).where(User.id == user_id))
    if user is None:
        logger.debug("Authentication failed: User with ID %s not found in database.", user_id)
        raise credentials_exception

    return user


# ==============================================================================
# Rate Limiting & Abuse Protection
# ==============================================================================
from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from app.config import (
    RATE_LIMIT_DEFAULT,
    RATE_LIMIT_STORAGE_URL,
    RATE_LIMITING_ENABLED,
)


def get_client_ip(request: Request) -> str:
    """
    Extract client IP address considering reverse proxies, CDNs, and load balancers.
    Checks CF-Connecting-IP, X-Real-IP, X-Forwarded-For, and direct client host.
    """
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip and cf_ip.strip():
        return cf_ip.strip()

    real_ip = request.headers.get("x-real-ip")
    if real_ip and real_ip.strip():
        return real_ip.strip()

    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        parts = [p.strip() for p in forwarded.split(",") if p.strip()]
        if parts:
            return parts[0]

    if request.client and request.client.host:
        return request.client.host

    return "127.0.0.1"


def get_rate_limit_key(request: Request) -> str:
    """
    Extract rate limiting key:
    - If request contains a valid Bearer token, keys by authenticated user: 'user:<user_id>'
    - If unauthenticated, keys by client IP: 'ip:<client_ip>'
    """
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
        if token:
            try:
                payload = decode_access_token(token)
                user_id = payload.get("sub")
                if user_id:
                    return f"user:{user_id}"
            except Exception:
                pass

    return f"ip:{get_client_ip(request)}"


# Centralized Limiter instance
limiter = Limiter(
    key_func=get_rate_limit_key,
    default_limits=[RATE_LIMIT_DEFAULT],
    storage_uri=RATE_LIMIT_STORAGE_URL,
    enabled=RATE_LIMITING_ENABLED,
    headers_enabled=False,
)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """
    Custom exception handler for RateLimitExceeded (HTTP 429).
    Returns standard detail and error fields, and injects rate limit headers if available.
    """
    key = get_rate_limit_key(request)
    logger.warning(
        "Rate limit exceeded for key='%s' on %s %s: %s",
        key,
        request.method,
        request.url.path,
        exc.detail,
    )

    response = JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={
            "detail": f"Rate limit exceeded: {exc.detail}. Please try again later.",
            "error": f"Rate limit exceeded: {exc.detail}",
        },
    )

    try:
        view_rate_limit = getattr(request.state, "view_rate_limit", None)
        if view_rate_limit and hasattr(request.app.state, "limiter"):
            response = request.app.state.limiter._inject_headers(response, view_rate_limit)
    except Exception:
        pass

    return response

