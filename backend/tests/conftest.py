"""Use harmless settings when tests import application modules."""

import os
import sys
from pathlib import Path


backend_root = Path(__file__).resolve().parents[1]
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

os.environ["DATABASE_URL"] = "postgresql+psycopg2://test:test@127.0.0.1/test_db"
os.environ["JWT_SECRET"] = "test-only-jwt-secret-with-at-least-32-bytes"
os.environ["GROQ_API_KEY"] = ""
os.environ["PRIVILEGED_SIGNUP_CODE"] = "test-only-invite-code"
