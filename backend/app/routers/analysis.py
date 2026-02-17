"""Fraud risk analysis endpoints."""
from fastapi import APIRouter
from ..db import get_db

router = APIRouter()


@router.get("/excluded-providers")
def excluded_providers(limit: int = 50, offset: int = 0):
    """Excluded providers still receiving Medicaid payments, sorted by total_paid."""
    db = get_db()
    try:
        db.execute("SELECT 1 FROM oig_exclusions LIMIT 0")
    except Exception:
        return {"providers": [], "total": 0, "note": "OIG exclusion list not loaded. Run 05_load_oig.py first."}

    total = db.execute("""
        SELECT COUNT(*)
        FROM oig_exclusions o
        JOIN map_providers m ON m.npi = o.npi
    """).fetchone()[0]

    rows = db.execute("""
        SELECT
            o.npi,
            COALESCE(m.name, o.lastname || ', ' || o.firstname) AS name,
            COALESCE(m.state, o.state) AS state,
            m.city,
            m.total_paid,
            m.total_claims,
            o.excltype,
            o.excldate,
            o.reindate,
            o.busname,
            o.specialty
        FROM oig_exclusions o
        JOIN map_providers m ON m.npi = o.npi
        ORDER BY m.total_paid DESC
        LIMIT ?
        OFFSET ?
    """, [limit, offset]).fetchall()

    return {
        "providers": [
            {
                "npi": r[0],
                "name": r[1],
                "state": r[2],
                "city": r[3],
                "total_paid": r[4],
                "total_claims": r[5],
                "exclusion_type": r[6],
                "exclusion_date": r[7],
                "reinstatement_date": r[8] if r[8] else None,
                "business_name": r[9] if r[9] else None,
                "specialty": r[10] if r[10] else None,
            }
            for r in rows
        ],
        "total": total,
    }


