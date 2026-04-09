"""Environment variables and global configuration for Ann Yoddha."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Load application settings from `.env` with sensible local defaults."""




    # Supabase Infrastructure.
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str | None = None
    supabase_storage_bucket: str = "images"

    # Azure OpenAI (RAG / AI Service).
    azure_openai_api_key: str = ""
    azure_openai_endpoint: str = ""
    openai_api_version: str = "2024-12-01-preview"
    azure_openai_deployment: str = "gpt-4o"
    azure_openai_embedding_deployment: str = "text-embedding-3-small"

    @property
    def azure_openai_chat_model(self) -> str:
        """Alias for PageIndex library compatibility."""
        return self.azure_openai_deployment

    # Tavily (Search Tool).
    tavily_api_key: str = ""

    # Azure Speech
    azure_speech_key: str = ""
    azure_speech_region: str = ""

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
        )


settings = Settings()


def get_settings():
    """Helper to get settings instance (required by PageIndex utils)."""
    return settings
