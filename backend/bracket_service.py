import math
from typing import List

ROUND_NAMES = {
    1: ['Final'],
    2: ['Semifinals', 'Final'],
    3: ['Quarterfinals', 'Semifinals', 'Final'],
    4: ['Round of 16', 'Quarterfinals', 'Semifinals', 'Final'],
    5: ['Round of 32', 'Round of 16', 'Quarterfinals', 'Semifinals', 'Final'],
}

ROUND_ABBR = {
    'Round of 32': 'R32',
    'Round of 16': 'R16',
    'Quarterfinals': 'QF',
    'Semifinals': 'SF',
    'Final': 'F'
}

def seed_order(n: int) -> List[int]:
    """Generates standard tournament seeding pairings."""
    arr = [1]
    while len(arr) < n:
        next_arr = []
        for s in arr:
            next_arr.extend([s, len(arr) * 2 + 1 - s])
        arr = next_arr
    return arr

def generate_bracket_tree(cursor, tournament_id: int, capacity: int, registered_team_ids: List[int]):
    """
    Constructs a complete single-elimination tournament bracket tree in MySQL.
    Populates sequential match numbers, round names, abbreviations, and self-referencing next_match_id / next_match_slot.
    """
    p = 1
    while p < capacity:
        p *= 2

    total_rounds = int(math.log2(p)) if p > 1 else 1
    names = ROUND_NAMES.get(total_rounds, [f"Round {r}" for r in range(1, total_rounds + 1)])

    # We need total (p - 1) matches
    # Build per-round match lists: round 1 has p/2 matches, round 2 has p/4...
    per_round = []
    match_number = 0

    for r in range(total_rounds):
        round_num = r + 1
        count = p // (2 ** (r + 1))
        r_name = names[r] if r < len(names) else f"Round {round_num}"
        r_abbr = ROUND_ABBR.get(r_name, f"R{round_num}")
        round_matches = []

        for i in range(count):
            match_number += 1
            cursor.execute(
                """
                INSERT INTO matches (
                    tournament_id, number, round_number, match_order, round_name, abbr, 
                    team1_id, team2_id, status
                ) VALUES (%s, %s, %s, %s, %s, %s, NULL, NULL, 'PENDING')
                """,
                (tournament_id, match_number, round_num, i + 1, r_name, r_abbr)
            )
            m_id = cursor.lastrowid
            round_matches.append(m_id)

        per_round.append(round_matches)

    # Link child matches to parent matches in the next round
    for r in range(total_rounds - 1):
        child_ids = per_round[r]
        parent_ids = per_round[r + 1]
        for i, child_id in enumerate(child_ids):
            parent_id = parent_ids[i // 2]
            slot = 1 if (i % 2 == 0) else 2
            cursor.execute(
                "UPDATE matches SET next_match_id = %s, next_match_slot = %s WHERE id = %s",
                (parent_id, slot, child_id)
            )

    # Populate registered teams
    byes_count = p - capacity
    if byes_count == 0:
        # Exact power of 2
        order = seed_order(capacity)
        # Map seed -> team_id
        team_by_seed = {idx + 1: team_id for idx, team_id in enumerate(registered_team_ids)}
        round1_match_ids = per_round[0]

        for i, match_id in enumerate(round1_match_ids):
            seed1 = order[i * 2]
            seed2 = order[i * 2 + 1]
            t1 = team_by_seed.get(seed1)
            t2 = team_by_seed.get(seed2)
            cursor.execute(
                "UPDATE matches SET team1_id = %s, team2_id = %s, status = 'READY' WHERE id = %s",
                (t1, t2, match_id)
            )
    else:
        # Even number with byes
        bye_teams = registered_team_ids[:byes_count]
        r1_teams = registered_team_ids[byes_count:]
        round1_match_ids = per_round[0]
        r1_needed = len(r1_teams) // 2

        for i in range(r1_needed):
            match_id = round1_match_ids[i]
            t1 = r1_teams[i * 2]
            t2 = r1_teams[i * 2 + 1]
            cursor.execute(
                "UPDATE matches SET team1_id = %s, team2_id = %s, status = 'READY' WHERE id = %s",
                (t1, t2, match_id)
            )

        if total_rounds > 1:
            round2_match_ids = per_round[1]
            for b_idx, bye_team_id in enumerate(bye_teams):
                target_r2 = round2_match_ids[b_idx % len(round2_match_ids)]
                cursor.execute("SELECT team1_id, team2_id FROM matches WHERE id = %s", (target_r2,))
                row = cursor.fetchone()
                if row["team1_id"] is None:
                    cursor.execute("UPDATE matches SET team1_id = %s WHERE id = %s", (bye_team_id, target_r2))
                else:
                    cursor.execute("UPDATE matches SET team2_id = %s WHERE id = %s", (bye_team_id, target_r2))

    return match_number
