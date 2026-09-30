"""Signup, login, and current-user endpoints."""

import hmac

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.auth import AuthOut, LoginIn, SignupIn, UserOut


router = APIRouter(prefix="/api/auth", tags=["auth"])
_PRIVILEGED_ROLES = {
    UserRole.field_officer,
    UserRole.volunteer,
    UserRole.official,
}


def _auth_response(user: User) -> AuthOut:
    role = user.role.value if isinstance(user.role, UserRole) else str(user.role)
    token = create_access_token(str(user.id), role)
    return AuthOut(
        access_token=token,
        user=UserOut(
            id=user.id,
            name=user.name,
            phone=user.phone,
            role=user.role,
        ),
    )


@router.post("/signup", response_model=AuthOut, status_code=status.HTTP_201_CREATED)
def signup(data: SignupIn, db: Session = Depends(get_db)) -> AuthOut:
    if data.role in _PRIVILEGED_ROLES:
        configured_code = settings.PRIVILEGED_SIGNUP_CODE
        if not configured_code or not data.invite_code or not hmac.compare_digest(
            data.invite_code, configured_code
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="A valid invite code is required for this role",
            )

    if db.query(User.id).filter(User.phone == data.phone).first():
        raise HTTPException(status_code=409, detail="Phone number is already registered")

    user = User(
        name=data.name.strip(),
        phone=data.phone.strip(),
        role=data.role,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Phone number is already registered",
        ) from exc
    return _auth_response(user)


@router.post("/login", response_model=AuthOut)
def login(data: LoginIn, db: Session = Depends(get_db)) -> AuthOut:
    user = db.query(User).filter(User.phone == data.phone.strip()).first()
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid phone number or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _auth_response(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut(
        id=user.id,
        name=user.name,
        phone=user.phone,
        role=user.role,
    )
