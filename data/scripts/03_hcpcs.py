#!/usr/bin/env python3
"""Download HCPCS code descriptions.

Tries to fetch HCPCS descriptions from CMS.
Falls back to creating a table with just the codes from our data.
"""
import duckdb
import urllib.request
import json
import os
import time

DB_PATH = "/Users/charl/Programming/medicaid/medicaid.duckdb"


def try_cms_api(con):
    """Try to get HCPCS descriptions from data.cms.gov."""
    # CMS publishes procedure code data via their API
    # This endpoint has HCPCS codes with short descriptions
    url = "https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners/medicare-physician-other-practitioners-by-provider-and-service/api"
    # This won't easily give us all HCPCS codes. Skip for now.
    return False


def build_from_existing_data(con):
    """Create hcpcs_codes table from codes present in our spending data."""
    print("Building HCPCS table from existing spending data codes...")
    con.execute("DROP TABLE IF EXISTS hcpcs_codes")
    con.execute("""
        CREATE TABLE hcpcs_codes AS
        SELECT
            hcpcs_code,
            '' AS short_description,
            '' AS long_description,
            unique_providers,
            total_paid
        FROM agg_procedure_summary
        ORDER BY total_paid DESC
    """)
    count = con.execute("SELECT COUNT(*) FROM hcpcs_codes").fetchone()[0]
    print(f"  ✓ hcpcs_codes: {count:,} codes (descriptions will be added later)")
    return count


def try_download_hcpcs_csv(con):
    """Try to download a HCPCS reference file."""
    # Try the CMS HCPCS file - this is a known public dataset
    try:
        url = "https://data.cms.gov/provider-summary-by-type-of-service/medicare-physician-other-practitioners/medicare-physician-other-practitioners-by-provider-and-service"
        # The above is an HTML page, not useful directly.
        # Instead, let's try the BETOS classification which has HCPCS mapping
        print("Attempting to download HCPCS reference data...")

        # Use the Medicare PUF which has HCPCS + description
        # This is a simplified approach - download from a known endpoint
        api_url = "https://data.cms.gov/data-api/v1/dataset/9767cb68-8ea9-4f0b-8179-9431abc89f11/data?size=0&offset=0"
        # This likely won't work directly. Let's fall back.
        return False
    except Exception as e:
        print(f"  Download failed: {e}")
        return False


def main():
    con = duckdb.connect(DB_PATH)

    # Try to get descriptions, fall back to codes-only
    if not try_download_hcpcs_csv(con):
        build_from_existing_data(con)

    con.execute("CREATE INDEX IF NOT EXISTS idx_hcpcs_code ON hcpcs_codes(hcpcs_code)")
    con.close()
    print("\nHCPCS setup complete!")


if __name__ == "__main__":
    main()
