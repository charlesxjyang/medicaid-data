"""Provider search, detail, and drill-down endpoints."""
import logging
from typing import Optional
from fastapi import APIRouter, Query
from ..db import get_db

logger = logging.getLogger(__name__)

router = APIRouter()

_oig_cache: dict = {}


def _has_oig_table(db) -> bool:
    """Check if oig_exclusions table exists (only caches True)."""
    if _oig_cache.get("result"):
        return True
    try:
        db.execute("SELECT 1 FROM oig_exclusions LIMIT 0")
        _oig_cache["result"] = True
        logger.info("oig_exclusions table found")
        return True
    except Exception as e:
        logger.warning("oig_exclusions table not found: %s", e)
        return False


@router.get("/debug/oig")
def debug_oig():
    """Debug endpoint: check OIG table accessibility."""
    db = get_db()
    has_table = _has_oig_table(db)
    result = {"has_oig_table": has_table, "cache": dict(_oig_cache)}
    if has_table:
        count = db.execute("SELECT COUNT(*) FROM oig_exclusions").fetchone()
        result["row_count"] = count[0] if count else 0
        # Check for specific test NPI
        test = db.execute(
            "SELECT npi, excltype FROM oig_exclusions WHERE npi = '1164013959'"
        ).fetchone()
        result["test_npi_1164013959"] = {"npi": test[0], "excltype": test[1]} if test else None
    return result


@router.get("/search")
def search_providers(q: str = Query(..., min_length=2), limit: int = 20, offset: int = 0):
    """Autocomplete search by provider name or NPI.

    Splits multi-word queries so 'Eric Lund' matches 'LUND, ERIC'.
    """
    db = get_db()
    words = q.strip().split()
    # Each word must appear somewhere in the name
    name_conditions = " AND ".join(["name ILIKE ?"] * len(words))
    name_params = [f"%{w}%" for w in words]

    rows = db.execute(f"""
        SELECT npi, name, state, city, total_paid, total_claims
        FROM map_providers
        WHERE
            npi ILIKE ? OR
            ({name_conditions})
        ORDER BY total_paid DESC
        LIMIT ?
        OFFSET ?
    """, [f"%{q}%"] + name_params + [limit, offset]).fetchall()
    return [
        {
            "npi": r[0],
            "name": r[1],
            "state": r[2],
            "city": r[3],
            "total_paid": r[4],
            "total_claims": r[5],
        }
        for r in rows
    ]


@router.get("/top")
def top_providers(
    state: Optional[str] = None,
    limit: int = 25,
    offset: int = 0,
    sort_by: str = "total_paid",
):
    """Top providers by spending. Optionally filter by state."""
    allowed_sort = {"total_paid", "total_claims", "total_beneficiaries", "per_claim"}
    if sort_by not in allowed_sort:
        sort_by = "total_paid"

    db = get_db()
    has_oig = _has_oig_table(db)

    oig_select = ", (o.npi IS NOT NULL) AS is_excluded" if has_oig else ", FALSE AS is_excluded"
    oig_join = "LEFT JOIN (SELECT DISTINCT npi FROM oig_exclusions) o ON o.npi = mp.npi" if has_oig else ""

    if sort_by == "per_claim":
        order_clause = "(mp.total_paid / NULLIF(mp.total_claims, 0)) DESC NULLS LAST, mp.npi"
    else:
        order_clause = f"mp.{sort_by} DESC, mp.npi"

    if state:
        rows = db.execute(f"""
            SELECT mp.npi, mp.name, mp.state, mp.city, mp.total_paid,
                   mp.total_claims, mp.total_beneficiaries
                   {oig_select}
            FROM map_providers mp
            {oig_join}
            WHERE mp.state = ?
            ORDER BY {order_clause}
            LIMIT ?
            OFFSET ?
        """, [state, limit, offset]).fetchall()
    else:
        rows = db.execute(f"""
            SELECT mp.npi, mp.name, mp.state, mp.city, mp.total_paid,
                   mp.total_claims, mp.total_beneficiaries
                   {oig_select}
            FROM map_providers mp
            {oig_join}
            ORDER BY {order_clause}
            LIMIT ?
            OFFSET ?
        """, [limit, offset]).fetchall()
    return [
        {
            "npi": r[0],
            "name": r[1],
            "state": r[2],
            "city": r[3],
            "total_paid": r[4],
            "total_claims": r[5],
            "total_beneficiaries": r[6],
            "is_excluded": bool(r[7]),
        }
        for r in rows
    ]


