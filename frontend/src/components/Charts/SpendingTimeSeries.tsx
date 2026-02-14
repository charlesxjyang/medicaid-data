import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useApi } from "../../hooks/useApi";
import { api } from "../../api/client";
import { fmtDollars, fmtMonth } from "../../utils";
import { useDashboard } from "../../store/dashboard";

export function SpendingTimeSeries() {
  const { selectedNpi, selectedProcedure } = useDashboard();

  const label = selectedNpi
    ? `Provider ${selectedNpi}`
    : selectedProcedure
      ? `Procedure ${selectedProcedure}`
      : "National";

  const fetcher = selectedNpi
    ? () => api.providerTimeseries(selectedNpi)
    : selectedProcedure
      ? () => api.procedureTimeseries(selectedProcedure)
      : () => api.nationalTimeseries();

  const { data, loading } = useApi(fetcher, [selectedNpi, selectedProcedure]);

  return (
    <div className="chart-panel">
      <h3 className="panel-title">Monthly Reimbursements — {label}</h3>
      {loading || !data ? (
        <div className="chart-skeleton" />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="month"
              tickFormatter={(m) => fmtMonth(m)}
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v) => fmtDollars(v)}
              tick={{ fontSize: 11 }}
              width={70}
            />
            <Tooltip
              formatter={(v) => [fmtDollars(v as number), "Paid"]}
              labelFormatter={(m) => fmtMonth(String(m))}
            />
            <Area
              type="monotone"
              dataKey="total_paid"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#spendGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