@router.get("/fraud-risk")
def fraud_risk_ranking(limit: int = 10):
    """
    Composite fraud risk ranking based on:
    1. Billing procedures at 10x+ state average $/claim
    2. Significant year-over-year spending growth (3x+)
    3. Unusual procedure combinations (billing rare procedures)
    """
    db = get_db()

    # Signal 1: Providers billing 10x+ their state average per claim
    signal1 = db.execute("""
        WITH state_avgs AS (
            SELECT
                m.state,
                p.hcpcs_code,
                SUM(p.total_paid) / NULLIF(SUM(p.total_claims), 0) AS state_avg
            FROM agg_provider_procedure p
            JOIN map_providers m ON m.npi = p.npi
            WHERE p.total_claims >= 10
            GROUP BY m.state, p.hcpcs_code
            HAVING COUNT(DISTINCT p.npi) >= 5
        ),
        ratios AS (
            SELECT
                p.npi,
                p.hcpcs_code,
                (p.total_paid / NULLIF(p.total_claims, 0)) / NULLIF(sa.state_avg, 0) AS ratio,
                p.total_paid
            FROM agg_provider_procedure p
            JOIN map_providers m ON m.npi = p.npi
            JOIN state_avgs sa ON sa.state = m.state AND sa.hcpcs_code = p.hcpcs_code
            WHERE p.total_claims >= 10 AND sa.state_avg > 0
        )
        SELECT
            npi,
            COUNT(CASE WHEN ratio >= 10 THEN 1 END) AS procs_10x,
            MAX(ratio) AS max_ratio,
            SUM(CASE WHEN ratio >= 10 THEN total_paid ELSE 0 END) AS outlier_spend
        FROM ratios
        GROUP BY npi
    """).fetchall()
    s1 = {r[0]: {"procs_10x": r[1], "max_ratio": r[2], "outlier_spend": r[3]} for r in signal1}

    # Signal 2: Year-over-year growth
    signal2 = db.execute("""
        WITH yearly AS (
            SELECT
                npi,
                SUBSTRING(month, 1, 4) AS year,
                SUM(total_paid) AS annual_paid
            FROM agg_provider_monthly
            GROUP BY npi, SUBSTRING(month, 1, 4)
        ),
        yoy AS (
            SELECT
                y2.npi,
                y2.annual_paid / NULLIF(y1.annual_paid, 0) AS growth
            FROM yearly y2
            JOIN yearly y1 ON y1.npi = y2.npi
                AND CAST(y1.year AS INT) = CAST(y2.year AS INT) - 1
            WHERE y1.annual_paid > 10000
              AND y2.annual_paid > 50000
        )
        SELECT
            npi,
            MAX(growth) AS max_yoy,
            COUNT(CASE WHEN growth >= 3 THEN 1 END) AS years_3x
        FROM yoy
        GROUP BY npi
    """).fetchall()
    s2 = {r[0]: {"max_yoy": r[1], "years_3x": r[2]} for r in signal2}

    # Signal 3: Unusual procedure mix (billing for rare procedures in their state)
    signal3 = db.execute("""
        WITH state_totals AS (
            SELECT state, COUNT(DISTINCT npi) AS total_provs
            FROM map_providers
            GROUP BY state
        ),
        proc_prevalence AS (
            SELECT
                m.state,
                p.hcpcs_code,
                COUNT(DISTINCT p.npi) AS n_provs
            FROM agg_provider_procedure p
            JOIN map_providers m ON m.npi = p.npi
            WHERE p.total_claims >= 5
            GROUP BY m.state, p.hcpcs_code
        ),
        provider_rare AS (
            SELECT
                p.npi,
                m.state,
                COUNT(DISTINCT p.hcpcs_code) AS total_procs,
                COUNT(DISTINCT CASE
                    WHEN pp.n_provs * 1.0 / st.total_provs < 0.02 THEN p.hcpcs_code
                END) AS rare_procs
            FROM agg_provider_procedure p
            JOIN map_providers m ON m.npi = p.npi
            JOIN proc_prevalence pp ON pp.state = m.state AND pp.hcpcs_code = p.hcpcs_code
            JOIN state_totals st ON st.state = m.state
            WHERE p.total_claims >= 5
            GROUP BY p.npi, m.state
            HAVING COUNT(DISTINCT p.hcpcs_code) >= 3
        )
        SELECT npi, total_procs, rare_procs
        FROM provider_rare
    """).fetchall()
    s3 = {r[0]: {"total_procs": r[1], "rare_procs": r[2]} for r in signal3}

    # Combine all NPIs
    all_npis = set(s1.keys()) | set(s2.keys()) | set(s3.keys())

    # Composite scoring
    scored = []
    for npi in all_npis:
        d1 = s1.get(npi, {"procs_10x": 0, "max_ratio": 0, "outlier_spend": 0})
        d2 = s2.get(npi, {"max_yoy": 0, "years_3x": 0})
        d3 = s3.get(npi, {"total_procs": 0, "rare_procs": 0})

        # Normalize scores (0-100 each)
        # Signal 1: more procs at 10x = higher risk
        score1 = min(d1["procs_10x"] * 20, 100) if d1["procs_10x"] else 0
        # Signal 2: higher YoY growth = higher risk
        score2 = min((d2["max_yoy"] - 1) * 10, 100) if d2["max_yoy"] and d2["max_yoy"] > 1 else 0
        # Signal 3: more rare procs = higher risk
        rare_pct = d3["rare_procs"] / max(d3["total_procs"], 1) if d3["total_procs"] else 0
        score3 = min(rare_pct * 200, 100)

        # Must have at least 2 signals firing
        signals_active = (score1 > 0) + (score2 > 0) + (score3 > 0)
        if signals_active < 2:
            continue

        composite = score1 * 0.4 + score2 * 0.3 + score3 * 0.3
        if composite < 20:
            continue

        scored.append({
            "npi": npi,
            "composite_score": round(composite, 1),
            "signal_billing_10x": {
                "procs_10x": d1["procs_10x"],
                "max_ratio": round(d1["max_ratio"], 1) if d1["max_ratio"] else 0,
                "outlier_spend": round(d1["outlier_spend"], 2) if d1["outlier_spend"] else 0,
                "score": round(score1, 1),
            },
            "signal_yoy_growth": {
                "max_yoy": round(d2["max_yoy"], 1) if d2["max_yoy"] else 0,
                "years_3x": d2["years_3x"],
                "score": round(score2, 1),
            },
            "signal_unusual_mix": {
                "total_procs": d3["total_procs"],
                "rare_procs": d3["rare_procs"],
                "score": round(score3, 1),
            },
        })

    scored.sort(key=lambda x: x["composite_score"], reverse=True)
    top = scored[:limit]

    # Enrich with provider info
    if top:
        npis = [t["npi"] for t in top]
        placeholders = ",".join(["?"] * len(npis))
        info = db.execute(f"""
            SELECT npi, name, state, city, total_paid, total_claims
            FROM map_providers
            WHERE npi IN ({placeholders})
        """, npis).fetchall()
        info_map = {r[0]: {"name": r[1], "state": r[2], "city": r[3],
                           "total_paid": r[4], "total_claims": r[5]} for r in info}
        for t in top:
            pinfo = info_map.get(t["npi"], {})
            t["name"] = pinfo.get("name", "Unknown")
            t["state"] = pinfo.get("state", "")
            t["city"] = pinfo.get("city", "")
            t["total_paid"] = pinfo.get("total_paid", 0)
            t["total_claims"] = pinfo.get("total_claims", 0)

    return {"providers": top, "total_flagged": len(scored)}
