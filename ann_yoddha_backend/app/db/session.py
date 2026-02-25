"""
PostgreSQL connection logic (optional). When using Supabase DB, data is accessed via
Supabase client (get_supabase()); DATABASE_URL is not required.
"""
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.db.models import Base

engine = None
SessionLocal = None

if settings.database_url:
    engine = create_engine(settings.database_url, pool_pre_ping=True)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dependency that yields a DB session. Only available when DATABASE_URL is set."""
    if SessionLocal is None:
        raise RuntimeError(
            "DATABASE_URL is not set. This project uses Supabase DB via Supabase client."
        )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create tables if they do not exist (only when DATABASE_URL is set)."""
    if engine is not None:
        Base.metadata.create_all(bind=engine)
