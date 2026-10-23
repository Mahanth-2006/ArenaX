import json
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, status, Depends, Query
from database import query_one, query_all, execute_dml
from auth_utils import get_current_user, require_admin
from routes.teams import build_team_summary

router = APIRouter(prefix="/api", tags=["Meta, Stats & Database Lens"])

@router.get("/notifications")
def get_notifications(current_user: dict = Depends(get_current_user)):
    try:
        rows = query_all(
            'SELECT id, user_id, type, title, body, is_read AS "read", created_at FROM notifications WHERE user_id = %s ORDER BY id DESC LIMIT 30',
            (current_user["id"],)
        )
        for r in rows:
            r["read"] = bool(r.get("read"))
            r["created_at"] = str(r["created_at"]) if r.get("created_at") else None
        return rows
    except Exception:
        return []

@router.post("/notifications/read")
def mark_notifications_read(current_user: dict = Depends(get_current_user)):
    try:
        execute_dml("UPDATE notifications SET is_read = TRUE WHERE user_id = %s", (current_user["id"],))
    except Exception:
        pass
    return {"ok": True}

@router.get("/users")
def get_users(
    available: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
):
    sql = """
        SELECT u.id, u.username, u.full_name, u.role, u.status, u.created_at
        FROM users u
    """
    conditions = []
    params = []

    if available == "1":
        conditions.append("u.role = 'PLAYER' AND NOT EXISTS (SELECT 1 FROM team_members tm WHERE tm.user_id = u.id)")
    if search:
        s_like = f"%{search.lower()}%"
        conditions.append("(LOWER(u.username) LIKE %s OR LOWER(COALESCE(u.full_name, '')) LIKE %s)")
        params.extend([s_like, s_like])

    if conditions:
        sql += " WHERE " + " AND ".join(conditions)

    sql += " ORDER BY u.created_at ASC LIMIT 100"
    rows = query_all(sql, tuple(params))

    users_list = []
    for r in rows:
        name = (r.get("full_name") or "").strip() or r["username"]
        users_list.append({
            "id": r["id"],
            "username": r["username"],
            "full_name": name,
            "name": name,
            "role": r["role"],
            "status": r.get("status") or "ACTIVE",
            "created_at": str(r["created_at"]) if r.get("created_at") else None
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
            is_cap = team_data.get("captain_id") == current_user["id"]
            matches = query_all("SELECT status, winner_id FROM matches WHERE team1_id = %s OR team2_id = %s", (team_id, team_id))
            for m in matches:
                if m.get("status") == "COMPLETED":
                    played += 1
                    if m.get("winner_id") == team_id:
                        wins += 1
                elif m.get("status") == "READY":
                    upcoming += 1

    active_res = query_one("SELECT COUNT(*) AS total FROM tournaments WHERE status != 'COMPLETED'")
    active_count = active_res["total"] if active_res else 0

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
               COUNT(*) FILTER (WHERE role = 'PLAYER') AS players,
               COUNT(*) FILTER (WHERE role = 'ADMIN') AS admins
        FROM users
    """)
    t_count = query_one("SELECT COUNT(*) AS total FROM teams")
    r_count = query_one("SELECT COUNT(*) AS total FROM tournament_registrations")
    m_counts = query_one("""
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE status = 'READY') AS ready_matches
        FROM matches
    """)
    tourn_counts = query_one("""
        SELECT COUNT(*) FILTER (WHERE status = 'REGISTRATION_OPEN') AS open_t,
               COUNT(*) FILTER (WHERE status = 'LOCKED') AS locked_t,
               COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') AS in_progress_t,
               COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed_t,
               COUNT(*) FILTER (WHERE status != 'COMPLETED') AS active_t
        FROM tournaments
    """)

    return {
        "total_users": (u_counts.get("total") if u_counts else 0) or 0,
        "total_players": int((u_counts.get("players") if u_counts else 0) or 0),
        "total_admins": int((u_counts.get("admins") if u_counts else 0) or 0),
        "total_teams": (t_count.get("total") if t_count else 0) or 0,
        "total_registrations": (r_count.get("total") if r_count else 0) or 0,
        "total_matches": (m_counts.get("total") if m_counts else 0) or 0,
        "open_tournaments": int((tourn_counts.get("open_t") if tourn_counts else 0) or 0),
        "locked_tournaments": int((tourn_counts.get("locked_t") if tourn_counts else 0) or 0),
        "active_tournaments": int((tourn_counts.get("active_t") if tourn_counts else 0) or 0),
        "in_progress_tournaments": int((tourn_counts.get("in_progress_t") if tourn_counts else 0) or 0),
        "completed_tournaments": int((tourn_counts.get("completed_t") if tourn_counts else 0) or 0),
        "ready_matches": int((m_counts.get("ready_matches") if m_counts else 0) or 0)
    }

@router.get("/admin/schema")
def get_admin_schema(current_user: dict = Depends(require_admin)):
    table_names = ["users", "teams", "team_members", "tournaments", "tournament_registrations", "matches", "notifications"]
    tables = []
    for name in table_names:
        try:
            cnt = query_one(f"SELECT COUNT(*) AS c FROM {name}")
            tables.append({"name": name, "rows": cnt["c"] if cnt else 0})
        except Exception:
            tables.append({"name": name, "rows": 0})
    tx_list = get_admin_tx(limit=10, current_user=current_user)
    return {"tables": tables, "tx": tx_list}

@router.get("/admin/tx")
def get_admin_tx(limit: int = Query(12), current_user: dict = Depends(require_admin)):
    try:
        rows = query_all("SELECT * FROM transaction_log ORDER BY id DESC LIMIT %s", (limit,))
    except Exception:
        rows = []
    tx_log = []
    for r in rows:
        try:
            stmts = json.loads(r["statements"])
        except Exception:
            stmts = [r.get("statements", "")]
        tx_log.append({
            "id": r["id"],
            "action": r.get("action", ""),
            "actor": r.get("actor", ""),
            "timestamp": str(r.get("created_at") or r.get("timestamp") or ""),
            "statements": stmts,
            "status": r.get("status", "COMMITTED")
        })
    return tx_log
