"""Procedure search and time series endpoints."""
from fastapi import APIRouter, Query
from ..db import get_db

router = APIRouter()


@router.get("/search")
def search_procedures(q: str = Query(..., min_length=1), limit: int = 20):
    """Search HCPCS procedures by code or description."""
    db = get_db()
    rows = db.execute("""
        SELECT hcpcs_code, short_description, unique_providers, total_paid
        FROM hcpcs_codes
        WHERE
            hcpcs_code ILIKE ? OR
            short_description ILIKE ?
        ORDER BY total_paid DESC
        LIMIT ?
    """, [f"%{q}%", f"%{q}%", limit]).fetchall()
    return [
        {
            "hcpcs_code": r[0],
            "description": r[1],
            "unique_providers": r[2],
            "total_paid": r[3],
        }
        for r in rows
    ]


@router.get("/top")
def top_procedures(limit: int = 25):
    """Top procedures by total spending."""
    db = get_db()
    rows = db.execute("""
        SELECT h.hcpcs_code, h.short_description, h.unique_providers, h.total_paid,
               a.total_claims
        FROM hcpcs_codes h
        LEFT JOIN agg_procedure_summary a ON a.hcpcs_code = h.hcpcs_code
        ORDER BY h.total_paid DESC
        LIMIT ?
    """, [limit]).fetchall()
    return [
        {
            "hcpcs_code": r[0],
            "description": r[1],
            "unique_providers": r[2],
            "total_paid": r[3],
            "total_claims": r[4],
        }
        for r in rows
    ]


@router.get("/{code}/detail")
def procedure_detail(code: str):
    """Procedure summary info."""
    db = get_db()
    row = db.execute("""
        SELECT h.hcpcs_code, h.short_description, h.unique_providers, h.total_paid,
               a.total_claims, a.total_beneficiaries
        FROM hcpcs_codes h
        LEFT JOIN agg_procedure_summary a ON a.hcpcs_code = h.hcpcs_code
        WHERE h.hcpcs_code = ?
    """, [code]).fetchone()
    if not row:
        return {"error": "Procedure not found"}
    return {
        "hcpcs_code": row[0],
        "description": row[1],
        "unique_providers": row[2],
        "total_paid": row[3],
        "total_claims": row[4],
        "total_beneficiaries": row[5],
    }


@router.get("/{code}/providers")
def procedure_providers(code: str, limit: int = 25):
    """Top providers for a given procedure by spending."""
    db = get_db()
    rows = db.execute("""
        SELECT
            p.npi,
            COALESCE(m.name, p.npi) AS name,
            m.state,
            m.city,
            p.total_beneficiaries,
            p.total_claims,
            p.total_paid
        FROM agg_provider_procedure p
        LEFT JOIN map_providers m ON m.npi = p.npi
        WHERE p.hcpcs_code = ?
        ORDER BY p.total_paid DESC
        LIMIT ?
    """, [code, limit]).fetchall()
    return [
        {
            "npi": r[0],
            "name": r[1],
            "state": r[2],
            "city": r[3],
            "total_beneficiaries": r[4],
            "total_claims": r[5],
            "total_paid": r[6],
        }
        for r in rows
    ]


@router.get("/{code}/timeseries")
def procedure_timeseries(code: str):
    """Monthly spending for one procedure code."""
    db = get_db()
    rows = db.execute("""
        SELECT month, total_beneficiaries, total_claims, total_paid
        FROM agg_procedure_monthly
        WHERE hcpcs_code = ?
        ORDER BY month
    """, [code]).fetchall()
    return [
        {
            "month": r[0],
            "total_beneficiaries": r[1],
            "total_claims": r[2],
            "total_paid": r[3],
        }
        for r in rows
    ]
