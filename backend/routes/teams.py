from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import List, Optional, Dict, Any
from database import query_one, query_all, execute_dml, get_db_cursor, log_transaction
from auth_utils import get_current_user
from models import TeamCreateRequest, AddMemberRequest

router = APIRouter(prefix="/api/teams", tags=["Teams & Rosters"])

MAX_TEAM_SIZE = 5

def build_team_summary(team_id: int) -> Optional[Dict[str, Any]]:
    team = query_one("""
        SELECT t.id, t.name, t.tag, t.captain_id, t.created_at,
               u.username AS captain_username, u.full_name AS captain_fullname
        FROM teams t
        JOIN users u ON t.captain_id = u.id
        WHERE t.id = %s
    """, (team_id,))
    if not team:
        return None

    members = query_all("""
        SELECT tm.id, tm.user_id, u.username, u.full_name, u.email, tm.role, tm.joined_at
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = %s
        ORDER BY (tm.role = 'CAPTAIN') DESC, tm.joined_at ASC
    """, (team_id,))

    regs = query_all("""
        SELECT tr.tournament_id, tour.status AS tournament_status
        FROM tournament_registrations tr
        JOIN tournaments tour ON tr.tournament_id = tour.id
        WHERE tr.team_id = %s
    """, (team_id,))

    tournaments_entered = len(regs)
    in_active = any(r["tournament_status"] != "COMPLETED" for r in regs)

    captain_info = {
        "id": team["captain_id"],
        "username": team["captain_username"],
        "full_name": team["captain_fullname"] or team["captain_username"]
    }

    # Check if team is eliminated in any tournament
    eliminated_matches = query_all("""
        SELECT m.tournament_id, t.name AS tournament_name
        FROM matches m
        JOIN tournaments t ON m.tournament_id = t.id
        WHERE m.status = 'COMPLETED'
          AND (m.team1_id = %s OR m.team2_id = %s)
          AND (m.winner_id IS NOT NULL AND m.winner_id != %s)
    """, (team_id, team_id, team_id))
    is_eliminated = len(eliminated_matches) > 0

    return {
        "id": team["id"],
        "name": team["name"],
        "tag": team["tag"],
        "captain_id": team["captain_id"],
        "captain": captain_info,
        "captain_name": team["captain_username"],
        "member_count": len(members),
        "max_members": MAX_TEAM_SIZE,
        "created_at": str(team["created_at"]) if team.get("created_at") else None,
        "members": members,
        "tournaments_entered": tournaments_entered,
        "in_active_tournament": in_active,
        "is_eliminated": is_eliminated,
        "eliminated_count": len(eliminated_matches)
    }

@router.get("/mine")
def get_my_team(current_user: dict = Depends(get_current_user)):
    # Find all teams captained or member of
    captained_teams = query_all("SELECT id FROM teams WHERE captain_id = %s ORDER BY id DESC", (current_user["id"],))
    all_teams_summaries = []
    for ct in captained_teams:
        s = build_team_summary(ct["id"])
        if s:
            all_teams_summaries.append(s)

    # Check primary membership if none captained
    if not all_teams_summaries:
        membership = query_one("SELECT team_id FROM team_members WHERE user_id = %s", (current_user["id"],))
        if membership:
            s = build_team_summary(membership["team_id"])
            if s:
                all_teams_summaries.append(s)

    primary_team = all_teams_summaries[0] if all_teams_summaries else None
    is_captain = bool(primary_team and primary_team["captain_id"] == current_user["id"])
    return {
        "team": primary_team,
        "teams": all_teams_summaries,
        "is_captain": is_captain
    }

