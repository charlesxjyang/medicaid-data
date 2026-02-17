import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useApi } from "../../hooks/useApi";
import { api } from "../../api/client";
import { useDashboard } from "../../store/dashboard";
import { fmtDollars, fmtNumber } from "../../utils";
import type { ProcedureProvider } from "../../types/api";

const PAGE_SIZE = 25;

type SortKey = "name" | "claims" | "per_claim" | "paid";
type SortDir = "asc" | "desc";

export function ProcedureDetail() {
  const { selectedProcedure, selectedState, setSelectedProcedure, setSelectedNpi } = useDashboard();
  const [sortKey, setSortKey] = useState<SortKey>("paid");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [providers, setProviders] = useState<ProcedureProvider[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);

  const { data: detail, loading } = useApi(
    () => (selectedProcedure ? api.procedureDetail(selectedProcedure) : Promise.resolve(null)),
    [selectedProcedure]
  );

  useEffect(() => {
    if (!selectedProcedure) return;
    let cancelled = false;
    setProviders([]);
    offsetRef.current = 0;
    api.procedureProviders(selectedProcedure, PAGE_SIZE, 0).then((rows) => {
      if (cancelled) return;
      setProviders(rows);
      offsetRef.current = rows.length;
      setHasMore(rows.length >= PAGE_SIZE);
    });
    return () => { cancelled = true; };
  }, [selectedProcedure]);

  const loadMore = useCallback(() => {
    if (!selectedProcedure) return;
    const offset = offsetRef.current;
    if (offset === 0) return;
    setLoadingMore(true);
    api.procedureProviders(selectedProcedure, PAGE_SIZE, offset).then((rows) => {
      setProviders((prev) => {
        const existing = new Set(prev.map((p) => p.npi));
        const fresh = rows.filter((r) => !existing.has(r.npi));
        return [...prev, ...fresh];
      });
      offsetRef.current = offset + rows.length;
      setHasMore(rows.length >= PAGE_SIZE);
    }).finally(() => setLoadingMore(false));
  }, [selectedProcedure]);

  const { data: benchmarks } = useApi(
    () =>
      selectedProcedure
        ? api.procedureBenchmarks(selectedProcedure, selectedState ?? undefined)
        : Promise.resolve(null),
    [selectedProcedure, selectedState]
  );

  const benchmark = benchmarks?.[0];
  const showState = !!selectedState;

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  const sorted = useMemo(() => {
    if (!providers.length) return [];
    return [...providers].sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sortKey) {
        case "name":
          av = a.name.toLowerCase();
          bv = b.name.toLowerCase();
          return sortDir === "asc" ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
        case "claims":
          av = a.total_claims;
          bv = b.total_claims;
          break;
        case "per_claim":
          av = a.total_claims > 0 ? a.total_paid / a.total_claims : 0;
          bv = b.total_claims > 0 ? b.total_paid / b.total_claims : 0;
          break;
        case "paid":
          av = a.total_paid;
          bv = b.total_paid;
          break;
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [providers, sortKey, sortDir]);

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

      {sorted.length > 0 && (
        <div className="detail-procedures">
          <h4>Top Providers</h4>
          <table>
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort("name")}>
                  Provider{sortIndicator("name")}
                </th>
                <th className="num sortable" onClick={() => handleSort("claims")}>
                  Claims{sortIndicator("claims")}
                </th>
                <th className="num sortable" onClick={() => handleSort("per_claim")}>
                  $/Claim{sortIndicator("per_claim")}
                </th>
                <th className="num sortable" onClick={() => handleSort("paid")}>
                  Total Paid{sortIndicator("paid")}
                </th>
                <th className="num">Natl Avg</th>
                {showState && <th className="num">{selectedState} Avg</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
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
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