@router.get("/{npi}")
def provider_detail(npi: str):
    """Full provider detail including NPPES info and spending stats."""
    db = get_db()

    # Spending summary
    summary = db.execute("""
        SELECT npi, name, state, city, zip, lat, lng,
               total_paid, total_claims, total_beneficiaries, unique_procedures,
               first_month, last_month
        FROM map_providers
        WHERE npi = ?
    """, [npi]).fetchone()

    if not summary:
        return {"error": "Provider not found"}

    # NPPES details
    nppes = db.execute("""
        SELECT org_name, first_name, last_name, credentials, taxonomy_1,
               practice_address_1, practice_city, practice_state, practice_zip,
               practice_phone, enumeration_date, sex
        FROM nppes
        WHERE CAST(npi AS VARCHAR) = ?
    """, [npi]).fetchone()

    # OIG exclusion check
    exclusion = None
    if _has_oig_table(db):
        oig_row = db.execute("""
            SELECT excltype, excldate, reindate
            FROM oig_exclusions
            WHERE npi = ?
            LIMIT 1
        """, [npi]).fetchone()
        if oig_row:
            exclusion = {
                "is_excluded": True,
                "exclusion_type": oig_row[0],
                "exclusion_date": oig_row[1],
                "reinstatement_date": oig_row[2] if oig_row[2] else None,
            }

    result = {
        "npi": summary[0],
        "name": summary[1],
        "state": summary[2],
        "city": summary[3],
        "zip": summary[4],
        "lat": summary[5],
        "lng": summary[6],
        "total_paid": summary[7],
        "total_claims": summary[8],
        "total_beneficiaries": summary[9],
        "unique_procedures": summary[10],
        "first_month": summary[11],
        "last_month": summary[12],
        "is_excluded": exclusion["is_excluded"] if exclusion else False,
        "exclusion": exclusion,
    }

    if nppes:
        result["nppes"] = {
            "org_name": nppes[0],
            "first_name": nppes[1],
            "last_name": nppes[2],
            "credentials": nppes[3],
            "taxonomy": nppes[4],
            "address": nppes[5],
            "city": nppes[6],
            "state": nppes[7],
            "zip": nppes[8],
            "phone": nppes[9],
            "enumeration_date": str(nppes[10]) if nppes[10] else None,
            "sex": nppes[11],
        }

    return result


@router.get("/{npi}/timeseries")
def provider_timeseries(npi: str):
    """Monthly spending for one provider."""
    db = get_db()
    rows = db.execute("""
        SELECT month, total_beneficiaries, total_claims, total_paid
        FROM agg_provider_monthly
        WHERE npi = ?
        ORDER BY month
    """, [npi]).fetchall()
    return [
        {
            "month": r[0],
            "total_beneficiaries": r[1],
            "total_claims": r[2],
            "total_paid": r[3],
        }
        for r in rows
    ]


@router.get("/{npi}/procedure-timeseries")
def provider_procedure_timeseries(npi: str, limit: int = 4):
    """Monthly spending broken out by top N procedures for a provider."""
    db = get_db()
    # Get top procedures by total spend
    top = db.execute("""
        SELECT hcpcs_code
        FROM agg_provider_procedure
        WHERE npi = ?
        ORDER BY total_paid DESC
        LIMIT ?
    """, [npi, limit]).fetchall()
    top_codes = [r[0] for r in top]
    if not top_codes:
        return {"procedures": [], "series": []}

    placeholders = ",".join(["?"] * len(top_codes))

    # Get descriptions
    descs = db.execute(f"""
        SELECT hcpcs_code, short_description
        FROM hcpcs_codes
        WHERE hcpcs_code IN ({placeholders})
    """, top_codes).fetchall()
    desc_map = {r[0]: r[1] or r[0] for r in descs}

    # Get monthly data
    rows = db.execute(f"""
        SELECT month, hcpcs_code, total_paid
        FROM agg_provider_procedure_monthly
        WHERE npi = ? AND hcpcs_code IN ({placeholders})
        ORDER BY month
    """, [npi] + top_codes).fetchall()

    # Pivot into {month, code1, code2, ...} format
    months: dict = {}
    for r in rows:
        m = r[0]
        if m not in months:
            months[m] = {"month": m}
        months[m][r[1]] = r[2]

    procedures = [
        {"code": c, "description": desc_map.get(c, c)}
        for c in top_codes
    ]
    return {
        "procedures": procedures,
        "series": list(months.values()),
    }


@router.get("/{npi}/procedures")
def provider_procedures(npi: str, limit: int = 20, offset: int = 0, sort_by: str = "total_paid"):
    """Top procedures for one provider by spending."""
    allowed_sort = {"total_paid", "total_claims", "per_claim"}
    if sort_by not in allowed_sort:
        sort_by = "total_paid"

    if sort_by == "per_claim":
        order_clause = "(p.total_paid / NULLIF(p.total_claims, 0)) DESC NULLS LAST, p.hcpcs_code"
    else:
        order_clause = f"p.{sort_by} DESC, p.hcpcs_code"

    db = get_db()
    rows = db.execute(f"""
        SELECT
            p.hcpcs_code,
            COALESCE(NULLIF(h.short_description, ''), p.hcpcs_code) AS description,
            p.total_beneficiaries,
            p.total_claims,
            p.total_paid
        FROM agg_provider_procedure p
        LEFT JOIN hcpcs_codes h ON h.hcpcs_code = p.hcpcs_code
        WHERE p.npi = ?
        ORDER BY {order_clause}
        LIMIT ?
        OFFSET ?
    """, [npi, limit, offset]).fetchall()
    return [
        {
            "hcpcs_code": r[0],
            "description": r[1],
            "total_beneficiaries": r[2],
            "total_claims": r[3],
            "total_paid": r[4],
        }
        for r in rows
    ]
