import { useState, useMemo } from "react";
import { useApi } from "../../hooks/useApi";
import { api } from "../../api/client";
import { useDashboard } from "../../store/dashboard";
import { fmtDollars, fmtNumber } from "../../utils";
import type { ProviderSummary } from "../../types/api";

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
  const { data, loading } = useApi(
    () => api.topProviders(selectedState ?? undefined, 50),
    [selectedState]
  );

  const sorted = useMemo(() => {
    if (!data) return null;
    const dir = sortDir === "desc" ? 1 : -1;
    return [...data].sort((a, b) => dir * (getValue(b, sortKey) - getValue(a, sortKey)));
  }, [data, sortKey, sortDir]);

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
      )}
    </div>
  );
}
