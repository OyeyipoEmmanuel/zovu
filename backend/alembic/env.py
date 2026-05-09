"""
Alembic environment for async database migrations.
"""
from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context
import asyncio
from src.config import settings
from src.models import Base

# Import all models to ensure they're registered
from src.models import (
    User,
    Device,
    OTP,
    RefreshToken,
    Credit,
    Loan,
    Transaction,
    Job,
    Ajo,
    AjoMembership,
    Referral,
    PulseScore,
    SquadWebhookLog,
)

# Get Alembic config
config = context.config

# Setup logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set SQLAlchemy URL
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Set target metadata (for 'autogenerate' to work)
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    """Run migrations with connection object."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # Create async engine
    async_engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
    )

    async with async_engine.begin() as connection:
        await connection.run_sync(do_run_migrations)

    await async_engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
