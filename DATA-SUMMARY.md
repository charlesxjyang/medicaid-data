# HHS Medicaid Provider-Procedure Spending Data

## Source
Open-sourced by HHS (Department of Health and Human Services), February 2025.
File: `medicaid-provider-spending.csv` (~11 GB)

## Schema
Each row represents a unique combination of billing provider + servicing provider + procedure code + month.

| # | Column | Type | Description |
|---|--------|------|-------------|
| 1 | `BILLING_PROVIDER_NPI_NUM` | ID | NPI of the billing provider |
| 2 | `SERVICING_PROVIDER_NPI_NUM` | ID | NPI of the servicing provider (sometimes blank) |
| 3 | `HCPCS_CODE` | Code | Healthcare Common Procedure Coding System code |
| 4 | `CLAIM_FROM_MONTH` | Date | Year-month of the claim (YYYY-MM format) |
| 5 | `TOTAL_UNIQUE_BENEFICIARIES` | Integer | Count of unique Medicaid beneficiaries |
| 6 | `TOTAL_CLAIMS` | Integer | Count of claims submitted |
| 7 | `TOTAL_PAID` | Decimal | Dollar amount paid |

## Key Statistics
- **Total rows**: 227,083,361 (+ 1 header)
- **Time range**: January 2018 — December 2024 (84 months, 7 full years)
- **Unique billing providers (NPIs)**: 617,503
- **Unique HCPCS procedure codes**: 10,881
- **Total paid**: ~$1.094 trillion
- **Total claims**: ~18.83 billion
- **Total beneficiary-months**: ~11.32 billion

## Data Quality Notes
- **Blank servicing NPI**: ~9,490,345 rows (~4.2%) have no servicing provider NPI. In these cases the billing provider likely is the servicing provider, or it was not reported.
- **Negative payments**: ~9,239 rows have negative `TOTAL_PAID` values, likely representing recoupments, refunds, or payment adjustments.
- **Grain**: The dataset is at the billing_NPI + servicing_NPI + HCPCS + month level. To get provider-level totals, aggregate across HCPCS codes. To get procedure-level totals, aggregate across NPIs.

## Performance Notes for Analysis
- At ~11 GB / 227M rows, this file is too large for naive `pandas.read_csv()` on most machines.
- Recommended tools: **DuckDB** (can query CSV directly), **Polars** (fast DataFrame library), or **awk** for single-pass aggregations.
- Single-pass `awk` takes ~3-5 minutes per scan on this file.
- Avoid piping to `sort -u` on extracted columns — it's very slow. Prefer hash-based counting in awk.
