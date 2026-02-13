"""Provider search, detail, and drill-down endpoints."""
from typing import Optional
from fastapi import APIRouter, Query
from ..db import get_db

router = APIRouter()


@router.get("/search")
def search_providers(q: str = Query(..., min_length=2), limit: int = 20):
    """Autocomplete search by provider name or NPI."""
    db = get_db()
    rows = db.execute("""
        SELECT npi, name, state, city, total_paid, total_claims
        FROM map_providers
        WHERE
            npi ILIKE ? OR
            name ILIKE ?
        ORDER BY total_paid DESC
        LIMIT ?
    """, [f"%{q}%", f"%{q}%", limit]).fetchall()
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
    sort_by: str = "total_paid",
):
    """Top providers by spending. Optionally filter by state."""
    allowed_sort = {"total_paid", "total_claims", "total_beneficiaries"}
    if sort_by not in allowed_sort:
        sort_by = "total_paid"

    db = get_db()
    if state:
        rows = db.execute(f"""
            SELECT npi, name, state, city, total_paid, total_claims, total_beneficiaries
            FROM map_providers
            WHERE state = ?
            ORDER BY {sort_by} DESC
            LIMIT ?
        """, [state, limit]).fetchall()
    else:
        rows = db.execute(f"""
            SELECT npi, name, state, city, total_paid, total_claims, total_beneficiaries
            FROM map_providers
            ORDER BY {sort_by} DESC
            LIMIT ?
        """, [limit]).fetchall()
    return [
        {
            "npi": r[0],
            "name": r[1],
            "state": r[2],
            "city": r[3],
            "total_paid": r[4],
            "total_claims": r[5],
            "total_beneficiaries": r[6],
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


@router.get("/{npi}/procedures")
def provider_procedures(npi: str, limit: int = 20):
    """Top procedures for one provider by spending."""
    db = get_db()
    rows = db.execute("""
        SELECT
            p.hcpcs_code,
            COALESCE(NULLIF(h.short_description, ''), p.hcpcs_code) AS description,
            p.total_beneficiaries,
            p.total_claims,
            p.total_paid
        FROM agg_provider_procedure p
        LEFT JOIN hcpcs_codes h ON h.hcpcs_code = p.hcpcs_code
        WHERE p.npi = ?
        ORDER BY p.total_paid DESC
        LIMIT ?
    """, [npi, limit]).fetchall()
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
