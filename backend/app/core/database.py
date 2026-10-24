"""Database engine and session factory."""

from sqlalchemy.engine import make_url
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from .config import settings

database_url = make_url(settings.DATABASE_URL)
uses_supabase_pooler = bool(
    database_url.host and database_url.host.endswith(".pooler.supabase.com")
)

# Vercel functions are short-lived and can scale out horizontally. Supabase's
# shared pooler uses port 5432 for session mode, which holds a Postgres client
# for every warm function instance. Route shared-pooler app traffic through
# transaction mode instead; keep migrations free to use the DATABASE_URL they
# were explicitly given in alembic/env.py.
if uses_supabase_pooler and database_url.port == 5432:
    database_url = database_url.set(port=6543)

engine_options = {"pool_pre_ping": True}
if uses_supabase_pooler or database_url.port == 6543:
    # Let Supavisor/PgBouncer pool server-side connections instead of retaining
    # a client-side SQLAlchemy pool per serverless process.
    engine_options["poolclass"] = NullPool

engine = create_engine(database_url, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