@router.post("", status_code=status.HTTP_201_CREATED)
def create_team(payload: TeamCreateRequest, current_user: dict = Depends(get_current_user)):
    clean_name = payload.name.strip()
    if len(clean_name) < 3 or len(clean_name) > 50:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "VALIDATION_ERROR", "message": "Team name must be 3–50 characters.", "fields": {"name": "3–50 characters required."}}
        )

    # Note: user can create multiple teams if desired as captain


    # Check if name is taken
    if query_one("SELECT id FROM teams WHERE name = %s", (clean_name,)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "TEAM_NAME_TAKEN", "message": f'"{clean_name}" is already taken (UNIQUE teams.name).'}
        )

    clean_tag = (payload.tag or clean_name[:4]).upper()[:5]

    with get_db_cursor(commit=True) as (cursor, conn):
        cursor.execute(
            "INSERT INTO teams (name, tag, captain_id) VALUES (%s, %s, %s)",
            (clean_name, clean_tag, current_user["id"])
        )
        team_id = cursor.lastrowid
        cursor.execute(
            "INSERT INTO team_members (team_id, user_id, role) VALUES (%s, %s, 'CAPTAIN')",
            (team_id, current_user["id"])
        )

        # If extra member names provided by user, auto-create/link them
        if payload.members:
            for mem_name in payload.members:
                m_clean = mem_name.strip()
                if not m_clean:
                    continue
                # Find or create user
                cursor.execute("SELECT id FROM users WHERE username = %s OR full_name = %s", (m_clean.lower(), m_clean))
                m_user = cursor.fetchone()
                if not m_user:
                    from auth_utils import hash_password
                    default_pw = hash_password("arenax123")
                    cursor.execute(
                        "INSERT INTO users (username, email, password_hash, full_name, role, status) VALUES (%s, %s, %s, %s, 'PLAYER', 'ACTIVE')",
                        (m_clean.lower().replace(" ", "_"), f"{m_clean.lower().replace(' ', '_')}@arenax.gg", default_pw, m_clean)
                    )
                    uid = cursor.lastrowid
                else:
                    uid = m_user["id"]

                # Add to team_members if not already there
                cursor.execute("SELECT id FROM team_members WHERE team_id = %s AND user_id = %s", (team_id, uid))
                if not cursor.fetchone():
                    cursor.execute("INSERT INTO team_members (team_id, user_id, role) VALUES (%s, %s, 'MEMBER')", (team_id, uid))

    log_transaction(
        "create_team",
        current_user["username"],
        [
            f"INSERT INTO teams (name, tag, captain_id) VALUES ('{clean_name}', '{clean_tag}', {current_user['id']});",
            f"INSERT INTO team_members (team_id, user_id, role) VALUES ({team_id}, {current_user['id']}, 'CAPTAIN');"
        ]
    )

    summary = build_team_summary(team_id)
    return {
        "team": summary,
        "is_captain": True,
        **summary
    }

@router.get("")
def list_teams(search: Optional[str] = Query(None)):
    sql = "SELECT id FROM teams ORDER BY created_at ASC"
    rows = query_all(sql)
    teams_list = []
    for r in rows:
        ts = build_team_summary(r["id"])
        if ts:
            if search:
                s_lower = search.lower()
                if s_lower not in ts["name"].lower() and s_lower not in (ts["captain"]["username"].lower()):
                    continue
            teams_list.append(ts)
    return teams_list

@router.get("/{team_id}")
def get_team(team_id: int, current_user: Optional[dict] = Depends(get_current_user)):
    summary = build_team_summary(team_id)
    if not summary:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Team not found."})

    is_captain = False
    if current_user and summary["captain_id"] == current_user["id"]:
        is_captain = True

    return {
        "team": summary,
        "is_captain": is_captain,
        **summary
    }

