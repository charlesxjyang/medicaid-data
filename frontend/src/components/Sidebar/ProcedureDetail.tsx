import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";
import { api } from "../../api/client";
import { useDashboard } from "../../store/dashboard";
import { fmtDollars, fmtNumber } from "../../utils";
import type { ProcedureProvider } from "../../types/api";

const PRELOAD = 150;
const PAGE_SIZE = 25;

type SortKey = "total_paid" | "total_claims" | "per_claim";

export function ProcedureDetail() {
  const { selectedProcedure, selectedState, setSelectedProcedure, setSelectedNpi } = useDashboard();
  const [sortKey, setSortKey] = useState<SortKey>("total_paid");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { data: detail, loading } = useApi(
    () => (selectedProcedure ? api.procedureDetail(selectedProcedure) : Promise.resolve(null)),
    [selectedProcedure]
  );
  const { data: providers } = useApi(
    () => (selectedProcedure ? api.procedureProviders(selectedProcedure, PRELOAD, 0, sortKey) : Promise.resolve(null)),
    [selectedProcedure, sortKey]
  );

  const { data: benchmarks } = useApi(
    () =>
      selectedProcedure
        ? api.procedureBenchmarks(selectedProcedure, selectedState ?? undefined)
        : Promise.resolve(null),
    [selectedProcedure, selectedState]
  );

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [providers]);

  const benchmark = benchmarks?.[0];
  const showState = !!selectedState;

  const visible = providers?.slice(0, visibleCount);
  const hasMore = providers ? visibleCount < providers.length : false;

  function toggleSort(key: SortKey) {
    setSortKey(key);
  }

  const arrow = (key: SortKey) => sortKey === key ? " ▼" : "";

  if (!selectedProcedure) return null;

  return (
    <div className="provider-detail">
      <div className="detail-header">
        <button className="back-btn" onClick={() => setSelectedProcedure(null)}>
          ← Back
        </button>
        {loading ? (
          <div className="detail-skeleton" />
        ) : detail ? (
          <>
            <h3>{detail.hcpcs_code}</h3>
            <p className="detail-sub">{detail.description || "No description available"}</p>
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
            <span className="stat-value">{fmtNumber(detail.total_beneficiaries)}</span>
            <span className="stat-label">Beneficiaries</span>
          </div>
          <div className="stat">
            <span className="stat-value">{fmtNumber(detail.unique_providers)}</span>
            <span className="stat-label">Providers</span>
          </div>
        </div>
      )}

      {visible && visible.length > 0 && (
        <div className="detail-procedures">
          <h4>Top Providers</h4>
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th className="num sortable" onClick={() => toggleSort("total_claims")}>
                  Claims{arrow("total_claims")}
                </th>
                <th className="num sortable" onClick={() => toggleSort("per_claim")}>
                  $/Claim{arrow("per_claim")}
                </th>
                <th className="num sortable" onClick={() => toggleSort("total_paid")}>
                  Total Paid{arrow("total_paid")}
                </th>
                <th className="num">Natl Avg</th>
                {showState && <th className="num">{selectedState} Avg</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const perClaim = p.total_claims > 0 ? p.total_paid / p.total_claims : null;
                return (
                  <tr
                    key={p.npi}
                    className="clickable-row"
                    onClick={() => setSelectedNpi(p.npi)}
                  >
                    <td>
                      <div className="provider-name">{p.name}</div>
                      <div className="provider-loc">
                        {p.city}{p.state ? `, ${p.state}` : ""}
                      </div>
                    </td>
                    <td className="num">{fmtNumber(p.total_claims)}</td>
                    <td className="num">{perClaim != null ? fmtDollars(perClaim) : "—"}</td>
                    <td className="num">{fmtDollars(p.total_paid)}</td>
                    <td className="num">
                      {benchmark?.national_per_claim != null
                        ? fmtDollars(benchmark.national_per_claim)
                        : "—"}
                    </td>
                    {showState && (
                      <td className="num">
                        {benchmark?.state_per_claim != null
                          ? fmtDollars(benchmark.state_per_claim)
                          : "—"}
                      </td>
                    )}
                  </tr>
                );
              })}
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
