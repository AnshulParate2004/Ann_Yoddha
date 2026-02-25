"""
FastAPI app initialization for Ann Yoddha backend.
"""
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router
from app.api.deps import get_current_user_id
from app.core.config import settings

app = FastAPI(
    title="Ann Yoddha API",
    description="AI-driven neuromorphic diagnostics for precision agriculture (wheat disease detection)",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/v1/auth/me")
def auth_me(current_user_id: str = Depends(get_current_user_id)):
    """Return current user id (requires Authorization: Bearer <jwt>)."""
    return {"user_id": current_user_id}
