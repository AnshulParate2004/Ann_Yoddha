"""
Environment variables and global configuration. Supabase and DB are set via .env.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Load from .env; Supabase URL, keys, DB, and optional overrides."""

    # Supabase (required). DB is accessed via Supabase client—no direct Postgres URL needed.
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # Optional: direct Postgres (only if you use SQLAlchemy elsewhere)
    database_url: str = ""

    # Optional: verify Supabase-issued JWTs (Project Settings > API > JWT Secret)
    supabase_jwt_secret: str | None = None

    # Storage bucket for diagnosis images (Supabase Storage, e.g. "images")
    supabase_storage_bucket: str = "images"

    # Fallback auth (only if not using Supabase Auth)
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # Optional: RAG, etc.
    pinecone_api_key: str | None = None
    pinecone_env: str | None = None

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def supabase_configured(self) -> bool:
        """True if Supabase URL and service role key are set."""
        return bool(self.supabase_url and self.supabase_service_role_key)


settings = Settings()
