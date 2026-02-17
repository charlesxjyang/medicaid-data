import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { api } from "../../api/client";
import { useDashboard } from "../../store/dashboard";
import { fmtDollars, fmtNumber } from "../../utils";
import type { ProviderSummary } from "../../types/api";

const PAGE_SIZE = 25;

type SortKey = "total_paid" | "total_claims" | "per_claim";
type SortDir = "asc" | "desc";

function getValue(p: ProviderSummary, key: SortKey): number {
  if (key === "per_claim") return p.total_claims ? p.total_paid / p.total_claims : 0;
  return p[key] ?? 0;
}

export function TopProviders() {
  const { selectedState, setSelectedNpi } = useDashboard();
  const [sortKey, setSortKey] = useState<SortKey>("total_paid");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [items, setItems] = useState<ProviderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setItems([]);
    offsetRef.current = 0;
    api.topProviders(selectedState ?? undefined, PAGE_SIZE, 0).then((rows) => {
      if (cancelled) return;
      setItems(rows);
      offsetRef.current = rows.length;
      setHasMore(rows.length >= PAGE_SIZE);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedState]);

  const loadMore = useCallback(() => {
    const offset = offsetRef.current;
    if (offset === 0) return;
    setLoadingMore(true);
    api.topProviders(selectedState ?? undefined, PAGE_SIZE, offset).then((rows) => {
      setItems((prev) => {
        const existing = new Set(prev.map((p) => p.npi));
        const fresh = rows.filter((r) => !existing.has(r.npi));
        return [...prev, ...fresh];
      });
      offsetRef.current = offset + rows.length;
      setHasMore(rows.length >= PAGE_SIZE);
    }).finally(() => setLoadingMore(false));
  }, [selectedState]);

  const sorted = useMemo(() => {
    if (!items.length) return null;
    const dir = sortDir === "desc" ? 1 : -1;
    return [...items].sort((a, b) => dir * (getValue(b, sortKey) - getValue(a, sortKey)));
  }, [items, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const arrow = (key: SortKey) => sortKey === key ? (sortDir === "desc" ? " ▼" : " ▲") : "";

  return (
    <div className="table-panel">
      <h4>Top Providers {selectedState ? `in ${selectedState}` : "(National)"}</h4>
      {loading || !sorted ? (
        <div className="table-skeleton" />
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Location</th>
                <th className="num sortable" onClick={() => toggleSort("total_claims")}>
                  # Claims{arrow("total_claims")}
                </th>
                <th className="num sortable" onClick={() => toggleSort("total_paid")}>
                  Paid{arrow("total_paid")}
                </th>
                <th className="num sortable" onClick={() => toggleSort("per_claim")}>
                  $/Claim{arrow("per_claim")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr
                  key={p.npi}
                  className="clickable-row"
                  onClick={() => setSelectedNpi(p.npi)}
                >
                  <td>
                    <span className="provider-name">{p.name}</span>
                    {p.is_excluded && (
                      <span className="excluded-tag">OIG EXCLUDED</span>
                    )}
                  </td>
                  <td>
                    {p.city}, {p.state}
                  </td>
                  <td className="num">{fmtNumber(p.total_claims)}</td>
                  <td className="num">{fmtDollars(p.total_paid)}</td>
                  <td className="num">{p.total_claims ? fmtDollars(p.total_paid / p.total_claims) : "—"}</td>
                </tr>
              ))}
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
        </>
      )}
    </div>
  );
}
