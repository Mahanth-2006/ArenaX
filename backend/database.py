import os
import json
from contextlib import contextmanager
import mysql.connector
from mysql.connector import pooling, Error
from dotenv import load_dotenv

# Load environment configuration
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_USER = os.getenv("DB_USER", "arenax")
DB_PASSWORD = os.getenv("DB_PASSWORD", "arenax_pass")
DB_NAME = os.getenv("DB_NAME", "arenax_db")

# Automatically parse full database URL if provided by cloud platforms (e.g. Railway, Render)
db_url = os.getenv("DATABASE_URL") or os.getenv("MYSQL_URL")
if db_url:
    from urllib.parse import urlparse
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

pool = None

def init_db_pool():
    global pool
    if pool is None:
        pool = pooling.MySQLConnectionPool(
            pool_name="arenax_pool",
            pool_size=10,
            pool_reset_session=True,
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            charset="utf8mb4",
            autocommit=False
        )
    return pool

def get_connection():
    global pool
    if pool is None:
        init_db_pool()
    return pool.get_connection()

@contextmanager
def get_db_cursor(commit=False, dictionary=True, buffered=True):
    """Context manager yielding cursor and connection, handling commits and rollbacks."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=dictionary, buffered=buffered)
    try:
        yield cursor, conn
        if commit:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass

def query_one(query: str, params: tuple = None, dictionary: bool = True):
    with get_db_cursor(commit=False, dictionary=dictionary, buffered=True) as (cursor, conn):
        cursor.execute(query, params or ())
        row = cursor.fetchone()
        try:
            cursor.fetchall()
        except Exception:
            pass
        return row

def query_all(query: str, params: tuple = None, dictionary: bool = True):
    with get_db_cursor(commit=False, dictionary=dictionary, buffered=True) as (cursor, conn):
        cursor.execute(query, params or ())
        return cursor.fetchall()

def execute_dml(query: str, params: tuple = None, return_last_id: bool = False, commit: bool = True):
    with get_db_cursor(commit=commit, dictionary=True) as (cursor, conn):
        cursor.execute(query, params or ())
        last_id = cursor.lastrowid
        rowcount = cursor.rowcount
        if return_last_id:
            return last_id
        return rowcount

def log_transaction(action: str, actor: str, statements: list, status: str = "COMMITTED"):
    """Records an executed transaction into transaction_log for the Database Lens."""
    try:
        stmt_json = json.dumps(statements)
        execute_dml(
            "INSERT INTO transaction_log (action, actor, statements, status) VALUES (%s, %s, %s, %s)",
            (action, actor or "system", stmt_json, status),
            commit=True
        )
    except Exception as e:
        print(f"Warning: Failed to record transaction log: {e}")
