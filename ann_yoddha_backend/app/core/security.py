"""
Authentication and JWT logic. Supabase tokens use RS256/JWKS; legacy HS256 with SUPABASE_JWT_SECRET is supported as fallback.
"""
from datetime import datetime, timedelta, timezone
from typing import Any
import base64
import json
import logging

from jose import JWTError, jwt as jose_jwt
from jwt import PyJWKClient
import jwt as pyjwt

from app.core.config import settings

logger = logging.getLogger(__name__)

# Supabase JWKS client (RS256/ES256). Cached per process.
_jwks_client: PyJWKClient | None = None


def _get_jwt_header_alg(token: str) -> str | None:
    """Read alg from JWT header without verifying. Returns None if invalid."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        # JWT header is base64url; add padding for Python's urlsafe_b64decode
        b64 = parts[0]
        padding = (4 - len(b64) % 4) % 4
        header_bytes = base64.urlsafe_b64decode(b64 + "=" * padding)
        header = json.loads(header_bytes)
        return header.get("alg")
    except Exception:
        return None


def _get_jwks_client() -> PyJWKClient | None:
    global _jwks_client
    url = (settings.supabase_url or "").strip().rstrip("/")
    if not url:
        return None
    if _jwks_client is None:
        try:
            _jwks_client = PyJWKClient(f"{url}/auth/v1/.well-known/jwks.json")
        except Exception as e:
            logger.warning("Could not create Supabase JWKS client: %s", e)
            return None
    return _jwks_client


def _jwt_secret() -> str:
    """JWT secret for HS256; strip whitespace in case of copy-paste."""
    raw = (settings.supabase_jwt_secret or settings.secret_key) or ""
    return raw.strip()


def create_access_token(subject: str | Any, expires_delta: timedelta | None = None) -> str:
    """Create a JWT access token (fallback when not using Supabase Auth)."""
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode = {"exp": expire, "sub": str(subject)}
    return jose_jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> str | None:
    """
    Decode and validate JWT (Supabase RS256 via JWKS, or HS256 with secret). Returns subject (user id) or None.
    """
    payload = get_user_from_supabase_token(token)
    if payload and "sub" in payload:
        return str(payload["sub"])
    secret = _jwt_secret()
    if not secret:
        return None
    try:
        payload = jose_jwt.decode(token, secret, algorithms=[settings.algorithm])
        return payload.get("sub")
    except JWTError:
        return None


def get_user_from_supabase_token(token: str) -> dict[str, Any] | None:
    """
    Validate Supabase-issued JWT (RS256/ES256 via JWKS, or HS256 with SUPABASE_JWT_SECRET). Returns payload or None.
    """
    alg = _get_jwt_header_alg(token)
    if alg in ("RS256", "ES256"):
        # Must use JWKS; do not try HS256 or we get "alg value is not allowed"
        client = _get_jwks_client()
        if not client:
            logger.warning("Supabase JWKS client not available (check SUPABASE_URL)")
            return None
        try:
            signing_key = client.get_signing_key_from_jwt(token)
            return pyjwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "ES256"],
                options={"verify_aud": False},
            )
        except Exception as e:
            logger.warning("Supabase JWKS verification failed: %s", e)
            return None

    # HS256 (legacy): only when token is actually signed with HS256
    if alg != "HS256":
        return None
    secret = (settings.supabase_jwt_secret or "").strip()
    if not secret:
        return None
    try:
        return jose_jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
        )
    except JWTError as e:
        logger.warning("Supabase JWT verification failed: %s", e)
        return None
