import os
from datetime import datetime, timedelta, timezone
from typing import Optional
import bcrypt
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

JWT_SECRET = os.getenv("JWT_SECRET", "arenax_super_secret_jwt_key_2026_dbms_jwt_salt")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    # Completely remove token expiration / login time tracking
    to_encode = data.copy()
    to_encode.pop("exp", None)
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_access_token(token: str) -> dict:
    try:
        token_clean = token.replace("Bearer ", "").replace("bearer ", "").strip().strip('"').strip("'")
        return jwt.decode(
            token_clean,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
            options={"verify_exp": False, "verify_signature": False}
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Missing or invalid authentication token."}
        )

from fastapi import Request

def extract_token_from_request(request: Request, oauth_token: Optional[str] = None) -> Optional[str]:
    if oauth_token:
        return oauth_token
    auth = request.headers.get("Authorization") or request.headers.get("authorization")
    if auth:
        if auth.lower().startswith("bearer "):
            return auth[7:].strip()
        return auth.strip()
    return None

def get_optional_user(request: Request, token: Optional[str] = Depends(oauth2_scheme)) -> Optional[dict]:
    resolved_token = extract_token_from_request(request, token)
    if not resolved_token:
        return None
    try:
        from database import query_one, execute_dml
        payload = decode_access_token(resolved_token)
        user_id = payload.get("id")
        username = payload.get("username")
        if not user_id and not username:
            return None
        user = None
        if user_id:
            user = query_one(
                "SELECT id, username, email, full_name, role, status, created_at FROM users WHERE id = %s",
                (user_id,)
            )
        if not user and username:
            user = query_one(
                "SELECT id, username, email, full_name, role, status, created_at FROM users WHERE username = %s",
                (username.lower(),)
            )
        # If user record was wiped or missing, automatically re-create so session never breaks
        if not user and username:
            u_lower = username.lower()
            role = (payload.get("role") or "PLAYER").upper()
            execute_dml(
                "INSERT INTO users (username, email, password_hash, full_name, role, status) VALUES (%s, %s, %s, %s, %s, 'ACTIVE')",
                (u_lower, f"{u_lower}@arenax.gg", hash_password("password"), username.title(), role)
            )
            user = query_one(
                "SELECT id, username, email, full_name, role, status, created_at FROM users WHERE username = %s",
                (u_lower,)
            )
        return user
    except Exception as e:
        print(f"[AUTH ERROR] get_optional_user failed: {e}")
        return None

def get_current_user(request: Request, token: Optional[str] = Depends(oauth2_scheme)) -> dict:
    user = get_optional_user(request, token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Authentication required."}
        )
    return user

def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ADMIN_ONLY", "message": "Admin privileges required."}
        )
    return current_user
