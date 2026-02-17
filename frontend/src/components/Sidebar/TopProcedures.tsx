import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { api } from "../../api/client";
import { useDashboard } from "../../store/dashboard";
import { fmtDollars, fmtNumber } from "../../utils";
import type { ProcedureSummary } from "../../types/api";

const PAGE_SIZE = 25;

type SortKey = "total_paid" | "unique_providers";
type SortDir = "asc" | "desc";

export function TopProcedures() {
  const { selectedState, setSelectedProcedure } = useDashboard();
  const [sortKey, setSortKey] = useState<SortKey>("total_paid");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [items, setItems] = useState<ProcedureSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setItems([]);
    offsetRef.current = 0;
    api.topProcedures(selectedState ?? undefined, PAGE_SIZE, 0).then((rows) => {
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
    api.topProcedures(selectedState ?? undefined, PAGE_SIZE, offset).then((rows) => {
      setItems((prev) => {
        const existing = new Set(prev.map((p) => p.hcpcs_code));
        const fresh = rows.filter((r) => !existing.has(r.hcpcs_code));
        return [...prev, ...fresh];
      });
      offsetRef.current = offset + rows.length;
      setHasMore(rows.length >= PAGE_SIZE);
    }).finally(() => setLoadingMore(false));
  }, [selectedState]);

  const sorted = useMemo(() => {
    if (!items.length) return null;
    const dir = sortDir === "desc" ? 1 : -1;
    return [...items].sort((a, b) => dir * ((b[sortKey] ?? 0) - (a[sortKey] ?? 0)));
  }, [items, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const arrow = (key: SortKey) => sortKey === key ? (sortDir === "desc" ? " ▼" : " ▲") : "";

  return (
    <div className="table-panel">
      <h4>Top Procedures {selectedState ? `in ${selectedState}` : "(National)"}</h4>
      {loading || !sorted ? (
        <div className="table-skeleton" />
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Description</th>
                <th className="num sortable" onClick={() => toggleSort("unique_providers")}>
                  # Providers{arrow("unique_providers")}
                </th>
                <th className="num sortable" onClick={() => toggleSort("total_paid")}>
                  Paid{arrow("total_paid")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr
                  key={p.hcpcs_code}
                  className="clickable-row"
                  onClick={() => setSelectedProcedure(p.hcpcs_code)}
                >
                  <td className="code">{p.hcpcs_code}</td>
                  <td>{p.description || p.hcpcs_code}</td>
                  <td className="num">{fmtNumber(p.unique_providers)}</td>
                  <td className="num">{fmtDollars(p.total_paid)}</td>
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
