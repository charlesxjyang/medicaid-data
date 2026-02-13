import { useApi } from "../../hooks/useApi";
import { api } from "../../api/client";
import { useDashboard } from "../../store/dashboard";
import { fmtDollars, fmtNumber } from "../../utils";

export function TopProviders() {
  const { selectedState, setSelectedNpi } = useDashboard();
  const { data, loading } = useApi(
    () => api.topProviders(selectedState ?? undefined),
    [selectedState]
  );

  return (
    <div className="table-panel">
      <h4>Top Providers {selectedState ? `in ${selectedState}` : "(National)"}</h4>
      {loading || !data ? (
        <div className="table-skeleton" />
      ) : (
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Location</th>
              <th className="num">Claims</th>
              <th className="num">Paid</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
