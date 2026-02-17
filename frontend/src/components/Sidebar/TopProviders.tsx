import { useState, useEffect } from "react";
import { useApi } from "../../hooks/useApi";
import { api } from "../../api/client";
import { useDashboard } from "../../store/dashboard";
import { fmtDollars, fmtNumber } from "../../utils";
import type { ProviderSummary } from "../../types/api";

const PRELOAD = 250;
const PAGE_SIZE = 25;

type SortKey = "total_paid" | "total_claims" | "per_claim";

function getValue(p: ProviderSummary, key: SortKey): number {
  if (key === "per_claim") return p.total_claims ? p.total_paid / p.total_claims : 0;
  return p[key] ?? 0;
}

export function TopProviders() {
  const { selectedState, setSelectedNpi } = useDashboard();
  const [sortKey, setSortKey] = useState<SortKey>("total_paid");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Re-fetch from backend when sort or state changes
  const { data: items, loading } = useApi(
    () => api.topProviders(selectedState ?? undefined, PRELOAD, 0, sortKey),
    [selectedState, sortKey]
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
      <h4>Top Providers {selectedState ? `in ${selectedState}` : "(National)"}</h4>
      {loading || !visible ? (
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
              {visible.map((p) => (
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
