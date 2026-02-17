#!/usr/bin/env python3
"""Download OIG LEIE exclusion list and load into DuckDB.

Source: https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv
The LEIE contains ~82K excluded individuals/entities. About 9K have valid NPIs.
We filter to valid NPIs and join against our spending data to find excluded
providers still receiving Medicaid payments.
"""
import duckdb
import os
import urllib.request

DB_PATH = os.environ.get(
    "DUCKDB_PATH",
    os.path.join(os.path.dirname(__file__), "..", "..", "medicaid.duckdb"),
)
CSV_URL = "https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv"
CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "oig_exclusions.csv")


def main():
    CSV_PATH_ABS = os.path.abspath(CSV_PATH)

    # Download
    print(f"Downloading OIG LEIE from {CSV_URL} ...")
    urllib.request.urlretrieve(CSV_URL, CSV_PATH_ABS)
    size_mb = os.path.getsize(CSV_PATH_ABS) / (1024 * 1024)
    print(f"  Downloaded {size_mb:.1f} MB to {CSV_PATH_ABS}")

    # Load into DuckDB
    con = duckdb.connect(DB_PATH)

    con.execute("DROP TABLE IF EXISTS oig_exclusions")
    con.execute(f"""
        CREATE TABLE oig_exclusions AS
        SELECT
            TRIM(NPI) AS npi,
            TRIM(LASTNAME) AS lastname,
            TRIM(FIRSTNAME) AS firstname,
            TRIM(BUSNAME) AS busname,
            TRIM(SPECIALTY) AS specialty,
            TRIM(EXCLTYPE) AS excltype,
            TRIM(EXCLDATE) AS excldate,
            TRIM(REINDATE) AS reindate,
            TRIM(STATE) AS state
        FROM read_csv('{CSV_PATH_ABS}', header=true, all_varchar=true)
        WHERE TRIM(NPI) != '0000000000'
          AND TRIM(NPI) != ''
          AND NPI IS NOT NULL
    """)

    count = con.execute("SELECT COUNT(*) FROM oig_exclusions").fetchone()[0]
    print(f"  Loaded {count:,} excluded providers with valid NPIs")

    # Create view joining to spending data
    con.execute("DROP VIEW IF EXISTS oig_matched")
    con.execute("""
        CREATE VIEW oig_matched AS
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
    """)

    matched = con.execute("SELECT COUNT(*) FROM oig_matched").fetchone()[0]
    total_paid = con.execute("SELECT SUM(total_paid) FROM oig_matched").fetchone()[0]
    print(f"  {matched:,} excluded providers found in spending data")
    print(f"  Total paid to excluded providers: ${total_paid:,.2f}")

    con.close()
    print("\nOIG exclusion list loaded successfully!")


if __name__ == "__main__":
    main()
