from fastapi import APIRouter, HTTPException, status, Depends
from database import query_one, execute_dml, log_transaction
from auth_utils import hash_password, verify_password, create_access_token, get_current_user
from models import UserSignupRequest, UserLoginRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

def format_user_dict(user: dict) -> dict:
    name = (user.get("full_name") or "").strip() or user.get("username") or ""
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "full_name": name,
        "name": name,
        "role": user["role"],
        "status": user.get("status") or "ACTIVE",
        "created_at": str(user["created_at"]) if user.get("created_at") else None
    }

@router.post("/signup", status_code=status.HTTP_201_CREATED)
@router.post("/register", status_code=status.HTTP_201_CREATED)
def signup(payload: UserSignupRequest):
    u_clean = payload.username.strip().lower()
    e_clean = payload.email.strip().lower()

    # Check if username exists
    if query_one("SELECT id FROM users WHERE LOWER(username) = %s", (u_clean,)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": "Username already taken.", "fields": {"username": "Username already taken"}}
        )

    # Check if email exists
    if query_one("SELECT id FROM users WHERE LOWER(email) = %s", (e_clean,)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": "Email already registered.", "fields": {"email": "Email already registered"}}
        )

    hashed = hash_password(payload.password)
    raw_name = (payload.full_name or "").strip()
    full_name = raw_name if raw_name else payload.username.strip()
    role = payload.role.upper()

    new_user_id = execute_dml(
        """
        INSERT INTO users (username, email, password_hash, full_name, role, status)
        VALUES (%s, %s, %s, %s, %s, 'ACTIVE')
        """,
        (u_clean, e_clean, hashed, full_name, role),
        return_last_id=True
    )

    log_transaction(
        "register_user",
        payload.username.strip(),
        [f"INSERT INTO users (username, email, full_name, role, status) VALUES ('{u_clean}', '{e_clean}', '{full_name}', '{role}', 'ACTIVE');"]
    )

    user = query_one("SELECT id, username, email, full_name, role, status, created_at FROM users WHERE id = %s", (new_user_id,))
    u_dict = format_user_dict(user)
    token = create_access_token({"id": user["id"], "username": user["username"], "role": user["role"]})

    return {
        "token": token,
        "access_token": token,
        "token_type": "bearer",
        "user": u_dict
    }

@router.post("/login")
def login(payload: UserLoginRequest):
    u_lower = payload.username.strip().lower()
    user = query_one(
        "SELECT id, username, email, password_hash, full_name, role, status, created_at FROM users WHERE LOWER(username) = %s OR LOWER(email) = %s",
        (u_lower, u_lower)
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_CREDENTIALS", "message": "Invalid username or password."}
        )

    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_CREDENTIALS", "message": "Invalid username or password."}
        )

    # Issue token using true role stored in PostgreSQL
    token = create_access_token({"id": user["id"], "username": user["username"], "role": user["role"]})
    u_dict = format_user_dict(user)

    return {
        "token": token,
        "access_token": token,
        "token_type": "bearer",
        "user": u_dict
    }

@router.get("/me")
def get_profile(current_user: dict = Depends(get_current_user)):
    from routes.teams import build_team_summary

    u_dict = format_user_dict(current_user)

    # Check if user belongs to a team
    membership = query_one("SELECT team_id FROM team_members WHERE user_id = %s", (current_user["id"],))
    team_data = None
    if membership:
        team_data = build_team_summary(membership["team_id"])

    return {
        **u_dict,
        "user": u_dict,
        "team": team_data
    }
