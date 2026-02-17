import { useState, useEffect, useMemo } from "react";
import { useApi } from "../../hooks/useApi";
import { api } from "../../api/client";
import { useDashboard } from "../../store/dashboard";
import { fmtDollars, fmtNumber, fmtMonth, fmtExclType, fmtExclDate } from "../../utils";
import type { ProcedureBenchmark } from "../../types/api";

const PRELOAD = 150;
const PAGE_SIZE = 20;

type SortKey = "total_claims" | "total_paid" | "per_claim";

export function ProviderDetail() {
  const { selectedNpi, setSelectedNpi, setSelectedProcedure } = useDashboard();
  const [sortKey, setSortKey] = useState<SortKey>("total_paid");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { data: detail, loading } = useApi(
    () => (selectedNpi ? api.providerDetail(selectedNpi) : Promise.resolve(null)),
    [selectedNpi]
  );
  const { data: procedures } = useApi(
    () => (selectedNpi ? api.providerProcedures(selectedNpi, PRELOAD, 0, sortKey) : Promise.resolve(null)),
    [selectedNpi, sortKey]
  );

  const { data: benchmarks } = useApi(
    () => {
      if (!procedures?.length) return Promise.resolve(null);
      const codes = procedures.map((p) => p.hcpcs_code).join(",");
      const state = detail?.state ?? undefined;
      return api.procedureBenchmarks(codes, state);
    },
    [procedures?.length, detail?.state]
  );

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [procedures]);

  const benchmarkMap = useMemo(() => {
    if (!benchmarks) return {} as Record<string, ProcedureBenchmark>;
    const m: Record<string, ProcedureBenchmark> = {};
    for (const b of benchmarks) m[b.hcpcs_code] = b;
    return m;
  }, [benchmarks]);

  const visible = procedures?.slice(0, visibleCount);
  const hasMore = procedures ? visibleCount < procedures.length : false;

  function toggleSort(key: SortKey) {
    setSortKey(key);
  }

  const arrow = (key: SortKey) => sortKey === key ? " ▼" : "";

  if (!selectedNpi) return null;

  return (
    <div className="provider-detail">
      <div className="detail-header">
        <button className="back-btn" onClick={() => setSelectedNpi(null)}>
          ← Back
        </button>
        {loading ? (
          <div className="detail-skeleton" />
        ) : detail ? (
          <>
            <h3>{detail.name}</h3>
            <p className="detail-sub">
              NPI: {detail.npi} · {detail.city}, {detail.state} {detail.zip}
            </p>
            {detail.nppes?.taxonomy && (
              <p className="detail-taxonomy">{detail.nppes.taxonomy}</p>
            )}
            {detail.nppes?.credentials && (
              <p className="detail-creds">{detail.nppes.credentials}</p>
            )}
            {detail.is_excluded && detail.exclusion && (
              <div className="exclusion-banner">
                OIG Excluded — {fmtExclType(detail.exclusion.exclusion_type)} since {fmtExclDate(detail.exclusion.exclusion_date)}
                {detail.exclusion.reinstatement_date && (
                  <span> (reinstated {fmtExclDate(detail.exclusion.reinstatement_date)})</span>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>

      {detail && (
        <div className="detail-stats">
          <div className="stat">
            <span className="stat-value">{fmtDollars(detail.total_paid)}</span>
            <span className="stat-label">Total Paid</span>
          </div>
          <div className="stat">
            <span className="stat-value">{fmtNumber(detail.total_claims)}</span>
            <span className="stat-label">Claims</span>
          </div>
          <div className="stat">
            <span className="stat-value">{fmtNumber(detail.unique_procedures)}</span>
            <span className="stat-label">Procedures</span>
          </div>
          <div className="stat">
            <span className="stat-value">
              {fmtMonth(detail.first_month)} – {fmtMonth(detail.last_month)}
            </span>
            <span className="stat-label">Active Period</span>
          </div>
        </div>
      )}

      {visible && visible.length > 0 && (
        <div className="detail-procedures">
          <h4>Top Procedures</h4>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Description</th>
                <th className="num sortable" onClick={() => toggleSort("total_claims")}>
                  # Claims{arrow("total_claims")}
                </th>
                <th className="num sortable" onClick={() => toggleSort("total_paid")}>
                  Paid{arrow("total_paid")}
                </th>
                <th className="num sortable" onClick={() => toggleSort("per_claim")}>
                  $/Claim{arrow("per_claim")}
                </th>
                <th className="num">Natl Avg</th>
                <th className="num">State Avg</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr
                  key={p.hcpcs_code}
                  className="clickable-row"
                  onClick={() => setSelectedProcedure(p.hcpcs_code)}
                >
                  <td className="code">{p.hcpcs_code}</td>
                  <td>{p.description}</td>
                  <td className="num">{fmtNumber(p.total_claims)}</td>
                  <td className="num">{fmtDollars(p.total_paid)}</td>
                  <td className="num">{p.total_claims ? fmtDollars(p.total_paid / p.total_claims) : "—"}</td>
                  <td className="num">{benchmarkMap[p.hcpcs_code]?.national_per_claim != null ? fmtDollars(benchmarkMap[p.hcpcs_code].national_per_claim!) : "—"}</td>
                  <td className="num">{benchmarkMap[p.hcpcs_code]?.state_per_claim != null ? fmtDollars(benchmarkMap[p.hcpcs_code].state_per_claim!) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasMore && (
            <button
              className="load-more-btn"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            >
              Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
