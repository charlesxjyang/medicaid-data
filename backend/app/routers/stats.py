"""Overview stats and national time series endpoints."""
from typing import Optional
from fastapi import APIRouter
from functools import lru_cache
from ..db import get_db

router = APIRouter()


@router.get("/overview")
def overview():
    """KPIs: total paid, total claims, provider count, date range."""
    db = get_db()
    row = db.execute("""
        SELECT
            SUM(total_paid) AS total_paid,
            SUM(total_claims) AS total_claims,
            SUM(total_beneficiaries) AS total_beneficiaries,
            COUNT(*) AS total_providers,
            MIN(first_month) AS first_month,
            MAX(last_month) AS last_month
        FROM agg_provider_summary
    """).fetchone()
    return {
        "total_paid": row[0],
        "total_claims": row[1],
        "total_beneficiaries": row[2],
        "total_providers": row[3],
        "first_month": row[4],
        "last_month": row[5],
    }


@router.get("/timeseries/national")
def national_timeseries():
    """Monthly national spending totals for the time bar."""
    db = get_db()
    rows = db.execute("""
        SELECT month, unique_providers, total_beneficiaries, total_claims, total_paid
        FROM agg_national_monthly
        ORDER BY month
    """).fetchall()
    return [
        {
            "month": r[0],
            "unique_providers": r[1],
            "total_beneficiaries": r[2],
            "total_claims": r[3],
            "total_paid": r[4],
        }
        for r in rows
    ]


@router.get("/timeseries/state")
def state_timeseries(state: Optional[str] = None):
    """Monthly spending by state. Optionally filter to one state."""
    db = get_db()
    if state:
        rows = db.execute("""
            SELECT state, month, unique_providers, total_beneficiaries, total_claims, total_paid
            FROM agg_state_monthly
            WHERE state = ?
            ORDER BY month
        """, [state]).fetchall()
    else:
        rows = db.execute("""
            SELECT state, month, unique_providers, total_beneficiaries, total_claims, total_paid
            FROM agg_state_monthly
            ORDER BY state, month
        """).fetchall()
    return [
        {
            "state": r[0],
            "month": r[1],
            "unique_providers": r[2],
            "total_beneficiaries": r[3],
            "total_claims": r[4],
            "total_paid": r[5],
        }
        for r in rows
    ]
