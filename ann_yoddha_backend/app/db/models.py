"""Pydantic models for Ann Yoddha (Supabase-native)."""
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class User(BaseModel):
    """Application user data from Supabase."""
    model_config = ConfigDict(from_attributes=True)

    id: str  # UUID from auth.users
    email: str
    role: str = "user"
    created_at: datetime
    meta: dict = Field(default_factory=dict)


class ScanHistory(BaseModel):
    """Scan history entry from Supabase."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    disease_name: str
    confidence: float
    treatment: str
    image_url: str | None = None
    timestamp: datetime
