import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";
import { api } from "../../api/client";
import { useDashboard } from "../../store/dashboard";
import { fmtDollars, fmtNumber } from "../../utils";


const PRELOAD = 250;
const PAGE_SIZE = 25;

type SortKey = "total_paid" | "total_claims" | "per_claim";


export function TopProviders() {
  const { selectedState, setSelectedNpi, excludedOnly, setExcludedOnly } = useDashboard();
  const [sortKey, setSortKey] = useState<SortKey>("total_paid");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Re-fetch from backend when sort, state, or excluded filter changes
  const { data: items, loading } = useApi(
    () => api.topProviders(selectedState ?? undefined, PRELOAD, 0, sortKey, excludedOnly),
    [selectedState, sortKey, excludedOnly]
  );

  // Reset visible count when data changes
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [items]);

  // Data comes pre-sorted from backend (DESC). Just slice for pagination.
  const visible = items?.slice(0, visibleCount);
  const hasMore = items ? visibleCount < items.length : false;

  function toggleSort(key: SortKey) {
    setSortKey(key);
  }

  const arrow = (key: SortKey) => sortKey === key ? " ▼" : "";

  return (
    <div className="table-panel">
      <div className="table-panel-header">
        <h4>
          {excludedOnly ? "OIG Excluded Providers" : "Top Providers"}{" "}
          {selectedState ? `in ${selectedState}` : "(National)"}
        </h4>
        <label className="excluded-toggle">
          <input
            type="checkbox"
            checked={excludedOnly}
            onChange={(e) => setExcludedOnly(e.target.checked)}
          />
          OIG Excluded Only
        </label>
      </div>
      {loading || !visible ? (
        <div className="table-skeleton" />
      ) : visible.length === 0 ? (
        <p className="no-results">No excluded providers found{selectedState ? ` in ${selectedState}` : ""}.</p>
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
              {visible.map((p) => (
                <tr
                  key={p.npi}
                  className="clickable-row"
                  onClick={() => setSelectedNpi(p.npi)}
                >
                  <td>
                    <div className="provider-name">{p.name}</div>
                    {p.is_excluded && (
                      <div className="excluded-tag">OIG EXCLUDED</div>
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
