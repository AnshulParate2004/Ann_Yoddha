"""
FastAPI dependencies: JWT auth (Bearer token), optional auth.
"""
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer, OAuth2PasswordBearer

from app.core.security import decode_access_token, get_user_from_supabase_token

# Expect: Authorization: Bearer <jwt>
security = HTTPBearer(auto_error=False)


async def get_current_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> str:
    """
    Require valid JWT (Supabase or fallback). Returns user id (sub claim).
    Use as: Depends(get_current_user_id) on protected routes.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    # Prefer Supabase JWT payload, then fallback decode
    payload = get_user_from_supabase_token(token)
    if payload and "sub" in payload:
        return str(payload["sub"])
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user_id


async def get_current_user_optional(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> str | None:
    """
    Optional auth: returns user id if valid Bearer token present, else None.
    """
    if not credentials:
        return None
    token = credentials.credentials
    payload = get_user_from_supabase_token(token)
    if payload and "sub" in payload:
        return str(payload["sub"])
    return decode_access_token(token)


# Type alias for use in route signatures
CurrentUserId = Annotated[str, Depends(get_current_user_id)]
OptionalUserId = Annotated[str | None, Depends(get_current_user_optional)]
