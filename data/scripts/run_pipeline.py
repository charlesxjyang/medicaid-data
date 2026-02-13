#!/usr/bin/env python3
"""Run the full data pipeline in order."""
import subprocess
import sys
import time
import os

SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = [
    ("01_build_aggregates.py", "Building aggregate tables (this takes a while)..."),
    ("02_geocode.py", "Geocoding providers..."),
    ("03_hcpcs.py", "Setting up HCPCS codes..."),
    ("04_export_arrow.py", "Exporting Arrow file for map..."),
]


def main():
    total_start = time.time()

    for script, msg in SCRIPTS:
        print(f"\n{'='*60}")
        print(f"  {msg}")
        print(f"{'='*60}")
        path = os.path.join(SCRIPTS_DIR, script)
        result = subprocess.run([sys.executable, path], cwd=os.path.dirname(SCRIPTS_DIR))
        if result.returncode != 0:
            print(f"\n✗ {script} failed with exit code {result.returncode}")
            sys.exit(1)

    total_elapsed = time.time() - total_start
    print(f"\n{'='*60}")
    print(f"  Pipeline complete in {total_elapsed/60:.1f} minutes!")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
