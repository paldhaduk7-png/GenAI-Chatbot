"""
Authentication API routes.
Provides user registration, login with JWT token issuance, and current user profile retrieval.
"""
import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models import User
from app.db.session import get_db
from app.schemas.auth import Token, UserLogin, UserOut, UserRegister

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
    description="Registers a new user account with hashed password and returns public user profile.",
)
def register(
    payload: UserRegister,
    db: Session = Depends(get_db),
) -> UserOut:
    """
    POST /api/auth/register
    Creates a new user record.
    Returns 409 Conflict if the email is already registered.
    """
    normalized_email = payload.email.strip().lower()

    # Check for existing user
    existing_user = db.scalar(select(User).where(User.email == normalized_email))
    if existing_user is not None:
        logger.info("Registration rejected: Email %s is already registered.", normalized_email)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    # Hash password securely using bcrypt
    hashed_password = hash_password(payload.password)

    # Default full_name if not provided
    full_name = payload.full_name or normalized_email.split("@")[0]

    new_user = User(
        id=str(uuid.uuid4()),
        email=normalized_email,
        full_name=full_name,
        hashed_password=hashed_password,
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except IntegrityError as exc:
        db.rollback()
        logger.warning("Registration integrity collision on email %s: %s", normalized_email, exc)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )
    except Exception as exc:
        db.rollback()
        logger.error("Failed to register user %s: %s", normalized_email, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while creating your account. Please try again later.",
        )

    logger.info("Successfully registered user id=%s email=%s", new_user.id, normalized_email)
    return UserOut.model_validate(new_user)


@router.post(
    "/login",
    response_model=Token,
    summary="User login",
    description="Authenticates credentials and returns a signed JWT access token.",
)
def login(
    payload: UserLogin,
    db: Session = Depends(get_db),
) -> Token:
    """
    POST /api/auth/login
    Authenticates user email and password.
    Returns a generic 401 Unauthorized for invalid credentials to prevent email enumeration.
    """
    normalized_email = payload.email.strip().lower()

    # Query the user
    user = db.scalar(select(User).where(User.email == normalized_email))

    # Verify password against hash
    if not user or not verify_password(payload.password, user.hashed_password):
        logger.info("Login failed: Invalid credentials for email %s", normalized_email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Issue access token with user.id as subject
    token_claims = {
        "sub": str(user.id),
        "email": user.email,
    }
    access_token = create_access_token(data=token_claims)

    logger.info("User login successful: id=%s email=%s", user.id, user.email)
    return Token(access_token=access_token, token_type="bearer")


@router.get(
    "/me",
    response_model=UserOut,
    summary="Get current user profile",
    description="Returns public profile information for the currently authenticated user.",
)
def get_me(
    current_user: User = Depends(get_current_user),
) -> UserOut:
    """
    GET /api/auth/me
    Retrieves the authenticated user profile.
    Requires Authorization: Bearer <token>.
    """
    return UserOut.model_validate(current_user)
