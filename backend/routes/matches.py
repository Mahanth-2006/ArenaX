import math
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, status, Depends, Query
from database import query_one, query_all, execute_dml, get_db_cursor, log_transaction
from auth_utils import get_current_user, get_optional_user, require_admin
from models import MatchWinnerRequest
from routes.teams import build_team_summary
from routes.tournaments import resolve_tournament, build_tournament_summary

router = APIRouter(prefix="", tags=["Matches & Bracket"])

def build_match_view(m: dict) -> dict:
    t_id = m["tournament_id"]
    
    # Team summaries with seeds
    def with_seed(team_id):
        if not team_id:
            return None
        ts = build_team_summary(team_id)
        if ts:
            reg = query_one("SELECT seed FROM tournament_registrations WHERE tournament_id = %s AND team_id = %s", (t_id, team_id))
            if reg:
                ts["seed"] = reg["seed"]
        return ts

    team1 = with_seed(m.get("team1_id"))
    team2 = with_seed(m.get("team2_id"))
    winner_team = with_seed(m.get("winner_id"))

    next_match = None
    next_match_num = None
    next_match_round = None
    if m.get("next_match_id"):
        nm = query_one("SELECT id, number, round_name FROM matches WHERE id = %s", (m["next_match_id"],))
        if nm:
            next_match_num = nm["number"]
            next_match_round = nm["round_name"]

    # Child matches that feed into this match
    feeds = query_all("SELECT number, next_match_slot FROM matches WHERE next_match_id = %s", (m["id"],))
    source1 = next((f["number"] for f in feeds if f.get("next_match_slot") == 1), None)
    source2 = next((f["number"] for f in feeds if f.get("next_match_slot") == 2), None)

    return {
        "id": m["id"],
        "tournament_id": m["tournament_id"],
        "number": m.get("number") or 1,
        "round_number": m["round_number"],
        "round_name": m.get("round_name") or f"Round {m['round_number']}",
        "abbr": m.get("abbr") or f"R{m['round_number']}",
        "match_order": m.get("match_order") or 1,
        "team1_id": m.get("team1_id"),
        "team1_name": team1["name"] if team1 else None,
        "team1": team1,
        "team2_id": m.get("team2_id"),
        "team2_name": team2["name"] if team2 else None,
        "team2": team2,
        "winner_id": m.get("winner_id"),
        "winner_name": winner_team["name"] if winner_team else None,
        "winner_team": winner_team,
        "next_match_id": m.get("next_match_id"),
        "next_match_slot": m.get("next_match_slot"),
        "next_match_number": next_match_num,
        "next_match_round": next_match_round,
        "source1": source1,
        "source2": source2,
        "status": m["status"],
        "completed_at": str(m["completed_at"]) if m.get("completed_at") else None,
        "created_at": str(m["created_at"]) if m.get("created_at") else None
    }

@router.get("/api/tournaments/{tourn_id}/matches")
def get_tournament_matches(tourn_id: str):
    t = resolve_tournament(tourn_id)
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Tournament not found."})

    ms = query_all("SELECT * FROM matches WHERE tournament_id = %s ORDER BY number ASC", (t["id"],))
    return [build_match_view(m) for m in ms]

@router.get("/api/tournaments/{tourn_id}/bracket")
def get_tournament_bracket(tourn_id: str, current_user: Optional[dict] = Depends(get_optional_user)):
    t = resolve_tournament(tourn_id)
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Tournament not found."})

    real_tourn_id = t["id"]
    ms = query_all("SELECT * FROM matches WHERE tournament_id = %s ORDER BY number ASC", (real_tourn_id,))
    capacity = t.get("capacity") or t.get("max_teams") or 4
    p = 1
    while p < capacity:
        p *= 2
    total_rounds = int(math.log2(p)) if p > 1 else 1

    from bracket_service import ROUND_NAMES
    names = ROUND_NAMES.get(total_rounds, [f"Round {r}" for r in range(1, total_rounds + 1)])

    rounds_list = []
    for r in range(1, total_rounds + 1):
        round_name = names[r - 1] if r - 1 < len(names) else f"Round {r}"
        r_matches = [build_match_view(m) for m in ms if m["round_number"] == r]
        rounds_list.append({
            "number": r,
            "name": round_name,
            "matches": r_matches
        })

    # Teams map with seeds
    teams_map = {}
    regs = query_all("SELECT team_id, seed FROM tournament_registrations WHERE tournament_id = %s", (real_tourn_id,))
    for rg in regs:
        ts = build_team_summary(rg["team_id"])
        if ts:
            ts["seed"] = rg["seed"]
            teams_map[ts["id"]] = ts

    champ_summary = None
    cid = t.get("champion_team_id") or t.get("winner_team_id")
    if cid:
        champ_summary = build_team_summary(cid)

    summary = build_tournament_summary(t, current_user)
    viewer_role = current_user.get("role") if current_user else "GUEST"

    # Also build dictionary of rounds (rounds[1], rounds[2]...) to satisfy both array and dict access
    rounds_dict = {r["number"]: r["matches"] for r in rounds_list}

    return {
        "tournament_id": real_tourn_id,
        "title": summary["title"],
        "max_teams": capacity,
        "total_rounds": total_rounds,
        "tournament": summary,
        "rounds": rounds_list,
        "rounds_dict": rounds_dict,
        "teams": teams_map,
        "champion": champ_summary,
        "viewer_role": viewer_role,
        "status": summary["status"]
    }

