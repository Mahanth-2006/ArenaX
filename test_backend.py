"""
ArenaX End-to-End Integration Test Suite
Validates all 7 Features:
1. Auth & RBAC (Admin/Player)
2. Team Creation & Roster Management
3. Tournament Creation with Even Capacity Validation
4. Tournament Browsing & Slot Registration (with Duplicate/Overbooking protection)
5. Automated Bracket Generation & Fixture Pairing
6. Direct Winner Selection & Self-Referencing Advancement
7. Bracket Visualizer & Standings
"""

import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from fastapi.testclient import TestClient
from main import app
from database import execute_dml

client = TestClient(app)

def test_full_pipeline():
    print("\n" + "="*60)
    print("STARTING ARENAX INTEGRATION TEST SUITE")
    print("="*60)

    # Clean database tables before test run
    print("\n--- Resetting Database State ---")
    from database import get_db_cursor
    with get_db_cursor(commit=True) as (cursor, conn):
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
        cursor.execute("DELETE FROM matches;")
        cursor.execute("DELETE FROM tournament_registrations;")
        cursor.execute("DELETE FROM tournaments;")
        cursor.execute("DELETE FROM team_members;")
        cursor.execute("DELETE FROM teams;")
        cursor.execute("DELETE FROM users;")
        cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")
    print("Database reset successfully.")

    # -------------------------------------------------------------
    # FEATURE 1: Authentication & Role-Based Access Control
    # -------------------------------------------------------------
    print("\n--- Testing Feature 1: Authentication & RBAC ---")
    
    # Register Admin
    admin_res = client.post("/api/auth/signup", json={
        "username": "admin_user",
        "email": "admin@arenax.gg",
        "password": "Password123!",
        "role": "ADMIN"
    })
    assert admin_res.status_code == 201, f"Admin signup failed: {admin_res.text}"
    admin_token = admin_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("[PASS] Admin registered successfully.")

    # Register 4 Players (Captains)
    captains = []
    for i in range(1, 5):
        res = client.post("/api/auth/signup", json={
            "username": f"player_{i}",
            "email": f"player_{i}@arenax.gg",
            "password": "Password123!",
            "role": "PLAYER"
        })
        assert res.status_code == 201, f"Player {i} signup failed: {res.text}"
        token = res.json()["access_token"]
        user_info = res.json()["user"]
        captains.append({
            "info": user_info,
            "headers": {"Authorization": f"Bearer {token}"}
        })
    print(f"[PASS] {len(captains)} Players registered successfully.")

    # Register an additional player for roster testing
    roster_player_res = client.post("/api/auth/signup", json={
        "username": "roster_member",
        "email": "roster@arenax.gg",
        "password": "Password123!",
        "role": "PLAYER"
    })
    assert roster_player_res.status_code == 201
    print("[PASS] Additional roster member created.")

    # Verify duplicate username rejection
    dup_res = client.post("/api/auth/signup", json={
        "username": "admin_user",
        "email": "another@arenax.gg",
        "password": "Password123!",
        "role": "PLAYER"
    })
    assert dup_res.status_code == 400
    print("[PASS] Duplicate username rejection verified.")

    # -------------------------------------------------------------
    # FEATURE 2: Team Creation & Roster Management
    # -------------------------------------------------------------
    print("\n--- Testing Feature 2: Team Creation & Roster Management ---")
    
    teams = []
    for i, cap in enumerate(captains):
        team_res = client.post(
            "/api/teams", 
            json={"name": f"Team Alpha_{i+1}"}, 
            headers=cap["headers"]
        )
        assert team_res.status_code == 201, f"Team creation failed: {team_res.text}"
        team_data = team_res.json()
        assert team_data["captain_id"] == cap["info"]["id"]
        assert team_data["member_count"] == 1
        teams.append(team_data)
    print(f"[PASS] Created {len(teams)} teams with captains automatically enrolled.")

    # Test Roster Management: Captain adds member
    add_member_res = client.post(
        f"/api/teams/{teams[0]['id']}/members",
        json={"username": "roster_member"},
        headers=captains[0]["headers"]
    )
    assert add_member_res.status_code in (200, 201), f"Add member failed: {add_member_res.text}"
    team_members = add_member_res.json().get("members") or add_member_res.json()["team"]["members"]
    assert len(team_members) == 2
    print("[PASS] Captain successfully added roster member.")

    # Test Non-Captain unauthorized addition (403)
    unauth_member_res = client.post(
        f"/api/teams/{teams[0]['id']}/members",
        json={"username": "player_2"},
        headers=captains[1]["headers"]
    )
    assert unauth_member_res.status_code == 403
    print("[PASS] Unauthorized roster addition correctly rejected (403 Forbidden).")

    # -------------------------------------------------------------
    # FEATURE 3: Admin Tournament Creation & Capacity Rules
    # -------------------------------------------------------------
    print("\n--- Testing Feature 3: Tournament Creation & Capacity Rules ---")
    
    # Player cannot create tournament (403)
    player_tourn = client.post(
        "/api/tournaments",
        json={"title": "Hacked Tournament", "max_teams": 4},
        headers=captains[0]["headers"]
    )
    assert player_tourn.status_code == 403
    print("[PASS] Non-admin tournament creation correctly rejected (403 Forbidden).")

    # Odd capacity rejection (e.g. 5 or 7 teams must fail)
    odd_tourn = client.post(
        "/api/tournaments",
        json={"title": "Odd Tournament", "max_teams": 5},
        headers=admin_headers
    )
    assert odd_tourn.status_code in (400, 422)
    print("[PASS] Non-even tournament capacity correctly rejected.")

    # Admin creates valid tournament (capacity = 4)
    tourn_res = client.post(
        "/api/tournaments",
        json={"title": "ArenaX Championship 2026", "max_teams": 4},
        headers=admin_headers
    )
    assert tourn_res.status_code == 201, f"Tournament creation failed: {tourn_res.text}"
    tournament = tourn_res.json().get("tournament") or tourn_res.json()
    assert tournament["status"] == "REGISTRATION_OPEN"
    assert tournament["max_teams"] == 4
    tourn_id = tournament["id"]
    print(f"[PASS] Tournament created successfully with ID {tourn_id} (Status: REGISTRATION_OPEN).")

    # -------------------------------------------------------------
    # FEATURE 4 & 5: Slot Registration & Auto-Bracket Generation
    # -------------------------------------------------------------
    print("\n--- Testing Features 4 & 5: Registration & Auto-Bracket Generation ---")
    
    # Register first 3 teams
    for i in range(3):
        reg_res = client.post(
            f"/api/tournaments/{tourn_id}/register",
            json={"team_id": teams[i]["id"]},
            headers=captains[i]["headers"]
        )
        assert reg_res.status_code in (200, 201), f"Registration failed for team {i+1}: {reg_res.text}"
        reg_data = reg_res.json().get("tournament") or reg_res.json()
        assert reg_data["status"] == "REGISTRATION_OPEN"
        assert reg_data["registered_teams_count"] == i + 1
    print("[PASS] First 3 teams registered. Tournament remains REGISTRATION_OPEN.")

    # Test Duplicate Registration Prevention
    dup_reg = client.post(
        f"/api/tournaments/{tourn_id}/register",
        json={"team_id": teams[0]["id"]},
        headers=captains[0]["headers"]
    )
    assert dup_reg.status_code in (400, 409)
    print("[PASS] Duplicate team registration prevented.")

    # Register 4th team -> Reaches max_teams (4) -> Must auto-lock and generate bracket!
    last_reg_res = client.post(
        f"/api/tournaments/{tourn_id}/register",
        json={"team_id": teams[3]["id"]},
        headers=captains[3]["headers"]
    )
    assert last_reg_res.status_code in (200, 201)
    tourn_after_full = last_reg_res.json().get("tournament") or last_reg_res.json()
    assert tourn_after_full["status"] in ("LOCKED", "IN_PROGRESS")
    assert tourn_after_full["registered_teams_count"] == 4
    print("[PASS] 4th registration triggered automated bracket generation.")

    # Test Overbooking Prevention
    extra_player = client.post("/api/auth/signup", json={
        "username": "extra_player", "email": "extra@arenax.gg", "password": "Password123!", "role": "PLAYER"
    }).json()
    extra_team = client.post(
        "/api/teams", json={"name": "Team Extra"}, headers={"Authorization": f"Bearer {extra_player['access_token']}"}
    ).json()
    overbook_res = client.post(
        f"/api/tournaments/{tourn_id}/register",
        json={"team_id": extra_team["id"]},
        headers={"Authorization": f"Bearer {extra_player['access_token']}"}
    )
    assert overbook_res.status_code in (400, 409)
    print("[PASS] Overbooking rejected.")

    # -------------------------------------------------------------
    # FEATURE 6 & 7: Bracket Inspection & Winner Propagation
    # -------------------------------------------------------------
    print("\n--- Testing Features 6 & 7: Bracket Inspection & Winner Propagation ---")

    bracket_res = client.get(f"/api/tournaments/{tourn_id}/bracket")
    assert bracket_res.status_code == 200
    bracket_data = bracket_res.json()
    assert bracket_data["total_rounds"] == 2

    # Handle rounds list
    rounds_val = bracket_data["rounds"]
    if isinstance(rounds_val, list):
        r1_matches = rounds_val[0]["matches"]
        final_match = rounds_val[1]["matches"][0]
    else:
        r1_matches = rounds_val["1"]
        final_match = rounds_val["2"][0]

    assert len(r1_matches) == 2  # 2 Semifinal matches
    print("[PASS] Bracket tree structure verified: Round 1 (2 matches), Round 2 (1 final match).")

    # Verify self-referencing next_match_id links
    assert r1_matches[0]["next_match_id"] == final_match["id"]
    assert r1_matches[1]["next_match_id"] == final_match["id"]
    assert r1_matches[0]["status"] == "READY"
    assert r1_matches[1]["status"] == "READY"
    assert final_match["status"] == "PENDING"
    print("[PASS] Self-referencing FK pointers (next_match_id) correctly linked to Final match.")

    # Admin marks winner of Match 1 (Round 1, Match 1)
    m1 = r1_matches[0]
    winner_team_1 = m1["team1_id"]
    m1_win_res = client.post(
        f"/api/matches/{m1['id']}/winner",
        json={"winner_id": winner_team_1},
        headers=admin_headers
    )
    assert m1_win_res.status_code == 200
    assert m1_win_res.json()["status"] == "COMPLETED"
    assert m1_win_res.json()["winner_id"] == winner_team_1
    print(f"[PASS] Match 1 completed. Winner: Team {winner_team_1}.")

    # Check that parent (Final match) now has team1_id filled, but status remains PENDING
    final_check_1 = client.get(f"/api/matches/{final_match['id']}").json()
    assert final_check_1["team1_id"] == winner_team_1
    assert final_check_1["team2_id"] is None
    assert final_check_1["status"] == "PENDING"
    print("[PASS] Winner propagated to parent match slot 1. Parent status correctly remains PENDING.")

    # Admin marks winner of Match 2 (Round 1, Match 2)
    m2 = r1_matches[1]
    winner_team_2 = m2["team2_id"]
    m2_win_res = client.post(
        f"/api/matches/{m2['id']}/winner",
        json={"winner_id": winner_team_2},
        headers=admin_headers
    )
    assert m2_win_res.status_code == 200
    assert m2_win_res.json()["status"] == "COMPLETED"
    print(f"[PASS] Match 2 completed. Winner: Team {winner_team_2}.")

    # Check that parent (Final match) now has both slots filled and automatically transitioned to READY!
    final_check_2 = client.get(f"/api/matches/{final_match['id']}").json()
    assert final_check_2["team1_id"] == winner_team_1
    assert final_check_2["team2_id"] == winner_team_2
    assert final_check_2["status"] == "READY"
    print("[PASS] Final match has both competitors filled and automatically transitioned to READY!")

    # Admin selects Grand Final winner
    grand_winner = winner_team_1
    final_win_res = client.post(
        f"/api/matches/{final_match['id']}/winner",
        json={"winner_id": grand_winner},
        headers=admin_headers
    )
    assert final_win_res.status_code == 200
    assert final_win_res.json()["status"] == "COMPLETED"
    print(f"[PASS] Final match completed. Champion declared: Team {grand_winner}!")

    # Verify tournament completed and champion crowned
    completed_tourn = client.get(f"/api/tournaments/{tourn_id}").json()
    assert completed_tourn["status"] == "COMPLETED"
    assert completed_tourn["winner_team_id"] == grand_winner
    assert completed_tourn["winner_team_name"] is not None
    print(f"[PASS] Tournament status is COMPLETED. Official Champion: '{completed_tourn['winner_team_name']}'!")

    # -------------------------------------------------------------
    # BONUS TEST: Non-Power-of-Two Even Capacity (6 Teams with Byes)
    # -------------------------------------------------------------
    print("\n--- Testing 6-Team Tournament (Non-Power-of-Two with Byes) ---")
    tourn_6_res = client.post(
        "/api/tournaments",
        json={"title": "ArenaX 6-Team Invitational", "max_teams": 6},
        headers=admin_headers
    )
    assert tourn_6_res.status_code == 201
    t6_id = tourn_6_res.json()["id"]

    # Register 6 teams
    # We already have teams 1, 2, 3, 4, and extra_team (5)
    # Create 6th team
    cap6_res = client.post("/api/auth/signup", json={
        "username": "captain_6", "email": "cap6@arenax.gg", "password": "Password123!", "role": "PLAYER"
    }).json()
    team_6 = client.post(
        "/api/teams", json={"name": "Team Beta_6"}, headers={"Authorization": f"Bearer {cap6_res['access_token']}"}
    ).json()

    all_6_teams = [
        (teams[0]["id"], captains[0]["headers"]),
        (teams[1]["id"], captains[1]["headers"]),
        (teams[2]["id"], captains[2]["headers"]),
        (teams[3]["id"], captains[3]["headers"]),
        (extra_team["id"], {"Authorization": f"Bearer {extra_player['access_token']}"}),
        (team_6["id"], {"Authorization": f"Bearer {cap6_res['access_token']}"})
    ]

    for t_id, t_headers in all_6_teams:
        r = client.post(f"/api/tournaments/{t6_id}/register", json={"team_id": t_id}, headers=t_headers)
        assert r.status_code in (200, 201), f"Registration failed: {r.text}"

    b6_res = client.get(f"/api/tournaments/{t6_id}/bracket")
    assert b6_res.status_code == 200
    b6_data = b6_res.json()
    assert b6_data["status"] in ("LOCKED", "IN_PROGRESS")
    assert b6_data["total_rounds"] == 3  # 8-slot tree has 3 rounds
    rounds_val = b6_data["rounds"]
    if isinstance(rounds_val, list):
        r1_cnt = len(rounds_val[0]["matches"])
        r2_cnt = len(rounds_val[1]["matches"])
        r3_cnt = len(rounds_val[2]["matches"])
    else:
        r1_cnt = len(rounds_val["1"])
        r2_cnt = len(rounds_val["2"])
        r3_cnt = len(rounds_val["3"])
    print(f"[PASS] 6-team bracket generated with 3 rounds: {r1_cnt} R1 matches, {r2_cnt} R2 matches, {r3_cnt} Finals.")

    print("\n" + "="*60)
    print("ALL 7 ARENAX FEATURES TESTED & VERIFIED 100% OPERATIONAL!")
    print("="*60 + "\n")

if __name__ == "__main__":
    test_full_pipeline()
