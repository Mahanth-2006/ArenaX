import math
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, status, Depends, Query
from database import query_one, query_all, execute_dml, get_db_cursor, log_transaction
from auth_utils import get_current_user, get_optional_user, require_admin
from models import TournamentCreateRequest, TournamentRegistrationRequest
from bracket_service import generate_bracket_tree
from routes.teams import build_team_summary

router = APIRouter(prefix="/api/tournaments", tags=["Tournaments"])

def resolve_tournament(t_id_str: str) -> Optional[dict]:
    if t_id_str == "latest":
        return query_one("SELECT * FROM tournaments ORDER BY created_at DESC LIMIT 1")
    try:
        t_id = int(t_id_str)
        return query_one("SELECT * FROM tournaments WHERE id = %s", (t_id,))
    except ValueError:
        return None

def build_tournament_summary(t: dict, viewer: Optional[dict] = None) -> dict:
    t_id = t["id"]
    regs = query_all("SELECT team_id, seed, registered_at FROM tournament_registrations WHERE tournament_id = %s ORDER BY seed ASC", (t_id,))
    ms = query_all("SELECT id, round_number, status FROM matches WHERE tournament_id = %s", (t_id,))

    champ_team = None
    if t.get("champion_team_id") or t.get("winner_team_id"):
        cid = t.get("champion_team_id") or t.get("winner_team_id")
        c_row = query_one("SELECT name FROM teams WHERE id = %s", (cid,))
        champ_team = c_row["name"] if c_row else None

    organizer_name = "ArenaX"
    if t.get("organizer_id"):
        org = query_one("SELECT full_name, username FROM users WHERE id = %s", (t["organizer_id"],))
        if org:
            organizer_name = org.get("full_name") or org["username"]

    viewer_team = None
    my_reg = False
    if viewer:
        m_row = query_one("SELECT team_id FROM team_members WHERE user_id = %s", (viewer["id"],))
        if m_row:
            viewer_team = m_row["team_id"]
            my_reg = any(r["team_id"] == viewer_team for r in regs)

    capacity = t.get("capacity") or t.get("max_teams") or 4
    p = 1
    while p < capacity:
        p *= 2
    total_rounds = int(math.log2(p)) if p > 1 else 1

    completed_matches = [m for m in ms if m["status"] == "COMPLETED"]
    completed_rounds = max([m["round_number"] for m in completed_matches], default=0)
    current_round = total_rounds if t["status"] == "COMPLETED" else min(completed_rounds + 1, total_rounds)

    name = t.get("name") or t.get("title") or "Tournament"

    return {
        "id": t["id"],
        "name": name,
        "title": name,
        "description": t.get("description") or "",
        "format": t.get("format") or "SINGLE_ELIMINATION",
        "capacity": capacity,
        "max_teams": capacity,
        "status": t["status"],
        "organizer_id": t.get("organizer_id"),
        "organizer_name": organizer_name,
        "created_at": str(t["created_at"]) if t.get("created_at") else None,
        "registration_deadline": t.get("registration_deadline"),
        "start_date": t.get("start_date"),
        "locked_at": str(t["locked_at"]) if t.get("locked_at") else None,
        "completed_at": str(t["completed_at"]) if t.get("completed_at") else None,
        "registered_count": len(regs),
        "registered_teams_count": len(regs),
        "remaining_slots": max(0, capacity - len(regs)),
        "champion_team_id": t.get("champion_team_id") or t.get("winner_team_id"),
        "champion_team_name": champ_team,
        "winner_team_id": t.get("champion_team_id") or t.get("winner_team_id"),
        "winner_team_name": champ_team,
        "my_team_registered": my_reg,
        "my_team_id": viewer_team,
        "total_rounds": total_rounds,
        "current_round": current_round,
        "matches_completed": len(completed_matches),
        "matches_total": len(ms)
    }

