import { useApi } from "../../hooks/useApi";
import { api } from "../../api/client";
import { useDashboard } from "../../store/dashboard";
import { fmtDollars, fmtNumber, fmtMonth } from "../../utils";

export function ProviderDetail() {
  const { selectedNpi, setSelectedNpi, setSelectedProcedure } = useDashboard();
  const { data: detail, loading } = useApi(
    () => (selectedNpi ? api.providerDetail(selectedNpi) : Promise.resolve(null)),
    [selectedNpi]
  );
  const { data: procedures } = useApi(
    () => (selectedNpi ? api.providerProcedures(selectedNpi) : Promise.resolve(null)),
    [selectedNpi]
  );

  if (!selectedNpi) return null;

  return (
    <div className="provider-detail">
      <div className="detail-header">
        <button className="back-btn" onClick={() => setSelectedNpi(null)}>
          ← Back
        </button>
        {loading ? (
          <div className="detail-skeleton" />
        ) : detail ? (
          <>
            <h3>{detail.name}</h3>
            <p className="detail-sub">
              NPI: {detail.npi} · {detail.city}, {detail.state} {detail.zip}
            </p>
            {detail.nppes?.taxonomy && (
              <p className="detail-taxonomy">{detail.nppes.taxonomy}</p>
            )}
            {detail.nppes?.credentials && (
              <p className="detail-creds">{detail.nppes.credentials}</p>
            )}
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
            <span className="stat-value">{fmtNumber(detail.unique_procedures)}</span>
            <span className="stat-label">Procedures</span>
          </div>
          <div className="stat">
            <span className="stat-value">
              {fmtMonth(detail.first_month)} – {fmtMonth(detail.last_month)}
            </span>
            <span className="stat-label">Active Period</span>
          </div>
        </div>
      )}

      {procedures && procedures.length > 0 && (
        <div className="detail-procedures">
          <h4>Top Procedures</h4>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Description</th>
                <th className="num">Paid</th>
              </tr>
            </thead>
            <tbody>
              {procedures.map((p) => (
                <tr
                  key={p.hcpcs_code}
                  className="clickable-row"
                  onClick={() => setSelectedProcedure(p.hcpcs_code)}
                >
                  <td className="code">{p.hcpcs_code}</td>
                  <td>{p.description}</td>
                  <td className="num">{fmtDollars(p.total_paid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
