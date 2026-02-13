import { useApi } from "../../hooks/useApi";
import { api } from "../../api/client";
import { fmtDollars, fmtNumber, fmtMonth } from "../../utils";

export function KpiCards() {
  const { data, loading } = useApi(() => api.overview(), []);

  if (loading || !data) {
    return (
      <div className="kpi-row">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="kpi-card kpi-skeleton" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: "Total Paid", value: fmtDollars(data.total_paid), sub: `${fmtMonth(data.first_month)} – ${fmtMonth(data.last_month)}` },
    { label: "Total Claims", value: fmtNumber(data.total_claims) },
    { label: "Beneficiary-Months", value: fmtNumber(data.total_beneficiaries) },
    { label: "Unique Providers", value: fmtNumber(data.total_providers) },
  ];

  return (
    <div className="kpi-row">
      {cards.map((c) => (
        <div key={c.label} className="kpi-card">
          <div className="kpi-value">{c.value}</div>
          <div className="kpi-label">{c.label}</div>
          {c.sub && <div className="kpi-sub">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}
