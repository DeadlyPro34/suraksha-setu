from sqlalchemy import create_engine
from .config import settings

if settings.DATABASE_URL:
    engine = create_engine(settings.DATABASE_URL)
else:
    engine = None
