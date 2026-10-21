from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, EmailStr, Field, field_validator

# --- Auth Models ---

class UserSignupRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    full_name: Optional[str] = None
    role: str = Field(default="PLAYER")

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        role = v.upper()
        if role not in ("PLAYER", "ADMIN"):
            raise ValueError("Role must be either 'PLAYER' or 'ADMIN'")
        return role

class UserLoginRequest(BaseModel):
    username: str
    password: str
    role: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    role: str
    status: str = "ACTIVE"
    created_at: Optional[Any] = None

class TokenResponse(BaseModel):
    token: str
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# --- Team Models ---

class TeamCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    tag: Optional[str] = None
    members: Optional[List[str]] = None

class AddMemberRequest(BaseModel):
    user_id: Optional[Union[int, str]] = None
    username: Optional[str] = None

class TeamMemberResponse(BaseModel):
    id: Optional[int] = None
    user_id: int
    username: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: str = "MEMBER"
    joined_at: Optional[Any] = None

class TeamResponse(BaseModel):
    id: int
    name: str
    tag: Optional[str] = "TEAM"
    captain_id: int
    captain_name: Optional[str] = None
    captain: Optional[Dict[str, Any]] = None
    member_count: int = 1
    max_members: int = 5
    created_at: Optional[Any] = None
    members: Optional[List[TeamMemberResponse]] = None
    tournaments_entered: Optional[int] = 0
    in_active_tournament: Optional[bool] = False


# --- Tournament Models ---

class TournamentCreateRequest(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = ""
    capacity: Optional[int] = None
    max_teams: Optional[int] = None
    start_date: Optional[str] = None
    registration_deadline: Optional[str] = None

    def get_title(self) -> str:
        return self.name or self.title or "Tournament"

    def get_capacity(self) -> int:
        cap = self.capacity or self.max_teams or 4
        if cap < 2 or cap % 2 != 0:
            raise ValueError("Capacity must be an even integer greater than or equal to 2")
        return cap

class TournamentRegistrationRequest(BaseModel):
    team_id: Optional[int] = None

class MatchWinnerRequest(BaseModel):
    team_id: Optional[int] = None
    winner_id: Optional[int] = None

    def get_winner_id(self) -> int:
        wid = self.team_id or self.winner_id
        if wid is None:
            raise ValueError("Winner team_id must be provided")
        return wid
