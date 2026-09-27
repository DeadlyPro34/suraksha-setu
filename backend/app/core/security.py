"""Password hashing and signed JWT access tokens."""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import bcrypt
import jwt
from jwt import InvalidTokenError

from app.core.config import settings


_ALGORITHM = "HS256"
_ACCESS_TOKEN_LIFETIME = timedelta(hours=24)


def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > 72:
        raise ValueError("Password must be at most 72 UTF-8 bytes for bcrypt")
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed.decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        password_bytes = password.encode("utf-8")
        if len(password_bytes) > 72:
            return False
        return bcrypt.checkpw(password_bytes, password_hash.encode("ascii"))
    except (ValueError, TypeError, UnicodeEncodeError):
        return False


def create_access_token(user_id: str, role: str) -> str:
    if len(settings.JWT_SECRET) < 32:
        raise RuntimeError("JWT_SECRET must be configured with at least 32 characters")
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "iat": now,
        "exp": now + _ACCESS_TOKEN_LIFETIME,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=_ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    if len(settings.JWT_SECRET) < 32:
        return None
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[_ALGORITHM],
            options={"require": ["sub", "role", "exp"]},
        )
        if not isinstance(payload.get("sub"), str) or not isinstance(
            payload.get("role"), str
        ):
            return None
        return payload
    except InvalidTokenError:
        return None
