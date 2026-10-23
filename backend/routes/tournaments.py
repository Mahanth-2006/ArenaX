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
    viewer_team_name = None
    my_reg = False
    if viewer:
        v_reg = query_one("""
            SELECT tr.team_id, t.name AS team_name
            FROM tournament_registrations tr
            JOIN teams t ON tr.team_id = t.id
            LEFT JOIN team_members tm ON tr.team_id = tm.team_id AND tm.user_id = %s
            WHERE tr.tournament_id = %s AND (t.captain_id = %s OR tm.user_id = %s)
            LIMIT 1
        """, (viewer["id"], t_id, viewer["id"], viewer["id"]))
        if v_reg:
            viewer_team = v_reg["team_id"]
            viewer_team_name = v_reg["team_name"]
            my_reg = True
        else:
            m_row = query_one("SELECT id AS team_id, name AS team_name FROM teams WHERE captain_id = %s ORDER BY id DESC LIMIT 1", (viewer["id"],))
            if not m_row:
                m_row = query_one("""
                    SELECT tm.team_id, t.name AS team_name 
                    FROM team_members tm 
                    JOIN teams t ON tm.team_id = t.id 
                    WHERE tm.user_id = %s 
                    ORDER BY tm.id DESC LIMIT 1
                """, (viewer["id"],))
            if m_row:
                viewer_team = m_row["team_id"]
                viewer_team_name = m_row["team_name"]

    capacity = t.get("capacity") or t.get("max_teams") or 4
    p = 1
    while p < capacity:
        p *= 2
    total_rounds = int(math.log2(p)) if p > 1 else 1

    completed_matches = [m for m in ms if m["status"] == "COMPLETED"]
    completed_rounds = max([m["round_number"] for m in completed_matches], default=0)
    current_round = total_rounds if t["status"] == "COMPLETED" else min(completed_rounds + 1, total_rounds)

    name = t.get("name") or t.get("title") or "Tournament"

    min_size = t.get("min_team_size") or 2
    max_size = t.get("max_team_size") or 5
    size_label = f"Exactly {min_size} Players" if min_size == max_size else f"{min_size}–{max_size} Players"

    return {
        "id": t["id"],
        "name": name,
        "title": name,
        "description": t.get("description") or "",
        "format": t.get("format") or "SINGLE_ELIMINATION",
        "capacity": capacity,
        "max_teams": capacity,
        "min_team_size": min_size,
        "max_team_size": max_size,
        "team_size_label": size_label,
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
        "my_team_name": viewer_team_name,
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
    start_date = payload.start_date.strip() if payload.start_date and payload.start_date.strip() else None
    reg_dl = payload.registration_deadline.strip() if payload.registration_deadline and payload.registration_deadline.strip() else None
    min_sz, max_sz = payload.get_team_size_range()

    tourn_id = execute_dml(
        """
        INSERT INTO tournaments (
            name, title, description, capacity, max_teams, min_team_size, max_team_size, format, status, 
            organizer_id, start_date, registration_deadline
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, 'SINGLE_ELIMINATION', 'REGISTRATION_OPEN', %s, %s, %s)
        """,
        (clean_name, clean_name, desc, capacity, capacity, min_sz, max_sz, current_user["id"], start_date, reg_dl),
        return_last_id=True
    )

    log_transaction(
        "create_tournament",
        current_user["username"],
        [
            f"INSERT INTO tournaments (name, capacity, min_team_size, max_team_size, status, organizer_id) VALUES ('{clean_name}', {capacity}, {min_sz}, {max_sz}, 'REGISTRATION_OPEN', {current_user['id']});"
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

    # Validate team member count against tournament roster constraints
    m_count_row = query_one("SELECT COUNT(*) AS total FROM team_members WHERE team_id = %s", (team_id,))
    member_count = m_count_row["total"] if m_count_row else 0
    min_req = t.get("min_team_size") or 2
    max_req = t.get("max_team_size") or 5
    req_str = f"exactly {min_req}" if min_req == max_req else f"{min_req} to {max_req}"

    if member_count < min_req or member_count > max_req:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "ROSTER_SIZE_INVALID",
                "message": f"Team '{team['name']}' has {member_count} member(s). This tournament requires {req_str} members to participate."
            }
        )

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

        # Check duplicate team registration
        cursor.execute("SELECT id FROM tournament_registrations WHERE tournament_id = %s AND team_id = %s", (real_tourn_id, team_id))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "DUPLICATE_REGISTRATION", "message": "This team is already registered for this tournament (UNIQUE(tournament_id, team_id))."}
            )

        # Check if the registering user (current_user) is already participating in this tournament on any team
        cursor.execute("""
            SELECT t.name AS existing_team_name
            FROM tournament_registrations tr
            JOIN teams t ON tr.team_id = t.id
            LEFT JOIN team_members tm ON tr.team_id = tm.team_id AND tm.user_id = %s
            WHERE tr.tournament_id = %s AND (t.captain_id = %s OR tm.user_id = %s)
            LIMIT 1
        """, (current_user["id"], real_tourn_id, current_user["id"], current_user["id"]))
        user_already = cursor.fetchone()
        if user_already:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "CAPTAIN_ALREADY_IN_TOURNAMENT",
                    "message": f"You are already competing in this tournament with team '{user_already['existing_team_name']}'. One player cannot captain or play on 2 different teams in the same tournament."
                }
            )

        # 1. Gather all players and captain of the registering team
        reg_player_map = {}
        cursor.execute("""
            SELECT tm.user_id, u.username, COALESCE(u.full_name, u.username) AS display_name
            FROM team_members tm
            JOIN users u ON tm.user_id = u.id
            WHERE tm.team_id = %s
        """, (team_id,))
        for p in cursor.fetchall():
            reg_player_map[int(p["user_id"])] = dict(p)

        team_cap_id = int(team["captain_id"])
        if team_cap_id not in reg_player_map:
            cursor.execute("SELECT id AS user_id, username, COALESCE(full_name, username) AS display_name FROM users WHERE id = %s", (team_cap_id,))
            cap_p = cursor.fetchone()
            if cap_p:
                reg_player_map[team_cap_id] = dict(cap_p)

        # 2. Check if any player or captain is already participating in this tournament on another team
        cursor.execute("""
            SELECT tm.user_id, u.username, COALESCE(u.full_name, u.username) AS display_name, t.name AS existing_team_name
            FROM tournament_registrations tr
            JOIN team_members tm ON tr.team_id = tm.team_id
            JOIN users u ON tm.user_id = u.id
            JOIN teams t ON tr.team_id = t.id
            WHERE tr.tournament_id = %s AND tr.team_id != %s
        """, (real_tourn_id, team_id))
        conflicts = [dict(c) for c in cursor.fetchall()]

        cursor.execute("""
            SELECT t.captain_id AS user_id, u.username, COALESCE(u.full_name, u.username) AS display_name, t.name AS existing_team_name
            FROM tournament_registrations tr
            JOIN teams t ON tr.team_id = t.id
            JOIN users u ON t.captain_id = u.id
            WHERE tr.tournament_id = %s AND tr.team_id != %s
        """, (real_tourn_id, team_id))
        conflicts.extend([dict(c) for c in cursor.fetchall()])

        for c in conflicts:
            c_uid = int(c["user_id"])
            if c_uid in reg_player_map:
                conflicted_info = reg_player_map[c_uid]
                is_cap = (c_uid == team_cap_id)
                role_label = "Captain" if is_cap else "Player"
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "code": "PLAYER_ALREADY_IN_TOURNAMENT",
                        "message": (
                            f"{role_label} @{conflicted_info['username']} ({conflicted_info['display_name']}) "
                            f"is already competing in this tournament with team '{c['existing_team_name']}'. "
                            f"All team members and captains must be new players who do not already belong to another participating team."
                        )
                    }
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
