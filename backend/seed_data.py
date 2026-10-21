import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from database import query_one, execute_dml, get_db_cursor
from auth_utils import hash_password

def seed():
    print("Seeding rich ArenaX database...")

    with get_db_cursor(commit=True) as (cursor, conn):
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
        cursor.execute("DELETE FROM transaction_log;")
        cursor.execute("DELETE FROM notifications;")
        cursor.execute("DELETE FROM matches;")
        cursor.execute("DELETE FROM tournament_registrations;")
        cursor.execute("DELETE FROM tournaments;")
        cursor.execute("DELETE FROM team_members;")
        cursor.execute("DELETE FROM teams;")
        cursor.execute("DELETE FROM users;")
        cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")

    # 1. Admin
    admin_id = execute_dml(
        """
        INSERT INTO users (username, email, password_hash, full_name, role, status)
        VALUES ('admin', 'admin@arenax.gg', %s, 'Ada Admin', 'ADMIN', 'ACTIVE')
        """,
        (hash_password("admin123"),),
        return_last_id=True
    )
    print("Created Admin: admin / admin123")

    # 2. Teams & Captains & Members
    teams_def = [
        {"name": "Team Nova", "tag": "NOVA", "captain": ("alex", "Alex Mathew"), "members": [("aarav", "Aarav Shah"), ("bianca", "Bianca Torres"), ("chen", "Chen Wei"), ("diego", "Diego Ramirez")]},
        {"name": "Iron Falcons", "tag": "IRON", "captain": ("ryan", "Ryan Okafor"), "members": [("meera", "Meera Nair"), ("noah", "Noah Lindqvist"), ("zara", "Zara Ahmed")]},
        {"name": "Crimson Vanguard", "tag": "CRIM", "captain": ("kai", "Kai Tanaka"), "members": [("lina", "Lina Petrova"), ("omar", "Omar Haddad"), ("esha", "Esha Kapoor"), ("vik", "Viktor Sokolov")]},
        {"name": "Shadow Wolves", "tag": "WOLF", "captain": ("neo", "Neo Martins"), "members": [("mia", "Mia Zhang"), ("ken", "Kenji Watanabe"), ("sara", "Sara Osman")]},
        {"name": "Neon Drift", "tag": "DRFT", "captain": ("juno", "Juno Park"), "members": [("rex", "Rex Callahan"), ("tia", "Tia Fernandes"), ("aman", "Aman Verma")]},
        {"name": "Quantum Raiders", "tag": "QTM", "captain": ("zane", "Zane Novak"), "members": [("ira", "Ira Malhotra"), ("leo", "Leo Fischer"), ("nadya", "Nadya Volkova"), ("russ", "Russell Byte")]},
        {"name": "Solar Flare", "tag": "SOLR", "captain": ("elio", "Elio Costa"), "members": [("maya", "Maya Iyer"), ("finn", "Finn O'Sullivan")]},
        {"name": "Void Walkers", "tag": "VOID", "captain": ("nyx", "Nyx Arkadia"), "members": [("orion", "Orion Blaze"), ("lyra", "Lyra Vex"), ("jax", "Jax Meridian")]},
    ]

    for t_info in teams_def:
        cap_uname, cap_fname = t_info["captain"]
        cap_id = execute_dml(
            "INSERT INTO users (username, email, password_hash, full_name, role, status) VALUES (%s, %s, %s, %s, 'PLAYER', 'ACTIVE')",
            (cap_uname, f"{cap_uname}@arenax.gg", hash_password(f"{cap_uname}123"), cap_fname),
            return_last_id=True
        )

        team_id = execute_dml(
            "INSERT INTO teams (name, tag, captain_id) VALUES (%s, %s, %s)",
            (t_info["name"], t_info["tag"], cap_id),
            return_last_id=True
        )

        execute_dml(
            "INSERT INTO team_members (team_id, user_id, role) VALUES (%s, %s, 'CAPTAIN')",
            (team_id, cap_id)
        )

        for m_uname, m_fname in t_info["members"]:
            m_id = execute_dml(
                "INSERT INTO users (username, email, password_hash, full_name, role, status) VALUES (%s, %s, %s, %s, 'PLAYER', 'ACTIVE')",
                (m_uname, f"{m_uname}@arenax.gg", hash_password(f"{m_uname}123"), m_fname),
                return_last_id=True
            )
            execute_dml(
                "INSERT INTO team_members (team_id, user_id, role) VALUES (%s, %s, 'MEMBER')",
                (team_id, m_id)
            )

    print(f"Created {len(teams_def)} seeded teams and all member rosters.")

    # 3. Free Agents (available for roster additions)
    free_agents = [
        ("gabe", "Gabe Whitmore"),
        ("hana", "Hana Sato"),
        ("ivan", "Ivan Drago"),
        ("jess", "Jess Rivera")
    ]
    for fa_uname, fa_fname in free_agents:
        execute_dml(
            "INSERT INTO users (username, email, password_hash, full_name, role, status) VALUES (%s, %s, %s, %s, 'PLAYER', 'ACTIVE')",
            (fa_uname, f"{fa_uname}@arenax.gg", hash_password(f"{fa_uname}123"), fa_fname)
        )
    print(f"Created {len(free_agents)} free agent players.")

    # 4. Sample Tournaments
    t1_id = execute_dml(
        """
        INSERT INTO tournaments (name, title, description, capacity, max_teams, format, status, organizer_id)
        VALUES ('VIT Inter-College Championship', 'VIT Inter-College Championship', 'Premier collegiate esports showdown with 8 top teams.', 8, 8, 'SINGLE_ELIMINATION', 'REGISTRATION_OPEN', %s)
        """,
        (admin_id,),
        return_last_id=True
    )

    t2_id = execute_dml(
        """
        INSERT INTO tournaments (name, title, description, capacity, max_teams, format, status, organizer_id)
        VALUES ('Apex Duo Showdown 2026', 'Apex Duo Showdown 2026', 'Fast-paced 4-team elimination bracket.', 4, 4, 'SINGLE_ELIMINATION', 'REGISTRATION_OPEN', %s)
        """,
        (admin_id,),
        return_last_id=True
    )

    # Initial transaction logs
    execute_dml(
        """
        INSERT INTO transaction_log (action, actor, statements, status)
        VALUES ('seed_database', 'system', '["Database reset and seeded with 3NF relational schema."]', 'COMMITTED')
        """
    )

    print("ArenaX database seeding completed successfully!")

if __name__ == "__main__":
    seed()
