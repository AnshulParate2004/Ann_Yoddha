"""
Supabase client singleton from env. Use for Auth, Storage, and (optionally) DB via PostgREST.
"""
from typing import Any

from supabase import create_client, Client

from app.core.config import settings


_client: Client | None = None


def get_supabase() -> Client:
    """Return Supabase client (service role for server-side)."""
    global _client
    if _client is None:
        if not settings.supabase_configured:
            raise RuntimeError(
                "Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env"
            )
        _client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return _client


def get_supabase_anon() -> Client:
    """Return Supabase client with anon key (respects RLS). Use when acting as a user."""
    return create_client(settings.supabase_url, settings.supabase_anon_key)
