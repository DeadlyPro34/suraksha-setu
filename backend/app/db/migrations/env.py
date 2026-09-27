"""Alembic environment configuration.

Reads DATABASE_URL from the app's pydantic-settings config so we have a single
source of truth, then runs migrations in either "offline" or "online" mode.
"""

from logging.config import fileConfig
from pathlib import Path
import sys

from alembic import context
from sqlalchemy import engine_from_config, pool

# The Windows `alembic.exe` launcher may put its Scripts directory on
# sys.path instead of the current working directory. Add the backend root so
# Alembic can import the application package when run from `backend/`.
backend_root = Path(__file__).resolve().parents[3]
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from app.core.config import settings
from app.models import Base  # noqa: F401 — ensure all models are registered

# Alembic Config object
config = context.config

# Override sqlalchemy.url with the value from our app settings
# Alembic stores this value in ConfigParser, where percent signs begin
# interpolation sequences. Double them here; ConfigParser will restore the
# literal percent when engine_from_config reads the URL.
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("%", "%%"))

# Set up Python logging from the .ini file
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# The MetaData object for 'autogenerate' support
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode — emit SQL to stdout."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode — create an Engine and connect."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
