"""JWT auth utilities for the local Ann Yoddha SaaS backend."""
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import User
from app.db.session import get_db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Return True when the supplied password matches the stored hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash passwords with bcrypt via passlib."""
    return pwd_context.hash(password)


def get_user_by_email(db: Session, email: str) -> User | None:
    """Fetch a user by normalized email."""
    normalized_email = email.strip().lower()
    return db.query(User).filter(User.email == normalized_email).first()


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    """Validate a user's credentials and return the user on success."""
    user = get_user_by_email(db, email)
    if user is None or not verify_password(password, user.hashed_password):
        return None
    return user


def create_access_token(subject: str, email: str, role: str, expires_delta: timedelta | None = None) -> str:
    """Create a signed JWT access token for the authenticated user."""
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload = {
        "sub": subject,
        "email": email,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def create_user(db: Session, email: str, password: str, role: str = "user") -> User:
    """Create a new local user account."""
    normalized_email = email.strip().lower()
    user = User(
        email=normalized_email,
        hashed_password=get_password_hash(password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """Resolve the authenticated user from the bearer token."""
    payload = _decode_token(token)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload missing subject",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        numeric_user_id = int(user_id)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject is invalid",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user = db.query(User).filter(User.id == numeric_user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_user_optional(
    token: Annotated[str | None, Depends(oauth2_scheme_optional)],
    db: Annotated[Session, Depends(get_db)],
) -> User | None:
    """Optional auth dependency used by compatibility routes."""
    if not token:
        return None
    payload = _decode_token(token)
    user_id = payload.get("sub")
    if user_id is None:
        return None
    try:
        numeric_user_id = int(user_id)
    except (TypeError, ValueError):
        return None
    return db.query(User).filter(User.id == numeric_user_id).first()


def seed_default_users(db: Session) -> None:
    """Create the requested admin and farmer accounts if they do not exist."""
    if get_user_by_email(db, settings.seed_admin_email) is None:
        create_user(
            db,
            email=settings.seed_admin_email,
            password=settings.seed_admin_password,
            role="admin",
        )

    if get_user_by_email(db, settings.seed_farmer_email) is None:
        create_user(
            db,
            email=settings.seed_farmer_email,
            password=settings.seed_farmer_password,
            role="user",
        )
