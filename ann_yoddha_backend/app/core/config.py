"""Environment variables and global configuration for Ann Yoddha."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Load application settings from `.env` with sensible local defaults."""

    # Local SaaS backend database. Override with PostgreSQL in production.
    database_url: str = "sqlite:///./ann_yoddha.db"

    # JWT auth configuration.
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    # Seeded test users requested for manual testing.
    seed_admin_email: str = "admin@annyoddha.com"
    seed_admin_password: str = "AdminPassword123!"
    seed_farmer_email: str = "farmer_01@annyoddha.com"
    seed_farmer_password: str = "FarmerPassword123!"

    # Optional Supabase compatibility for legacy routes.
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str | None = None
    supabase_storage_bucket: str = "images"

    # Azure OpenAI (RAG / LangChain).
    azure_openai_api_key: str = ""
    azure_openai_endpoint: str = ""
    openai_api_version: str = "2024-12-01-preview"
    azure_openai_deployment: str = "gpt-4o"
    azure_openai_embedding_deployment: str = "text-embedding-3-small"

    # Qdrant (vector store for RAG).
    qdrant_url: str = ""
    qdrant_api_key: str = ""
    qdrant_collection_name: str = "wheat_disease_treatments"

    # Optional extras.
    pinecone_api_key: str | None = None
    pinecone_env: str | None = None

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    @property
    def rag_configured(self) -> bool:
        return bool(
            self.azure_openai_api_key
            and self.azure_openai_endpoint
            and self.qdrant_url
        )


settings = Settings()
