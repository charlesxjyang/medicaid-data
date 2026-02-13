#!/usr/bin/env python3
"""Download ZIP code centroids and geocode providers.

Uses Census Bureau ZCTA gazetteer file for ZIP→lat/lng mapping.
"""
import duckdb
import urllib.request
import zipfile
import os
import time

DB_PATH = "/Users/charl/Programming/medicaid/medicaid.duckdb"
DATA_DIR = "/Users/charl/Programming/medicaid/data"
GAZETTEER_URL = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_zcta_national.zip"
GAZETTEER_ZIP = os.path.join(DATA_DIR, "gazetteer.zip")
GAZETTEER_TXT = os.path.join(DATA_DIR, "2023_Gaz_zcta_national.txt")


def download_gazetteer():
    if os.path.exists(GAZETTEER_TXT):
        print(f"Gazetteer already exists at {GAZETTEER_TXT}")
        return

    print(f"Downloading Census ZCTA gazetteer...")
    urllib.request.urlretrieve(GAZETTEER_URL, GAZETTEER_ZIP)
    print(f"  ✓ Downloaded to {GAZETTEER_ZIP}")

    with zipfile.ZipFile(GAZETTEER_ZIP, 'r') as z:
        z.extractall(DATA_DIR)
    print(f"  ✓ Extracted")

    # Find the extracted file (name may vary slightly)
    for f in os.listdir(DATA_DIR):
        if f.endswith("_Gaz_zcta_national.txt"):
            actual_path = os.path.join(DATA_DIR, f)
            if actual_path != GAZETTEER_TXT:
                os.rename(actual_path, GAZETTEER_TXT)
            break


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    download_gazetteer()

    con = duckdb.connect(DB_PATH)

    # Load ZIP centroids
    print("\nLoading ZIP centroids into DuckDB...")
    con.execute("DROP TABLE IF EXISTS zip_centroids")
    con.execute(f"""
        CREATE TABLE zip_centroids AS
        SELECT
            LPAD(CAST(GEOID AS VARCHAR), 5, '0') AS zip,
            INTPTLAT AS latitude,
            INTPTLONG AS longitude
        FROM read_csv('{GAZETTEER_TXT}',
            delim='\t',
            header=true,
            auto_detect=true
        )
    """)
    count = con.execute("SELECT COUNT(*) FROM zip_centroids").fetchone()[0]
    print(f"  ✓ zip_centroids: {count:,} rows")

    # Build map_providers — pre-joined provider locations + spending stats
    print("\nBuilding map_providers table...")
    t0 = time.time()
    con.execute("DROP TABLE IF EXISTS map_providers")
    con.execute("""
        CREATE TABLE map_providers AS
        SELECT
            a.npi,
            COALESCE(n.org_name, CONCAT(n.last_name, ', ', n.first_name)) AS name,
            n.practice_state AS state,
            n.practice_city AS city,
            SUBSTR(COALESCE(n.practice_zip, n.mailing_zip), 1, 5) AS zip,
            COALESCE(g.latitude, g2.latitude) AS lat,
            COALESCE(g.longitude, g2.longitude) AS lng,
            a.total_paid,
            a.total_claims,
            a.total_beneficiaries,
            a.unique_procedures,
            a.first_month,
            a.last_month
        FROM agg_provider_summary a
        JOIN nppes n ON CAST(n.npi AS VARCHAR) = a.npi
        LEFT JOIN zip_centroids g ON SUBSTR(n.practice_zip, 1, 5) = g.zip
        LEFT JOIN zip_centroids g2 ON SUBSTR(n.mailing_zip, 1, 5) = g2.zip
    """)
    count = con.execute("SELECT COUNT(*) FROM map_providers").fetchone()[0]
    geocoded = con.execute("SELECT COUNT(*) FROM map_providers WHERE lat IS NOT NULL").fetchone()[0]
    elapsed = time.time() - t0
    print(f"  ✓ map_providers: {count:,} rows ({geocoded:,} geocoded, {geocoded*100//count}%) in {elapsed:.1f}s")

    con.execute("CREATE INDEX IF NOT EXISTS idx_map_prov_npi ON map_providers(npi)")
    con.execute("CREATE INDEX IF NOT EXISTS idx_map_prov_state ON map_providers(state)")

    con.close()
    print("\nGeocoding complete!")


if __name__ == "__main__":
    main()
