"""
Image uploads to Supabase Storage. Bucket and credentials from .env.
"""
from pathlib import Path
from typing import Optional
import uuid

from app.core.config import settings


def _get_client():
    from app.core.supabase_client import get_supabase
    return get_supabase()


def upload_image(
    local_path: str | Path,
    object_name: Optional[str] = None,
    content_type: str = "image/jpeg",
) -> Optional[str]:
    """
    Upload image to Supabase Storage bucket; return public or signed URL.
    Bucket name from SUPABASE_STORAGE_BUCKET in .env.
    """
    if not settings.supabase_configured:
        return None
    path = Path(local_path)
    if not path.exists():
        return None
    name = object_name or f"{uuid.uuid4().hex}{path.suffix}"
    bucket = settings.supabase_storage_bucket
    try:
        client = _get_client()
        with open(path, "rb") as f:
            data = f.read()
        client.storage.from_(bucket).upload(
            name,
            data,
            file_options={"content-type": content_type},
        )
        # Public URL (if bucket is public) or get signed URL
        public_url = client.storage.from_(bucket).get_public_url(name)
        return public_url
    except Exception:
        return None


def upload_bytes(
    data: bytes,
    object_name: str,
    content_type: str = "image/jpeg",
) -> Optional[str]:
    """Upload raw bytes (e.g. from in-memory image) to Supabase Storage."""
    if not settings.supabase_configured:
        return None
    bucket = settings.supabase_storage_bucket
    try:
        client = _get_client()
        client.storage.from_(bucket).upload(
            object_name,
            data,
            file_options={"content-type": content_type},
        )
        return client.storage.from_(bucket).get_public_url(object_name)
    except Exception:
        return None


def delete_image(object_name: str) -> bool:
    """Delete object from Supabase Storage bucket by path."""
    if not settings.supabase_configured:
        return False
    try:
        client = _get_client()
        client.storage.from_(settings.supabase_storage_bucket).remove([object_name])
        return True
    except Exception:
        return False
