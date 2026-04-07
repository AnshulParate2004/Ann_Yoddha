"""Common FastAPI dependencies shared across backend routes."""
from typing import Annotated

from fastapi import Depends

from app.auth import get_current_user, get_current_user_optional
from app.db.models import User


def get_current_user_id(
    current_user: Annotated[User, Depends(get_current_user)],
) -> str:
    """Return the authenticated user's id as a string for legacy routes."""
    return str(current_user.id)


def get_current_user_optional_id(
    current_user: Annotated[User | None, Depends(get_current_user_optional)],
) -> str | None:
    """Return the authenticated user's id as a string when a bearer token exists."""
    if current_user is None:
        return None
    return str(current_user.id)


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentUserId = Annotated[str, Depends(get_current_user_id)]
OptionalUserId = Annotated[str | None, Depends(get_current_user_optional_id)]
