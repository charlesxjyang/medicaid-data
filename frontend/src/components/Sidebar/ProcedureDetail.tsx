import { useApi } from "../../hooks/useApi";
import { api } from "../../api/client";
import { useDashboard } from "../../store/dashboard";
import { fmtDollars, fmtNumber } from "../../utils";

export function ProcedureDetail() {
  const { selectedProcedure, selectedState, setSelectedProcedure, setSelectedNpi } = useDashboard();
  const { data: detail, loading } = useApi(
    () => (selectedProcedure ? api.procedureDetail(selectedProcedure) : Promise.resolve(null)),
    [selectedProcedure]
  );
  const { data: providers } = useApi(
    () => (selectedProcedure ? api.procedureProviders(selectedProcedure) : Promise.resolve(null)),
    [selectedProcedure]
  );
  const { data: benchmarks } = useApi(
    () =>
      selectedProcedure
        ? api.procedureBenchmarks(selectedProcedure, selectedState ?? undefined)
        : Promise.resolve(null),
    [selectedProcedure, selectedState]
  );

  const benchmark = benchmarks?.[0];

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

      {providers && providers.length > 0 && (
        <div className="detail-procedures">
          <h4>Top Providers</h4>
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th className="num">Claims</th>
                <th className="num">$/Claim</th>
                <th className="num">Natl Avg</th>
                {benchmark?.state_per_claim != null && <th className="num">State Avg</th>}
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => {
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
                    <td className="num">
                      {benchmark?.national_per_claim != null
                        ? fmtDollars(benchmark.national_per_claim)
                        : "—"}
                    </td>
                    {benchmark?.state_per_claim != null && (
                      <td className="num">{fmtDollars(benchmark.state_per_claim)}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
