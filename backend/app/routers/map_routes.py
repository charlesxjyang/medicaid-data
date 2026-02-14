"""Map data endpoints."""
from typing import Optional
from fastapi import APIRouter, Query
from fastapi.responses import FileResponse
from ..db import get_db
import os

router = APIRouter()

ARROW_PATH = os.environ.get(
    "ARROW_PATH",
    "/Users/charl/Programming/medicaid/frontend/public/data/providers.arrow"
)


@router.get("/providers/arrow")
def providers_arrow():
    """Serve the pre-built Arrow file for the map."""
    if os.path.exists(ARROW_PATH):
        return FileResponse(
            ARROW_PATH,
            media_type="application/octet-stream",
            headers={"Content-Disposition": "attachment; filename=providers.arrow"},
        )
    return {"error": "Arrow file not found. Run the data pipeline first."}


@router.get("/providers")
def providers_json(
    state: Optional[str] = None,
    month_from: Optional[str] = None,
    month_to: Optional[str] = None,
    limit: int = 5000,
):
    """Filtered provider map data as JSON (for filtered views)."""
    db = get_db()

    conditions = []
    params = []

    if state:
        conditions.append("state = ?")
        params.append(state)

    where = f"WHERE lat IS NOT NULL AND lng IS NOT NULL"
    if conditions:
        where += " AND " + " AND ".join(conditions)

    # If time filters are set, we need to re-aggregate from monthly data
    if month_from or month_to:
        time_conds = []
        if month_from:
            time_conds.append("m.month >= ?")
            params.insert(0, month_from)
        if month_to:
            time_conds.append("m.month <= ?")
            params.insert(len(params) - (1 if state else 0), month_to)

        time_where = " AND ".join(time_conds)

        # Rebuild from monthly aggregates with time filter
        rows = db.execute(f"""
            SELECT
                p.npi, p.name, p.state, p.city, p.lat, p.lng,
                SUM(m.total_paid) AS total_paid,
                SUM(m.total_claims) AS total_claims,
                SUM(m.total_beneficiaries) AS total_beneficiaries
            FROM map_providers p
            JOIN agg_provider_monthly m ON m.npi = p.npi
            WHERE p.lat IS NOT NULL AND p.lng IS NOT NULL
                AND {time_where}
                {"AND p.state = ?" if state else ""}
            GROUP BY p.npi, p.name, p.state, p.city, p.lat, p.lng
            ORDER BY total_paid DESC
            LIMIT ?
        """, params + [limit]).fetchall()
    else:
        rows = db.execute(f"""
            SELECT npi, name, state, city, lat, lng, total_paid, total_claims, total_beneficiaries
            FROM map_providers
            {where}
            ORDER BY total_paid DESC
            LIMIT ?
        """, params + [limit]).fetchall()

    return [
        {
            "npi": r[0], "name": r[1], "state": r[2], "city": r[3],
            "lat": r[4], "lng": r[5], "total_paid": r[6],
            "total_claims": r[7], "total_beneficiaries": r[8],
        }
        for r in rows
    ]


@router.get("/providers/procedure/{code}")
def providers_by_procedure(
    code: str,
    state: Optional[str] = None,
    limit: int = 2000,
):
    """Providers performing a specific procedure, with location and spending."""
    db = get_db()
    params: list = [code]
    state_filter = ""
    if state:
        state_filter = "AND m.state = ?"
        params.append(state)
    params.append(limit)

    rows = db.execute(f"""
        SELECT
            m.npi, m.name, m.state, m.city, m.lat, m.lng,
            p.total_paid, p.total_claims, p.total_beneficiaries
        FROM agg_provider_procedure p
        JOIN map_providers m ON m.npi = p.npi
        WHERE p.hcpcs_code = ?
          AND m.lat IS NOT NULL AND m.lng IS NOT NULL
          {state_filter}
        ORDER BY p.total_paid DESC
        LIMIT ?
    """, params).fetchall()

    return [
        {
            "npi": r[0], "name": r[1], "state": r[2], "city": r[3],
            "lat": r[4], "lng": r[5], "total_paid": r[6],
            "total_claims": r[7], "total_beneficiaries": r[8],
        }
        for r in rows
    ]