@router.get("/api/matches")
def get_all_matches(status_filter: Optional[str] = Query(None, alias="status"), tournament_id: Optional[int] = None):
    sql = "SELECT m.*, t.name AS tournament_name, t.status AS tournament_status FROM matches m JOIN tournaments t ON m.tournament_id = t.id"
    conditions = []
    params = []
    if status_filter:
        conditions.append("m.status = %s")
        params.append(status_filter.upper())
    if tournament_id:
        conditions.append("m.tournament_id = %s")
        params.append(tournament_id)
    if conditions:
        sql += " WHERE " + " AND ".join(conditions)

    sql += " ORDER BY t.name ASC, m.number ASC"
    ms = query_all(sql, tuple(params))
    res = []
    for m in ms:
        mv = build_match_view(m)
        mv["tournament_name"] = m["tournament_name"]
        mv["tournament_status"] = m["tournament_status"]
        res.append(mv)
    return res

@router.get("/api/matches/{match_id}")
def get_match(match_id: int):
    m = query_one("SELECT * FROM matches WHERE id = %s", (match_id,))
    if not m:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Match not found."})
    return build_match_view(m)

@router.post("/api/matches/{match_id}/winner")
def select_match_winner(match_id: int, payload: MatchWinnerRequest, current_user: dict = Depends(require_admin)):
    winner_team_id = payload.get_winner_id()

    with get_db_cursor(commit=True) as (cursor, conn):
        cursor.execute("SELECT * FROM matches WHERE id = %s FOR UPDATE", (match_id,))
        m = cursor.fetchone()
        if not m:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Match not found."})

        if m["status"] == "COMPLETED":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "ALREADY_COMPLETED", "message": f"Match #{m['number']} is already completed."}
            )

        if m["status"] != "READY":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "MATCH_NOT_READY", "message": f"Match #{m['number']} is {m['status']} — both slots must be filled first."}
            )

        if winner_team_id not in (m["team1_id"], m["team2_id"]):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "INVALID_WINNER", "message": "Winner must be one of the two participating teams."}
            )

        # Mark match as COMPLETED
        cursor.execute(
            "UPDATE matches SET winner_id = %s, status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE id = %s",
            (winner_team_id, match_id)
        )

        next_match_id = m["next_match_id"]
        next_slot = m.get("next_match_slot", 1)
        advanced_match = None
        is_champion = False

        if next_match_id:
            col = "team1_id" if next_slot == 1 else "team2_id"
            cursor.execute(f"UPDATE matches SET {col} = %s WHERE id = %s", (winner_team_id, next_match_id))

            # Check if parent is now READY
            cursor.execute("SELECT team1_id, team2_id, status FROM matches WHERE id = %s", (next_match_id,))
            nm = cursor.fetchone()
            if nm["team1_id"] is not None and nm["team2_id"] is not None and nm["status"] == "PENDING":
                cursor.execute("UPDATE matches SET status = 'READY' WHERE id = %s", (next_match_id,))
        else:
            # Final Match! Crown Champion
            is_champion = True
            cursor.execute(
                """
                UPDATE tournaments 
                SET champion_team_id = %s, winner_team_id = %s, status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP 
                WHERE id = %s
                """,
                (winner_team_id, winner_team_id, m["tournament_id"])
            )

        # If tournament was LOCKED, change to IN_PROGRESS upon first match result
        cursor.execute("SELECT status FROM tournaments WHERE id = %s", (m["tournament_id"],))
        t_row = cursor.fetchone()
        if t_row["status"] == "LOCKED":
            cursor.execute("UPDATE tournaments SET status = 'IN_PROGRESS' WHERE id = %s", (m["tournament_id"],))

    # Log transaction
    log_stmts = [f"UPDATE matches SET winner_id={winner_team_id}, status='COMPLETED' WHERE id={match_id};"]
    if next_match_id:
        log_stmts.append(f"UPDATE matches SET team{next_slot}_id={winner_team_id} WHERE id={next_match_id};")
    else:
        log_stmts.append(f"UPDATE tournaments SET champion_team_id={winner_team_id}, status='COMPLETED' WHERE id={m['tournament_id']};")
    log_transaction("select_winner", current_user["username"], log_stmts)

    # Build updated views
    updated_m = query_one("SELECT * FROM matches WHERE id = %s", (match_id,))
    updated_next = query_one("SELECT * FROM matches WHERE id = %s", (next_match_id,)) if next_match_id else None
    t_updated = query_one("SELECT * FROM tournaments WHERE id = %s", (m["tournament_id"],))

    mv = build_match_view(updated_m)
    nmv = build_match_view(updated_next) if updated_next else None
    tsum = build_tournament_summary(t_updated, current_user)

    return {
        "match": mv,
        "next_match": nmv,
        "tournament": tsum,
        "champion_declared": is_champion,
        **mv
    }
