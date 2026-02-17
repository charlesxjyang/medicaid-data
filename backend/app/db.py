"""DuckDB connection management for FastAPI."""
import threading
import duckdb
import os

DB_PATH = os.environ.get("DUCKDB_PATH", "/Users/charl/Programming/medicaid/medicaid.duckdb")

_local = threading.local()


def _is_motherduck() -> bool:
    return DB_PATH.startswith("md:")


def get_db() -> duckdb.DuckDBPyConnection:
    """Get a thread-local DuckDB connection (read-only)."""
    if not hasattr(_local, "conn") or _local.conn is None:
        if _is_motherduck():
            _local.conn = duckdb.connect(DB_PATH)
        else:
            _local.conn = duckdb.connect(DB_PATH, read_only=True)
    return _local.conn
