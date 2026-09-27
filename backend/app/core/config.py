from pathlib import Path

from pydantic_settings import BaseSettings


BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    DATABASE_URL: str = ''
    GROQ_API_KEY: str = ''
    JWT_SECRET: str = ''
    PRIVILEGED_SIGNUP_CODE: str = ''
    class Config:
        # Resolve from this file, not the shell's current directory. This keeps
        # Uvicorn and Alembic on the same backend/.env when launched from any cwd.
        env_file = BACKEND_ROOT / '.env'
        # Allow backend/.env to contain settings owned by other components.
        extra = 'ignore'

settings = Settings()
