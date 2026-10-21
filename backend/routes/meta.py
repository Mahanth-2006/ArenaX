import json
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, status, Depends, Query
from database import query_one, query_all, execute_dml
from auth_utils import get_current_user, require_admin
from routes.teams import build_team_summary

router = APIRouter(prefix="/api", tags=["Meta, Stats & Database Lens"])

@router.get("/notifications")
def get_notifications(current_user: dict = Depends(get_current_user)):
    rows = query_all(
        "SELECT id, user_id, type, title, body, is_read AS `read`, created_at FROM notifications WHERE user_id = %s ORDER BY created_at DESC LIMIT 30",
        (current_user["id"],)
    )
    for r in rows:
        r["read"] = bool(r["read"])
        r["created_at"] = str(r["created_at"])
    return rows

@router.post("/notifications/read")
def mark_notifications_read(current_user: dict = Depends(get_current_user)):
    execute_dml("UPDATE notifications SET is_read = TRUE WHERE user_id = %s", (current_user["id"],))
    return {"ok": True}

@router.get("/users")
def get_users(
    available: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
):
    sql = """
        SELECT u.id, u.username, u.email, u.full_name, u.role, u.status, u.created_at,
               t.id AS team_id, t.name AS team_name
        FROM users u
        LEFT JOIN team_members tm ON u.id = tm.user_id
        LEFT JOIN teams t ON tm.team_id = t.id
    """
    conditions = []
    params = []

    if available == "1":
        conditions.append("u.role = 'PLAYER' AND tm.team_id IS NULL")
    if search:
        s_like = f"%{search.lower()}%"
        conditions.append("(LOWER(u.username) LIKE %s OR LOWER(u.full_name) LIKE %s OR LOWER(u.email) LIKE %s)")
        params.extend([s_like, s_like, s_like])

    if conditions:
        sql += " WHERE " + " AND ".join(conditions)

    sql += " ORDER BY u.created_at ASC LIMIT 60"
    rows = query_all(sql, tuple(params))

    users_list = []
    for r in rows:
        team_obj = None
        if r["team_id"]:
            team_obj = {"id": r["team_id"], "name": r["team_name"]}
        users_list.append({
            "id": r["id"],
            "username": r["username"],
            "email": r["email"],
            "full_name": r.get("full_name") or r["username"],
            "role": r["role"],
            "status": r.get("status") or "ACTIVE",
            "created_at": str(r["created_at"]) if r.get("created_at") else None,
            "team": team_obj
        })
    return users_list

@router.get("/stats/me")
def get_player_stats(current_user: dict = Depends(get_current_user)):
    membership = query_one("SELECT team_id FROM team_members WHERE user_id = %s", (current_user["id"],))
    team_data = None
    is_cap = False
    played = 0
    wins = 0
    upcoming = 0

    if membership:
        team_id = membership["team_id"]
        team_data = build_team_summary(team_id)
        if team_data:
            is_cap = team_data["captain_id"] == current_user["id"]
            matches = query_all("SELECT status, winner_id FROM matches WHERE team1_id = %s OR team2_id = %s", (team_id, team_id))
            for m in matches:
                if m["status"] == "COMPLETED":
                    played += 1
                    if m["winner_id"] == team_id:
                        wins += 1
                elif m["status"] == "READY":
                    upcoming += 1

    active_count = query_one("SELECT COUNT(*) AS total FROM tournaments WHERE status != 'COMPLETED'")["total"]

    return {
        "team": team_data,
        "is_captain": is_cap,
        "active_tournaments": active_count,
        "matches_played": played,
        "wins": wins,
        "upcoming": upcoming
    }

@router.get("/admin/stats")
def get_admin_stats(current_user: dict = Depends(require_admin)):
    u_counts = query_one("""
        SELECT COUNT(*) AS total,
               SUM(role = 'PLAYER') AS players,
               SUM(role = 'ADMIN') AS admins
        FROM users
    """)
    t_count = query_one("SELECT COUNT(*) AS total FROM teams")["total"]
    r_count = query_one("SELECT COUNT(*) AS total FROM tournament_registrations")["total"]
    m_counts = query_one("""
        SELECT COUNT(*) AS total,
               SUM(status = 'READY') AS ready_matches
        FROM matches
    """)
    tourn_counts = query_one("""
        SELECT SUM(status = 'REGISTRATION_OPEN') AS open_t,
               SUM(status = 'LOCKED') AS locked_t,
               SUM(status = 'IN_PROGRESS') AS in_progress_t,
               SUM(status = 'COMPLETED') AS completed_t,
               SUM(status != 'COMPLETED') AS active_t
        FROM tournaments
    """)

    return {
        "total_users": u_counts["total"] or 0,
        "total_players": int(u_counts["players"] or 0),
        "total_admins": int(u_counts["admins"] or 0),
        "total_teams": t_count or 0,
        "total_registrations": r_count or 0,
        "total_matches": m_counts["total"] or 0,
        "open_tournaments": int(tourn_counts["open_t"] or 0),
        "locked_tournaments": int(tourn_counts["locked_t"] or 0),
        "active_tournaments": int(tourn_counts["active_t"] or 0),
        "in_progress_tournaments": int(tourn_counts["in_progress_t"] or 0),
        "completed_tournaments": int(tourn_counts["completed_t"] or 0),
        "ready_matches": int(m_counts["ready_matches"] or 0)
    }

@router.get("/admin/schema")
def get_admin_schema(current_user: dict = Depends(require_admin)):
    tables = [
        {"name": "users", "rows": query_one("SELECT COUNT(*) AS c FROM users")["c"]},
        {"name": "teams", "rows": query_one("SELECT COUNT(*) AS c FROM teams")["c"]},
        {"name": "team_members", "rows": query_one("SELECT COUNT(*) AS c FROM team_members")["c"]},
        {"name": "tournaments", "rows": query_one("SELECT COUNT(*) AS c FROM tournaments")["c"]},
        {"name": "registrations", "rows": query_one("SELECT COUNT(*) AS c FROM tournament_registrations")["c"]},
        {"name": "matches", "rows": query_one("SELECT COUNT(*) AS c FROM matches")["c"]},
        {"name": "notifications", "rows": query_one("SELECT COUNT(*) AS c FROM notifications")["c"]},
    ]
    tx_list = get_admin_tx(limit=10, current_user=current_user)
    return {"tables": tables, "tx": tx_list}

@router.get("/admin/tx")
def get_admin_tx(limit: int = Query(12), current_user: dict = Depends(require_admin)):
    rows = query_all("SELECT * FROM transaction_log ORDER BY created_at DESC LIMIT %s", (limit,))
    tx_log = []
    for r in rows:
        try:
            stmts = json.loads(r["statements"])
        except Exception:
            stmts = [r["statements"]]
        tx_log.append({
            "id": r["id"],
            "action": r["action"],
            "actor": r["actor"],
            "timestamp": str(r["created_at"]),
            "statements": stmts,
            "status": r["status"]
        })
    return tx_log
