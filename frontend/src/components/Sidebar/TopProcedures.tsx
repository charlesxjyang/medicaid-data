import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";
import { api } from "../../api/client";
import { useDashboard } from "../../store/dashboard";
import { fmtDollars, fmtNumber } from "../../utils";


const PRELOAD = 250;
const PAGE_SIZE = 25;

type SortKey = "total_paid" | "unique_providers";

export function TopProcedures() {
  const { selectedState, setSelectedProcedure } = useDashboard();
  const [sortKey, setSortKey] = useState<SortKey>("total_paid");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { data: items, loading } = useApi(
    () => api.topProcedures(selectedState ?? undefined, PRELOAD, 0, sortKey),
    [selectedState, sortKey]
  );

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [items]);

  const visible = items?.slice(0, visibleCount);
  const hasMore = items ? visibleCount < items.length : false;

  function toggleSort(key: SortKey) {
    setSortKey(key);
  }

  const arrow = (key: SortKey) => sortKey === key ? " ▼" : "";

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
