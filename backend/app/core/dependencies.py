"""Reusable authentication and role authorization dependencies."""

from typing import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User, UserRole
from app.core.security import decode_access_token


_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise unauthorized
    user = db.query(User).filter(User.id == payload["sub"]).first()
    if user is None:
        raise unauthorized
    return user


def require_role(*allowed_roles: str) -> Callable[..., User]:
    allowed = {role.value if isinstance(role, UserRole) else role for role in allowed_roles}

    def check_role(user: User = Depends(get_current_user)) -> User:
        user_role = user.role.value if isinstance(user.role, UserRole) else user.role
        if user_role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions for this action",
            )
        return user

    return check_role
