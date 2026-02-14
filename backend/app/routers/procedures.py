"""Procedure search and time series endpoints."""
from typing import Optional
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
def top_procedures(state: Optional[str] = None, limit: int = 25):
    """Top procedures by total spending. Optionally filter by state."""
    db = get_db()
    if state:
        rows = db.execute("""
            SELECT
                p.hcpcs_code,
                COALESCE(NULLIF(h.short_description, ''), p.hcpcs_code) AS description,
                COUNT(DISTINCT p.npi) AS unique_providers,
                SUM(p.total_paid) AS total_paid,
                SUM(p.total_claims) AS total_claims
            FROM agg_provider_procedure p
            JOIN map_providers m ON m.npi = p.npi
            LEFT JOIN hcpcs_codes h ON h.hcpcs_code = p.hcpcs_code
            WHERE m.state = ?
            GROUP BY p.hcpcs_code, h.short_description
            ORDER BY total_paid DESC
            LIMIT ?
        """, [state, limit]).fetchall()
    else:
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


@router.get("/benchmarks")
def procedure_benchmarks(codes: str, state: Optional[str] = None):
    """Return national and optional state avg $/claim for a list of procedure codes."""
    db = get_db()
    code_list = [c.strip() for c in codes.split(",") if c.strip()]
    if not code_list:
        return []

    placeholders = ",".join(["?"] * len(code_list))

    # National averages
    national = db.execute(f"""
        SELECT hcpcs_code,
               SUM(total_paid) / NULLIF(SUM(total_claims), 0) AS avg_per_claim
        FROM agg_provider_procedure
        WHERE hcpcs_code IN ({placeholders})
        GROUP BY hcpcs_code
    """, code_list).fetchall()
    national_map = {r[0]: r[1] for r in national}

    # State averages
    state_map = {}
    if state:
        state_rows = db.execute(f"""
            SELECT p.hcpcs_code,
                   SUM(p.total_paid) / NULLIF(SUM(p.total_claims), 0) AS avg_per_claim
            FROM agg_provider_procedure p
            JOIN map_providers m ON m.npi = p.npi
            WHERE p.hcpcs_code IN ({placeholders})
              AND m.state = ?
            GROUP BY p.hcpcs_code
        """, code_list + [state]).fetchall()
        state_map = {r[0]: r[1] for r in state_rows}

    return [
        {
            "hcpcs_code": code,
            "national_per_claim": national_map.get(code),
            "state_per_claim": state_map.get(code),
        }
        for code in code_list
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


@router.get("/{code}/avg-reimbursement")
def procedure_avg_reimbursement(
    code: str,
    sort: str = Query("desc", pattern="^(asc|desc)$"),
    limit: int = 50,
):
    """Top providers by avg $/claim for a procedure, plus national average."""
    db = get_db()
    direction = "ASC" if sort == "asc" else "DESC"
    rows = db.execute(f"""
        SELECT
            p.npi,
            COALESCE(m.name, p.npi) AS name,
            m.state,
            p.total_paid / NULLIF(p.total_claims, 0) AS avg_per_claim,
            p.total_claims,
            p.total_paid
        FROM agg_provider_procedure p
        LEFT JOIN map_providers m ON m.npi = p.npi
        WHERE p.hcpcs_code = ?
          AND p.total_claims > 0
        ORDER BY avg_per_claim {direction}
        LIMIT ?
    """, [code, limit]).fetchall()

    nat = db.execute("""
        SELECT SUM(total_paid) / NULLIF(SUM(total_claims), 0)
        FROM agg_provider_procedure
        WHERE hcpcs_code = ? AND total_claims > 0
    """, [code]).fetchone()

    return {
        "national_avg": nat[0] if nat else None,
        "providers": [
            {
                "npi": r[0],
                "name": r[1],
                "state": r[2],
                "avg_per_claim": r[3],
                "total_claims": r[4],
                "total_paid": r[5],
            }
            for r in rows
        ],
    }


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
