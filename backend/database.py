import os
import json
from contextlib import contextmanager
from urllib.parse import urlparse
from dotenv import load_dotenv
import psycopg2
from psycopg2 import pool, extras, Error

# Load environment configuration from .env in backend directory
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "arenax_db")

# Parse DATABASE_URL if provided
db_url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
if db_url:
    parsed = urlparse(db_url)
    if parsed.hostname:
        DB_HOST = parsed.hostname
    if parsed.port:
        DB_PORT = parsed.port
    if parsed.username:
        DB_USER = parsed.username
    if parsed.password:
        DB_PASSWORD = parsed.password
    if parsed.path and len(parsed.path) > 1:
        DB_NAME = parsed.path.lstrip("/")

_pool = None

def init_db_pool():
    global _pool
    if _pool is None:
        _pool = pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=20,
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            dbname=DB_NAME
        )
    return _pool

def get_connection():
    global _pool
    if _pool is None:
        init_db_pool()
    return _pool.getconn()

def release_connection(conn):
    global _pool
    if _pool is not None and conn is not None:
        try:
            _pool.putconn(conn)
        except Exception:
            pass

@contextmanager
def get_db_cursor(commit=False, dictionary=True, buffered=True):
    """Context manager yielding cursor and connection, handling commits, rollbacks, and pool release."""
    conn = get_connection()
    cursor_factory = extras.RealDictCursor if dictionary else None
    cursor = conn.cursor(cursor_factory=cursor_factory)
    try:
        yield cursor, conn
        if commit:
            conn.commit()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        release_connection(conn)

def query_one(query: str, params: tuple = None, dictionary: bool = True):
    with get_db_cursor(commit=False, dictionary=dictionary) as (cursor, conn):
        cursor.execute(query, params or ())
        row = cursor.fetchone()
        return dict(row) if (row is not None and dictionary and not isinstance(row, dict)) else row

def query_all(query: str, params: tuple = None, dictionary: bool = True):
    with get_db_cursor(commit=False, dictionary=dictionary) as (cursor, conn):
        cursor.execute(query, params or ())
        rows = cursor.fetchall()
        return [dict(r) if (dictionary and not isinstance(r, dict)) else r for r in rows]

def execute_dml(query: str, params: tuple = None, return_last_id: bool = False, commit: bool = True):
    clean_q = query.strip()
    if return_last_id and clean_q.upper().startswith("INSERT") and "RETURNING" not in clean_q.upper():
        clean_q = clean_q.rstrip().rstrip(";") + " RETURNING id"

    with get_db_cursor(commit=commit, dictionary=True) as (cursor, conn):
        cursor.execute(clean_q, params or ())
        last_id = None
        if return_last_id:
            row = cursor.fetchone()
            if row:
                last_id = row["id"] if isinstance(row, dict) else row[0]
        rowcount = cursor.rowcount
        if return_last_id:
            return last_id
        return rowcount

def log_transaction(action: str, actor: str, statements: list, status: str = "COMMITTED"):
    """Records an executed transaction into transaction_log."""
    try:
        stmt_json = json.dumps(statements)
        execute_dml(
            "INSERT INTO transaction_log (action, actor, statements, status) VALUES (%s, %s, %s, %s)",
            (action, actor or "system", stmt_json, status),
            commit=True
        )
    except Exception as e:
        print(f"Warning: Failed to record transaction log: {e}")
