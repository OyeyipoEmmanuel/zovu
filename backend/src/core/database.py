"""
Database initialization and session management.
Uses SQLAlchemy 2.0 async with asyncpg.
"""
import os
from pathlib import Path
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool, StaticPool
from src.config import settings

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")


def _resolve_sqlite_url(raw_url: str) -> str:
    """Anchor relative SQLite paths to the backend project root.

    Without this, the API and the Celery worker (which usually start from
    different cwds) each create their own ./data.db and the worker ends up
    querying an empty file — symptom: `no such table: users`. Anchoring the
    relative path makes both processes hit the same file regardless of cwd.

    SQLite URI layout: `sqlite:///<path>` — three slashes is the scheme +
    empty host + path separator. A relative path looks like
    `sqlite:///./data.db`; an absolute path is `sqlite:////app/data.db`.
    """
    if "://" not in raw_url:
        return raw_url
    prefix, sep, rest = raw_url.partition("://")
    if not rest.startswith("/"):
        return raw_url
    body = rest[1:]  # strip the URI's leading slash
    if not body or body == ":memory:":
        return raw_url
    # Absolute path (e.g. "/app/data.db" came through as "//app/data.db")
    if body.startswith("/"):
        return raw_url
    # Relative — anchor to backend root
    relative = body[2:] if body.startswith("./") else body
    backend_root = Path(__file__).resolve().parents[2]
    anchored = (backend_root / relative).resolve()
    return f"{prefix}{sep}/{anchored.as_posix()}"


_db_url = _resolve_sqlite_url(settings.DATABASE_URL) if _is_sqlite else settings.DATABASE_URL

if _is_sqlite:
    # SQLite: no connection pool params; StaticPool keeps one in-memory connection
    engine = create_async_engine(
        _db_url,
        echo=settings.DEBUG,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
else:
    # PostgreSQL: full connection pool
    engine = create_async_engine(
        _db_url,
        echo=settings.DEBUG,
        pool_size=settings.DATABASE_POOL_SIZE,
        max_overflow=settings.DATABASE_MAX_OVERFLOW,
        pool_pre_ping=True,
        pool_recycle=3600,
    )

# Session factory
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncSession:
    """Dependency to get database session."""
    async with async_session() as session:
        yield session


async def init_db():
    """Create all tables (used in startup).

    Also patches the existing schema with any columns that were added to the
    ORM after the database was first created. SQLAlchemy's `create_all` will
    only ever create missing tables, never add columns to existing ones, so we
    need an explicit ALTER TABLE pass to keep dev SQLite installs in sync.
    """
    from src.models import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_apply_schema_patches)


def _apply_schema_patches(connection):
    """Add columns the ORM expects but that may not exist in older DB files.

    Called from `init_db()` once `create_all` has run. Idempotent: catches the
    error from re-running an ADD COLUMN that already succeeded and moves on.
    Works on both SQLite and Postgres.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(connection)
    if "ajos" not in inspector.get_table_names():
        # Fresh DB — create_all just made the table with the right columns.
        return

    existing_cols = {col["name"] for col in inspector.get_columns("ajos")}
    patches: list[str] = []
    if "end_date" not in existing_cols:
        # SQLite cannot ADD COLUMN with a non-constant default, so leave nullable.
        patches.append("ALTER TABLE ajos ADD COLUMN end_date TIMESTAMP NULL")
    if "merchant_squad_account" not in existing_cols:
        patches.append("ALTER TABLE ajos ADD COLUMN merchant_squad_account VARCHAR(20) NULL")

    if "users" in inspector.get_table_names():
        user_cols = {col["name"] for col in inspector.get_columns("users")}
        if "partner_approved" not in user_cols:
            patches.append("ALTER TABLE users ADD COLUMN partner_approved BOOLEAN DEFAULT 0")
        if "partner_approved_at" not in user_cols:
            patches.append("ALTER TABLE users ADD COLUMN partner_approved_at TIMESTAMP NULL")
        if "deleted_at" not in user_cols:
            patches.append("ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL")

    if "gigs" in inspector.get_table_names():
        gig_cols = {col["name"] for col in inspector.get_columns("gigs")}
        if "direct_location" not in gig_cols:
            patches.append("ALTER TABLE gigs ADD COLUMN direct_location VARCHAR(500) NULL")
        if "scheduled_at" not in gig_cols:
            patches.append("ALTER TABLE gigs ADD COLUMN scheduled_at TIMESTAMP NULL")

    for sql in patches:
        try:
            connection.execute(text(sql))
        except Exception:
            # Already applied in a previous boot — ignore.
            pass


async def close_db():
    """Close database connection (used in shutdown)."""
    await engine.dispose()
