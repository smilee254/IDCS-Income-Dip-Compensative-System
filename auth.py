"""
IDCS Authentication Module
JWT-based auth with registration, login, and user-identity dependency.
"""
import os
import bcrypt
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import SessionLocal, User

# ─── Config ───────────────────────────────────────────────────────────────────

SECRET_KEY  = os.getenv("IDCS_SECRET_KEY", "CHANGE_THIS_IN_PRODUCTION_USE_ENV_VAR")
ALGORITHM   = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ─── Pydantic Schemas ─────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name:            str
    email:           str
    password:        str
    phone:           Optional[str] = None
    age:             Optional[int] = None
    employment_type: Optional[str] = None
    sector:          Optional[str] = None
    county:          Optional[str] = None


class LoginRequest(BaseModel):
    email:    str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user_id:      int
    name:         str
    is_admin:     bool


# ─── Helpers ──────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    payload = data.copy()
    expire  = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    payload.update({"exp": expire})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# ─── DB Dependency ────────────────────────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─── Current-User Dependency ──────────────────────────────────────────────────

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        raw_sub = payload.get("sub")
        if raw_sub is None:
            raise credentials_error
        user_id = int(raw_sub)
    except (JWTError, ValueError):
        raise credentials_error

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_error
    return user


def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


# ─── Auth Route Handlers (called from main.py) ────────────────────────────────

def register_user(req: RegisterRequest, db: Session) -> TokenResponse:
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists."
        )

    user = User(
        name            = req.name,
        email           = req.email,
        phone           = req.phone,
        password_hash   = hash_password(req.password),
        age             = req.age,
        employment_type = req.employment_type,
        sector          = req.sector,
        county          = req.county,
        src_cap         = 50000.0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token = token,
        user_id      = user.id,
        name         = user.name,
        is_admin     = user.is_admin
    )


def login_user(req: LoginRequest, db: Session) -> TokenResponse:
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token = token,
        user_id      = user.id,
        name         = user.name,
        is_admin     = user.is_admin
    )