@router.post("/{team_id}/members", status_code=status.HTTP_201_CREATED)
def add_team_member(team_id: int, payload: AddMemberRequest, current_user: dict = Depends(get_current_user)):
    team = query_one("SELECT id, name, captain_id FROM teams WHERE id = %s", (team_id,))
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Team not found."})

    if team["captain_id"] != current_user["id"] and current_user.get("role") != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "NOT_CAPTAIN", "message": "Only the team captain can manage the roster."}
        )

    # Find the target player
    target_user = None
    raw_uid = payload.user_id
    if raw_uid is not None:
        try:
            uid_int = int(raw_uid)
            target_user = query_one("SELECT id, username, full_name, role FROM users WHERE id = %s", (uid_int,))
        except (ValueError, TypeError):
            if not payload.username:
                payload.username = str(raw_uid).strip()

    if not target_user and payload.username:
        clean_uname = payload.username.strip()
        target_user = query_one(
            "SELECT id, username, full_name, role FROM users WHERE LOWER(username) = LOWER(%s) OR LOWER(full_name) = LOWER(%s)",
            (clean_uname, clean_uname)
        )
        if not target_user:
            from auth_utils import hash_password
            default_pw = hash_password("arenax123")
            safe_username = clean_uname.lower().replace(" ", "_")
            if query_one("SELECT id FROM users WHERE username = %s", (safe_username,)):
                import time
                safe_username = f"{safe_username}_{int(time.time()) % 1000}"
            new_uid = execute_dml(
                "INSERT INTO users (username, email, password_hash, full_name, role, status) VALUES (%s, %s, %s, %s, 'PLAYER', 'ACTIVE')",
                (safe_username, f"{safe_username}@player.arenax.gg", default_pw, clean_uname),
                return_last_id=True
            )
            target_user = query_one("SELECT id, username, full_name, role FROM users WHERE id = %s", (new_uid,))

    if not target_user or target_user["role"] != "PLAYER":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "USER_NOT_FOUND", "message": "Player not found."})

    # Check if target already has a team
    if query_one("SELECT 1 FROM team_members WHERE user_id = %s", (target_user["id"],)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "USER_HAS_TEAM", "message": f"{target_user['username']} already belongs to a team (UNIQUE team_members.user_id)."}
        )

    # Check capacity limit
    member_count = query_one("SELECT COUNT(*) AS total FROM team_members WHERE team_id = %s", (team_id,))["total"]
    if member_count >= MAX_TEAM_SIZE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "TEAM_FULL", "message": f"Roster is full — CHECK member_count <= {MAX_TEAM_SIZE}."}
        )

    execute_dml(
        "INSERT INTO team_members (team_id, user_id, role) VALUES (%s, %s, 'MEMBER')",
        (team_id, target_user["id"])
    )

    # Create notification for target user
    execute_dml(
        "INSERT INTO notifications (user_id, type, title, body) VALUES (%s, 'info', %s, %s)",
        (target_user["id"], f"Joined {team['name']}", f"{current_user.get('full_name') or current_user['username']} added you to {team['name']}.")
    )

    log_transaction(
        "add_team_member",
        current_user["username"],
        [f"INSERT INTO team_members (team_id, user_id, role) VALUES ({team_id}, {target_user['id']}, 'MEMBER');"]
    )

    summary = build_team_summary(team_id)
    return {"team": summary, **summary}

@router.delete("/{team_id}/members/{user_id}")
def remove_team_member(team_id: int, user_id: int, current_user: dict = Depends(get_current_user)):
    team = query_one("SELECT id, name, captain_id FROM teams WHERE id = %s", (team_id,))
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Team not found."})

    if team["captain_id"] != current_user["id"] and current_user.get("role") != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "NOT_CAPTAIN", "message": "Only the team captain can manage the roster."}
        )

    if team["captain_id"] == user_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "CANNOT_REMOVE_CAPTAIN", "message": "The captain cannot be removed from the roster. Disband the team instead."}
        )

    rowcount = execute_dml("DELETE FROM team_members WHERE team_id = %s AND user_id = %s", (team_id, user_id))
    if rowcount == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_A_MEMBER", "message": "That player is not on this team."})

    execute_dml(
        "INSERT INTO notifications (user_id, type, title, body) VALUES (%s, 'info', %s, %s)",
        (user_id, f"Removed from {team['name']}", f"You were removed from {team['name']}'s roster by the captain.")
    )

    log_transaction(
        "remove_team_member",
        current_user["username"],
        [f"DELETE FROM team_members WHERE team_id = {team_id} AND user_id = {user_id};"]
    )

    summary = build_team_summary(team_id)
    return {"team": summary, **summary}

@router.delete("/{team_id}")
def delete_team(team_id: int, current_user: dict = Depends(get_current_user)):
    team = query_one("SELECT id, name, captain_id FROM teams WHERE id = %s", (team_id,))
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Team not found."})

    if team["captain_id"] != current_user["id"] and current_user.get("role") != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "ADMIN_ONLY", "message": "Only the captain or an admin can delete this team."}
        )

    execute_dml("DELETE FROM teams WHERE id = %s", (team_id,))
    log_transaction("delete_team", current_user["username"], [f"DELETE FROM teams WHERE id = {team_id};"])
    return {"message": f"Team {team['name']} successfully deleted."}
