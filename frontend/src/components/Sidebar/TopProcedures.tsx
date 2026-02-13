import { useApi } from "../../hooks/useApi";
import { api } from "../../api/client";
import { useDashboard } from "../../store/dashboard";
import { fmtDollars, fmtNumber } from "../../utils";

export function TopProcedures() {
  const { setSelectedProcedure } = useDashboard();
  const { data, loading } = useApi(() => api.topProcedures(), []);

  return (
    <div className="table-panel">
      <h4>Top Procedures (National)</h4>
      {loading || !data ? (
        <div className="table-skeleton" />
      ) : (
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Description</th>
              <th className="num">Providers</th>
              <th className="num">Paid</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
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
      )}
    </div>
  );
}
