import { useState, useMemo } from "react";
import { useApi } from "../../hooks/useApi";
import { api } from "../../api/client";
import { useDashboard } from "../../store/dashboard";
import { fmtDollars, fmtNumber } from "../../utils";
import type { ProcedureSummary } from "../../types/api";

const PRELOAD = 100;
const PAGE_SIZE = 25;

type SortKey = "total_paid" | "unique_providers";
type SortDir = "asc" | "desc";

export function TopProcedures() {
  const { selectedState, setSelectedProcedure } = useDashboard();
  const [sortKey, setSortKey] = useState<SortKey>("total_paid");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { data: items, loading } = useApi(
    () => api.topProcedures(selectedState ?? undefined, PRELOAD, 0),
    [selectedState]
  );

  const sorted = useMemo(() => {
    if (!items?.length) return null;
    const dir = sortDir === "desc" ? 1 : -1;
    return [...items].sort((a, b) => dir * ((b[sortKey] ?? 0) - (a[sortKey] ?? 0)));
  }, [items, sortKey, sortDir]);

  const visible = sorted?.slice(0, visibleCount);
  const hasMore = sorted ? visibleCount < sorted.length : false;

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const arrow = (key: SortKey) => sortKey === key ? (sortDir === "desc" ? " ▼" : " ▲") : "";

  return (
    <div className="table-panel">
      <h4>Top Procedures {selectedState ? `in ${selectedState}` : "(National)"}</h4>
      {loading || !visible ? (
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
              {visible.map((p) => (
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
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            >
              Load more
            </button>
          )}
        </>
      )}
    </div>
  );
}
