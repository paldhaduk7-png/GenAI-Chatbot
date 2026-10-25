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
