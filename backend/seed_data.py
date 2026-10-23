import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from database import execute_dml, get_db_cursor
from auth_utils import hash_password

def clean_database():
    """Wipes all existing tables and resets IDs cleanly in PostgreSQL."""
    print("[DB] Cleaning all tables and resetting sequences...")
    with get_db_cursor(commit=True) as (cursor, conn):
        cursor.execute(
            """
            TRUNCATE TABLE 
                transaction_log, 
                notifications, 
                matches, 
                tournament_registrations, 
                tournaments, 
                team_members, 
                teams, 
                users 
            RESTART IDENTITY CASCADE;
            """
        )
    print("[DB] Database cleared of all test data.")

def seed():
    clean_database()

    # Create one clean default administrator: admin / admin123
    execute_dml(
        """
        INSERT INTO users (username, email, password_hash, full_name, role, status)
        VALUES ('admin', 'admin@arenax.gg', %s, 'admin', 'ADMIN', 'ACTIVE')
        """,
        (hash_password("admin123"),)
    )

    execute_dml(
        """
        INSERT INTO transaction_log (action, actor, statements, status)
        VALUES ('clean_reset', 'system', '["Database wiped clean. Ready for testing."]', 'COMMITTED')
        """
    )
    print("[DB] Clean initial state ready. Admin account: admin / admin123")

if __name__ == "__main__":
    seed()
