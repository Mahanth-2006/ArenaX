from fastapi import APIRouter, HTTPException, status, Depends
from database import query_one, execute_dml, log_transaction
from auth_utils import hash_password, verify_password, create_access_token, get_current_user
from models import UserSignupRequest, UserLoginRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

def format_user_dict(user: dict) -> dict:
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "full_name": user.get("full_name") or user["username"],
        "role": user["role"],
        "status": user.get("status") or "ACTIVE",
        "created_at": str(user["created_at"]) if user.get("created_at") else None
    }

@router.post("/signup", status_code=status.HTTP_201_CREATED)
@router.post("/register", status_code=status.HTTP_201_CREATED)
def signup(payload: UserSignupRequest):
    # Check if username exists
    if query_one("SELECT id FROM users WHERE username = %s", (payload.username,)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": "Username already taken (UNIQUE constraint).", "fields": {"username": "Username already taken"}}
        )

    # Check if email exists
    if query_one("SELECT id FROM users WHERE email = %s", (payload.email,)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": "Email already registered (UNIQUE constraint).", "fields": {"email": "Email already registered"}}
        )

    hashed = hash_password(payload.password)
    full_name = payload.full_name or payload.username

    new_user_id = execute_dml(
        """
        INSERT INTO users (username, email, password_hash, full_name, role, status)
        VALUES (%s, %s, %s, %s, %s, 'ACTIVE')
        """,
        (payload.username.lower(), payload.email.lower(), hashed, full_name, payload.role),
        return_last_id=True
    )

    log_transaction(
        "register_user",
        payload.username,
        [f"INSERT INTO users (username, email, role, status) VALUES ('{payload.username}', '{payload.email}', '{payload.role}', 'ACTIVE');"]
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
    u_lower = payload.username.lower()
    user = query_one(
        "SELECT id, username, email, password_hash, full_name, role, status, created_at FROM users WHERE username = %s OR email = %s",
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

    if payload.role and payload.role.upper() != user["role"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ROLE_MISMATCH", "message": f"User is registered as {user['role']}, not {payload.role.upper()}."}
        )

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
