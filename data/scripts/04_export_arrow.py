#!/usr/bin/env python3
"""Export map_providers to Apache Arrow format for frontend.

The Arrow file is loaded directly by deck.gl in the browser,
avoiding sending 1M+ rows as JSON on page load.
"""
import duckdb
import os

DB_PATH = "/Users/charl/Programming/medicaid/medicaid.duckdb"
ARROW_PATH = "/Users/charl/Programming/medicaid/frontend/public/data/providers.arrow"


def main():
    os.makedirs(os.path.dirname(ARROW_PATH), exist_ok=True)

    con = duckdb.connect(DB_PATH, read_only=True)

    print("Exporting map_providers to Arrow format...")

    # Select only columns needed for the map to minimize file size
    result = con.execute("""
        SELECT
            npi,
            name,
            state,
            city,
            lat,
            lng,
            total_paid,
            total_claims,
            total_beneficiaries
        FROM map_providers
        WHERE lat IS NOT NULL AND lng IS NOT NULL
    """)

    arrow_table = result.fetch_arrow_table()
    print(f"  Rows: {arrow_table.num_rows:,}")
    print(f"  Columns: {arrow_table.column_names}")

    import pyarrow as pa
    import pyarrow.ipc as ipc

    with pa.OSFile(ARROW_PATH, 'wb') as f:
        writer = ipc.new_file(f, arrow_table.schema)
        writer.write_table(arrow_table)
        writer.close()

    size_mb = os.path.getsize(ARROW_PATH) / (1024 * 1024)
    print(f"  ✓ Written to {ARROW_PATH} ({size_mb:.1f} MB)")

    con.close()
    print("\nArrow export complete!")


if __name__ == "__main__":
    main()
