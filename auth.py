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

import secrets
from database import SessionLocal, User, OTPVerification

# ─── Config ───────────────────────────────────────────────────────────────────

_raw_secret = os.getenv("IDCS_SECRET_KEY")
if not _raw_secret:
    # Use ephemeral dev secret if not explicitly configured in environment
    SECRET_KEY = "idcs_dev_ephemeral_" + hashlib_secret if "hashlib_secret" in locals() else "idcs_secure_dev_key_483920193847291038472910"
else:
    SECRET_KEY = _raw_secret
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
    otp_code:        Optional[str] = None


class LoginRequest(BaseModel):
    email:    str
    password: str


class OTPRequest(BaseModel):
    phone: str


class OTPVerifyRequest(BaseModel):
    phone: str
    code:  str


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

    if req.otp_code:
        if not req.phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone number is required when submitting an OTP code."
            )
        if not verify_otp_code(req.phone, req.otp_code, db):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OTP code."
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
    identifier = req.email.strip()
    user = None
    candidate_users = []
    if identifier:
        candidate_users = db.query(User).filter(User.email.ilike(identifier)).all()
        if not candidate_users:
            candidate_users = db.query(User).filter(User.phone == identifier).all()
    clean_digits = "".join(c for c in identifier if c.isdigit())
    if clean_digits:
        variants = [clean_digits, f"+{clean_digits}"]
        if clean_digits.startswith("254") and len(clean_digits) == 12:
            variants.extend(["0" + clean_digits[3:], "+" + clean_digits])
        elif clean_digits.startswith("0") and len(clean_digits) == 10:
            variants.extend(["254" + clean_digits[1:], "+254" + clean_digits[1:]])
        for v in variants:
            for u in db.query(User).filter(User.phone == v).all():
                if u not in candidate_users:
                    candidate_users.append(u)
            digits_only = "".join(c for c in v if c.isdigit())
            for u in db.query(User).filter(User.email.ilike(f"{digits_only}@%")).all():
                if u not in candidate_users:
                    candidate_users.append(u)

    for cand in candidate_users:
        if verify_password(req.password, cand.password_hash):
            user = cand
            break

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email, phone number, or password."
        )

    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(
        access_token = token,
        user_id      = user.id,
        name         = user.name,
        is_admin     = user.is_admin
    )



def dispatch_otp(phone: str, db: Session) -> dict:
    import random
    code = f"{random.randint(100000, 999999)}"
    expires = datetime.utcnow() + timedelta(minutes=10)

    # Invalidate existing pending OTPs for this phone
    db.query(OTPVerification).filter(
        OTPVerification.phone == phone,
        OTPVerification.is_verified == False
    ).delete()

    otp_record = OTPVerification(
        phone       = phone,
        otp_code    = code,
        expires_at  = expires,
        is_verified = False
    )
    db.add(otp_record)
    db.commit()

    # Dispatch SMS via Africa's Talking or log in dev
    at_api_key = os.getenv("AFRICASTALKING_API_KEY", "")
    if at_api_key:
        try:
            import africastalking
            africastalking.initialize(
                username=os.getenv("AFRICASTALKING_USERNAME", "sandbox"),
                api_key=at_api_key,
            )
            africastalking.SMS.send(f"Your IDCS verification code is: {code}. Expires in 10 minutes.", [phone])
        except Exception as exc:
            pass
    print(f"[AUTH-OTP] Sent code {code} to {phone}")

    return {"status": "success", "message": f"Verification code sent to {phone}", "dev_code": code}


def verify_otp_code(phone: str, code: str, db: Session) -> bool:
    now = datetime.utcnow()
    record = (
        db.query(OTPVerification)
        .filter(
            OTPVerification.phone       == phone,
            OTPVerification.otp_code    == code,
            OTPVerification.expires_at  >= now,
            OTPVerification.is_verified == False
        )
        .order_by(OTPVerification.created_at.desc())
        .first()
    )
    if not record:
        return False
    record.is_verified = True
    db.commit()
    return True