@router.get("")
def list_tournaments(
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    open_only: Optional[str] = Query(None, alias="open"),
    current_user: Optional[dict] = Depends(get_optional_user)
):
    sql = "SELECT * FROM tournaments ORDER BY created_at DESC"
    tourns = query_all(sql)
    result = []

    for t in tourns:
        summary = build_tournament_summary(t, current_user)
        if status_filter and status_filter.upper() != "ALL" and summary["status"] != status_filter.upper():
            continue
        if open_only == "1" and summary["status"] != "REGISTRATION_OPEN":
            continue
        if search:
            s_low = search.lower()
            if s_low not in summary["name"].lower() and s_low not in (summary["description"] or "").lower():
                continue
        result.append(summary)

    # Sort: REGISTRATION_OPEN first, then LOCKED, IN_PROGRESS, COMPLETED
    rank = {"REGISTRATION_OPEN": 0, "LOCKED": 1, "IN_PROGRESS": 2, "COMPLETED": 3}
    result.sort(key=lambda x: (rank.get(x["status"], 99), -(x["id"])))
    return result

@router.get("/{tourn_id}")
def get_tournament(tourn_id: str, current_user: Optional[dict] = Depends(get_optional_user)):
    t = resolve_tournament(tourn_id)
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Tournament not found."})

    summary = build_tournament_summary(t, current_user)

    reg_rows = query_all(
        "SELECT team_id, seed, registered_at FROM tournament_registrations WHERE tournament_id = %s ORDER BY seed ASC",
        (t["id"],)
    )
    registrations = []
    for r in reg_rows:
        team_data = build_team_summary(r["team_id"])
        registrations.append({
            "seed": r["seed"],
            "registered_at": str(r["registered_at"]),
            "team": team_data
        })

    viewer_role = current_user.get("role") if current_user else "GUEST"

    return {
        "tournament": summary,
        "registrations": registrations,
        "viewer_role": viewer_role,
        **summary
    }

@router.post("", status_code=status.HTTP_201_CREATED)
def create_tournament(payload: TournamentCreateRequest, current_user: dict = Depends(require_admin)):
    clean_name = payload.get_title().strip()
    if len(clean_name) < 3:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "VALIDATION_ERROR", "message": "Tournament name must be at least 3 characters.", "fields": {"name": "At least 3 characters."}}
        )

    try:
        capacity = payload.get_capacity()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "VALIDATION_ERROR", "message": str(e), "fields": {"capacity": str(e)}}
        )

    # Check unique name
    if query_one("SELECT id FROM tournaments WHERE name = %s OR title = %s", (clean_name, clean_name)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "DUPLICATE_NAME", "message": "A tournament with this name already exists (UNIQUE)."}
        )

    desc = payload.description or ""
    start_date = payload.start_date or ""
    reg_dl = payload.registration_deadline or ""

    tourn_id = execute_dml(
        """
        INSERT INTO tournaments (
            name, title, description, capacity, max_teams, format, status, 
            organizer_id, start_date, registration_deadline
        ) VALUES (%s, %s, %s, %s, %s, 'SINGLE_ELIMINATION', 'REGISTRATION_OPEN', %s, %s, %s)
        """,
        (clean_name, clean_name, desc, capacity, capacity, current_user["id"], start_date, reg_dl),
        return_last_id=True
    )

    log_transaction(
        "create_tournament",
        current_user["username"],
        [
            f"INSERT INTO tournaments (name, capacity, status, organizer_id) VALUES ('{clean_name}', {capacity}, 'REGISTRATION_OPEN', {current_user['id']});"
        ]
    )

    t = query_one("SELECT * FROM tournaments WHERE id = %s", (tourn_id,))
    summary = build_tournament_summary(t, current_user)
    return {"tournament": summary, **summary}

