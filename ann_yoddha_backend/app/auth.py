"""Supabase Auth utilities for the Ann Yoddha backend."""
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from supabase import Client

from app.core.supabase_client import get_supabase
from app.db.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def authenticate_user(supabase: Client, email: str, password: str):
    """Sign in using Supabase Auth."""
    try:
        response = supabase.auth.sign_in_with_password({"email": email, "password": password})
        return response
    except Exception:
        return None


def create_user(supabase: Client, email: str, password: str, meta: dict | None = None):
    """Register a new user using Supabase Auth."""
    try:
        kwargs = {"email": email, "password": password}
        if meta:
            kwargs["options"] = {"data": meta}
        response = supabase.auth.sign_up(kwargs)
        return response
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc)
        ) from exc



def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
) -> User:
    """Resolve the authenticated user from the Supabase JWT."""
    supabase = get_supabase()
    try:
        # Passing the JWT directly validates it against Supabase servers
        user_response = supabase.auth.get_user(token)
        if not user_response.user:
            raise ValueError("No user found")
        
        return User(
            id=user_response.user.id,
            email=user_response.user.email,
            created_at=user_response.user.created_at,
            meta=user_response.user.user_metadata or {},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_current_user_optional(
    token: Annotated[str | None, Depends(oauth2_scheme_optional)],
) -> User | None:
    """Optional auth dependency used by compatibility routes."""
    if not token:
        return None
    supabase = get_supabase()
    try:
        user_response = supabase.auth.get_user(token)
        if not user_response.user:
            return None
        return User(
            id=user_response.user.id,
            email=user_response.user.email,
            created_at=user_response.user.created_at,
            meta=user_response.user.user_metadata or {},
        )
    except Exception:
        return None
