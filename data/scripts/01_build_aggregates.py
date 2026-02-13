#!/usr/bin/env python3
"""Build aggregate tables from raw spending data.

This is the heavy step — scans 227M rows multiple times.
Takes ~10-30 minutes depending on hardware.
"""
import duckdb
import time
import sys

DB_PATH = "/Users/charl/Programming/medicaid/medicaid.duckdb"


def run(con, name, sql):
    print(f"\n{'='*60}")
    print(f"Building {name}...")
    t0 = time.time()
    con.execute(f"DROP TABLE IF EXISTS {name}")
    con.execute(sql)
    count = con.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
    elapsed = time.time() - t0
    print(f"  ✓ {name}: {count:,} rows in {elapsed:.1f}s")
    return count


def main():
    con = duckdb.connect(DB_PATH)
    print(f"Connected to {DB_PATH}")
    print(f"Spending rows: {con.execute('SELECT COUNT(*) FROM spending').fetchone()[0]:,}")

    # 1. National monthly — tiny, fast
    run(con, "agg_national_monthly", """
        CREATE TABLE agg_national_monthly AS
        SELECT
            CLAIM_FROM_MONTH AS month,
            COUNT(DISTINCT BILLING_PROVIDER_NPI_NUM) AS unique_providers,
            SUM(TOTAL_UNIQUE_BENEFICIARIES) AS total_beneficiaries,
            SUM(TOTAL_CLAIMS) AS total_claims,
            SUM(TOTAL_PAID) AS total_paid
        FROM spending
        GROUP BY CLAIM_FROM_MONTH
        ORDER BY month
    """)

    # 2. Provider summary — one row per billing NPI
    run(con, "agg_provider_summary", """
        CREATE TABLE agg_provider_summary AS
        SELECT
            BILLING_PROVIDER_NPI_NUM AS npi,
            MIN(CLAIM_FROM_MONTH) AS first_month,
            MAX(CLAIM_FROM_MONTH) AS last_month,
            COUNT(DISTINCT HCPCS_CODE) AS unique_procedures,
            SUM(TOTAL_UNIQUE_BENEFICIARIES) AS total_beneficiaries,
            SUM(TOTAL_CLAIMS) AS total_claims,
            SUM(TOTAL_PAID) AS total_paid
        FROM spending
        GROUP BY BILLING_PROVIDER_NPI_NUM
    """)

    # 3. Provider monthly — for time series on provider click
    run(con, "agg_provider_monthly", """
        CREATE TABLE agg_provider_monthly AS
        SELECT
            BILLING_PROVIDER_NPI_NUM AS npi,
            CLAIM_FROM_MONTH AS month,
            SUM(TOTAL_UNIQUE_BENEFICIARIES) AS total_beneficiaries,
            SUM(TOTAL_CLAIMS) AS total_claims,
            SUM(TOTAL_PAID) AS total_paid
        FROM spending
        GROUP BY BILLING_PROVIDER_NPI_NUM, CLAIM_FROM_MONTH
    """)

    # 4. Provider procedure — for procedure breakdown on provider click
    run(con, "agg_provider_procedure", """
        CREATE TABLE agg_provider_procedure AS
        SELECT
            BILLING_PROVIDER_NPI_NUM AS npi,
            HCPCS_CODE AS hcpcs_code,
            SUM(TOTAL_UNIQUE_BENEFICIARIES) AS total_beneficiaries,
            SUM(TOTAL_CLAIMS) AS total_claims,
            SUM(TOTAL_PAID) AS total_paid
        FROM spending
        GROUP BY BILLING_PROVIDER_NPI_NUM, HCPCS_CODE
    """)

    # 5. State monthly — for choropleth
    run(con, "agg_state_monthly", """
        CREATE TABLE agg_state_monthly AS
        SELECT
            n.practice_state AS state,
            s.CLAIM_FROM_MONTH AS month,
            COUNT(DISTINCT s.BILLING_PROVIDER_NPI_NUM) AS unique_providers,
            SUM(s.TOTAL_UNIQUE_BENEFICIARIES) AS total_beneficiaries,
            SUM(s.TOTAL_CLAIMS) AS total_claims,
            SUM(s.TOTAL_PAID) AS total_paid
        FROM spending s
        JOIN nppes n ON CAST(n.npi AS VARCHAR) = s.BILLING_PROVIDER_NPI_NUM
        GROUP BY n.practice_state, s.CLAIM_FROM_MONTH
    """)

    # 6. Procedure summary — one row per HCPCS code
    run(con, "agg_procedure_summary", """
        CREATE TABLE agg_procedure_summary AS
        SELECT
            HCPCS_CODE AS hcpcs_code,
            COUNT(DISTINCT BILLING_PROVIDER_NPI_NUM) AS unique_providers,
            SUM(TOTAL_UNIQUE_BENEFICIARIES) AS total_beneficiaries,
            SUM(TOTAL_CLAIMS) AS total_claims,
            SUM(TOTAL_PAID) AS total_paid
        FROM spending
        GROUP BY HCPCS_CODE
    """)

    # 7. Procedure monthly — for procedure time series
    run(con, "agg_procedure_monthly", """
        CREATE TABLE agg_procedure_monthly AS
        SELECT
            HCPCS_CODE AS hcpcs_code,
            CLAIM_FROM_MONTH AS month,
            SUM(TOTAL_UNIQUE_BENEFICIARIES) AS total_beneficiaries,
            SUM(TOTAL_CLAIMS) AS total_claims,
            SUM(TOTAL_PAID) AS total_paid
        FROM spending
        GROUP BY HCPCS_CODE, CLAIM_FROM_MONTH
    """)

    # Create indexes for common lookups
    print("\nCreating indexes...")
    con.execute("CREATE INDEX IF NOT EXISTS idx_prov_summary_npi ON agg_provider_summary(npi)")
    con.execute("CREATE INDEX IF NOT EXISTS idx_prov_monthly_npi ON agg_provider_monthly(npi)")
    con.execute("CREATE INDEX IF NOT EXISTS idx_prov_proc_npi ON agg_provider_procedure(npi)")
    con.execute("CREATE INDEX IF NOT EXISTS idx_proc_summary_code ON agg_procedure_summary(hcpcs_code)")
    con.execute("CREATE INDEX IF NOT EXISTS idx_proc_monthly_code ON agg_procedure_monthly(hcpcs_code)")
    con.execute("CREATE INDEX IF NOT EXISTS idx_state_monthly_state ON agg_state_monthly(state)")
    print("  ✓ Indexes created")

    con.close()
    print(f"\n{'='*60}")
    print("All aggregate tables built successfully!")


if __name__ == "__main__":
    main()
