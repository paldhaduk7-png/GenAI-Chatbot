"""
Security and authentication utilities.
Handles password hashing/verification using bcrypt and JWT token encoding/decoding using PyJWT.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import bcrypt
import jwt
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError, PyJWTError

from app.config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    JWT_ALGORITHM,
    JWT_SECRET_KEY,
)

logger = logging.getLogger(__name__)


def hash_password(password: str) -> str:
    """
    Hash a plaintext password using bcrypt with a generated salt.

    Args:
        password: Plaintext password string.

    Returns:
        Salted and hashed password string.
    """
    if not isinstance(password, str):
        raise TypeError("Password must be a string.")

    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    """
    Verify a plaintext password against a bcrypt hashed password.

    Args:
        password: Plaintext password string to verify.
        hashed_password: Stored bcrypt hashed password string.

    Returns:
        True if password matches, False otherwise.
    """
    if not password or not hashed_password:
        return False

    try:
        password_bytes = password.encode("utf-8")
        hashed_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception as exc:
        logger.warning("Password verification failed with error: %s", exc)
        return False


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Generate a signed JWT access token with an expiration claim ('exp').

    Args:
        data: Dictionary of claims to include in the token payload.
        expires_delta: Optional custom token expiration duration.

    Returns:
        Signed JWT string.
    """
    to_encode = data.copy()

    now = datetime.now(timezone.utc)
    if expires_delta is not None:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({
        "exp": expire,
        "iat": now,
    })

    encoded_jwt = jwt.encode(
        to_encode,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate a signed JWT access token.
    Enforces signature verification, algorithm matching, and expiration ('exp').

    Args:
        token: JWT string to decode.

    Returns:
        Decoded payload dictionary if valid.

    Raises:
        ExpiredSignatureError: If the token has expired.
        InvalidTokenError: If the token is malformed, has an invalid signature, or fails validation.
    """
    if not token or not isinstance(token, str):
        raise InvalidTokenError("Token must be a non-empty string.")

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp"]},
        )
        return payload
    except ExpiredSignatureError as exc:
        logger.warning("Access token has expired.")
        raise exc
    except (InvalidTokenError, PyJWTError) as exc:
        logger.warning("Invalid access token: %s", exc)
        raise exc