@router.post("/{tourn_id}/register", status_code=status.HTTP_201_CREATED)
def register_team_for_tournament(
    tourn_id: str,
    payload: TournamentRegistrationRequest,
    current_user: dict = Depends(get_current_user)
):
    t = resolve_tournament(tourn_id)
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Tournament not found."})

    real_tourn_id = t["id"]

    # Resolve team
    team_id = payload.team_id
    if not team_id:
        membership = query_one("SELECT team_id FROM team_members WHERE user_id = %s", (current_user["id"],))
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "NO_TEAM", "message": "You must create a team before registering."}
            )
        team_id = membership["team_id"]

    team = query_one("SELECT id, name, captain_id FROM teams WHERE id = %s", (team_id,))
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NO_TEAM", "message": "Team not found."})

    # Team validation: any team leader / creator can register their team
    with get_db_cursor(commit=True) as (cursor, conn):
        cursor.execute("SELECT id, name, capacity, status FROM tournaments WHERE id = %s FOR UPDATE", (real_tourn_id,))
        locked_t = cursor.fetchone()

        if locked_t["status"] != "REGISTRATION_OPEN":
            msg = "This tournament is LOCKED — capacity was reached." if locked_t["status"] == "LOCKED" else f"Registration is closed ({locked_t['status']})."
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "REGISTRATION_CLOSED", "message": msg}
            )

        # Check duplicate
        cursor.execute("SELECT id FROM tournament_registrations WHERE tournament_id = %s AND team_id = %s", (real_tourn_id, team_id))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "DUPLICATE_REGISTRATION", "message": "This team is already registered for this tournament (UNIQUE(tournament_id, team_id))."}
            )

        # Check capacity
        cursor.execute("SELECT COUNT(*) AS total FROM tournament_registrations WHERE tournament_id = %s", (real_tourn_id,))
        current_regs = cursor.fetchone()["total"]
        cap = locked_t["capacity"]

        if current_regs >= cap:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "CAPACITY_REACHED", "message": f"This tournament has reached its maximum capacity ({current_regs}/{cap})."}
            )

        new_seed = current_regs + 1
        cursor.execute(
            "INSERT INTO tournament_registrations (tournament_id, team_id, seed) VALUES (%s, %s, %s)",
            (real_tourn_id, team_id, new_seed)
        )

        is_locked = False
        if new_seed == cap:
            is_locked = True
            cursor.execute("UPDATE tournaments SET status = 'LOCKED', locked_at = CURRENT_TIMESTAMP WHERE id = %s", (real_tourn_id,))

            # Fetch all registered teams in seed order
            cursor.execute("SELECT team_id FROM tournament_registrations WHERE tournament_id = %s ORDER BY seed ASC", (real_tourn_id,))
            team_ids = [r["team_id"] for r in cursor.fetchall()]

            # Generate binary bracket tree with sequential numbers and round names
            generate_bracket_tree(cursor, real_tourn_id, cap, team_ids)

    # Log transaction
    log_statements = [f"INSERT INTO tournament_registrations (tournament_id, team_id, seed) VALUES ({real_tourn_id}, {team_id}, {new_seed});"]
    if is_locked:
        log_statements.append(f"UPDATE tournaments SET status='LOCKED' WHERE id={real_tourn_id}; -- bracket auto-generated")
    log_transaction("register_team", current_user["username"], log_statements)

    # Notifications
    cursor_members = query_all("SELECT user_id FROM team_members WHERE team_id = %s", (team_id,))
    for m in cursor_members:
        execute_dml(
            "INSERT INTO notifications (user_id, type, title, body) VALUES (%s, 'info', %s, %s)",
            (m["user_id"], f"Registered · {t['name']}", f"{team['name']} secured seed #{new_seed} in {t['name']}.")
        )

    updated_t = query_one("SELECT * FROM tournaments WHERE id = %s", (real_tourn_id,))
    summary = build_tournament_summary(updated_t, current_user)

    return {
        "tournament": summary,
        "seed": new_seed,
        "locked": is_locked,
        **summary
    }

@router.delete("/{tourn_id}", status_code=status.HTTP_200_OK)
def delete_tournament(
    tourn_id: str,
    current_user: dict = Depends(require_admin)
):
    t = resolve_tournament(tourn_id)
    if not t:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Tournament not found."}
        )
    
    real_id = t["id"]
    t_name = t.get("name") or t.get("title") or f"Tournament #{real_id}"

    with get_db_cursor(commit=True) as (cursor, conn):
        cursor.execute("DELETE FROM tournament_registrations WHERE tournament_id = %s", (real_id,))
        cursor.execute("DELETE FROM matches WHERE tournament_id = %s", (real_id,))
        cursor.execute("DELETE FROM tournaments WHERE id = %s", (real_id,))
    
    log_transaction(
        "delete_tournament",
        current_user["username"],
        [
            f"DELETE FROM tournament_registrations WHERE tournament_id = {real_id};",
            f"DELETE FROM matches WHERE tournament_id = {real_id};",
            f"DELETE FROM tournaments WHERE id = {real_id};"
        ]
    )

    return {"ok": True, "message": f"Tournament '{t_name}' deleted successfully.", "deleted_id": real_id}
