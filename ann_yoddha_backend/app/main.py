"""Primary FastAPI application for the Ann Yoddha SaaS backend."""

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.api.v1.api import api_router
from app.auth import authenticate_user, create_access_token, create_user, get_user_by_email, seed_default_users
from app.db.models import User
from app.db.session import SessionLocal, get_db, init_db

app = FastAPI(
    title="Ann Yoddha API",
    description="JWT-authenticated backend for Ann Yoddha.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


class RegisterRequest(BaseModel):
    """Input payload for creating a new farmer account."""

    email: str
    password: str = Field(min_length=8)


class UserResponse(BaseModel):
    """Minimal user payload returned to the client."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    role: str


class TokenResponse(BaseModel):
    """Standard OAuth-style access token response."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse


def serialize_user(user: User) -> dict[str, int | str]:
    """Keep auth responses explicit instead of relying on ORM serialization."""
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
    }


@app.on_event("startup")
def bootstrap_application() -> None:
    """Ensure the database schema and requested test users exist."""
    init_db()
    with SessionLocal() as db:
        seed_default_users(db)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
):
    """Register a new local user and issue a JWT immediately."""
    existing_user = get_user_by_email(db, payload.email)
    if existing_user is not None:
        raise HTTPException(status_code=400, detail="Email is already registered")

    user = create_user(db, payload.email, payload.password)
    access_token = create_access_token(str(user.id), user.email, user.role)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": serialize_user(user),
    }


@app.post("/auth/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Authenticate using email in the OAuth `username` field and return a JWT."""
    user = authenticate_user(db, form_data.username, form_data.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(str(user.id), user.email, user.role)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": serialize_user(user),
    }


@app.get("/auth/me", response_model=UserResponse)
@app.get("/api/v1/auth/me", response_model=UserResponse)
def auth_me(current_user: CurrentUser):
    """Return the authenticated user's profile."""
    return serialize_user(current_user)
