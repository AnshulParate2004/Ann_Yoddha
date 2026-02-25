"""
Authentication and JWT logic. Supports Supabase-issued JWTs (validated via SUPABASE_JWT_SECRET).
"""
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt

from app.core.config import settings


def create_access_token(subject: str | Any, expires_delta: timedelta | None = None) -> str:
    """Create a JWT access token (fallback when not using Supabase Auth)."""
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode = {"exp": expire, "sub": str(subject)}
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> str | None:
    """
    Decode and validate JWT. Prefers Supabase JWT secret if set (SUPABASE_JWT_SECRET).
    Returns subject (user id) or None.
    """
    secret = settings.supabase_jwt_secret or settings.secret_key
    try:
        payload = jwt.decode(token, secret, algorithms=[settings.algorithm])
        return payload.get("sub")
    except JWTError:
        return None


def get_user_from_supabase_token(token: str) -> dict[str, Any] | None:
    """
    Validate Supabase-issued JWT and return payload (e.g. sub, email). Returns None if invalid.
    """
    if not settings.supabase_jwt_secret:
        return None
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=[settings.algorithm],
        )
        return payload
    except JWTError:
        return None
