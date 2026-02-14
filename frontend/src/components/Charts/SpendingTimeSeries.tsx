import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { useApi } from "../../hooks/useApi";
import { api } from "../../api/client";
import { fmtDollars, fmtMonth } from "../../utils";
import { useDashboard } from "../../store/dashboard";

const COLORS = ["#3b82f6", "#f97316", "#22c55e", "#a855f7"];

export function SpendingTimeSeries() {
  const { selectedNpi, selectedProcedure } = useDashboard();

  const label = selectedNpi
    ? `Provider ${selectedNpi}`
    : selectedProcedure
      ? `Procedure ${selectedProcedure}`
      : "National";

  // Simple timeseries for national / procedure views
  const simpleFetcher = selectedNpi
    ? null
    : selectedProcedure
      ? () => api.procedureTimeseries(selectedProcedure)
      : () => api.nationalTimeseries();

  const { data: simpleData, loading: simpleLoading } = useApi(
    simpleFetcher ?? (() => Promise.resolve(null)),
    [selectedNpi, selectedProcedure]
  );

  // Stacked procedure timeseries for provider view
  const { data: stackedData, loading: stackedLoading } = useApi(
    selectedNpi
      ? () => api.providerProcedureTimeseries(selectedNpi)
      : () => Promise.resolve(null),
    [selectedNpi]
  );

  const isProvider = !!selectedNpi;
  const loading = isProvider ? stackedLoading : simpleLoading;
  const hasData = isProvider ? !!stackedData?.series?.length : !!simpleData;

  return (
    <div className="chart-panel">
      <h3 className="panel-title">Monthly Reimbursements — {label}</h3>
      {loading || !hasData ? (
        <div className="chart-skeleton" />
      ) : isProvider && stackedData ? (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={stackedData.series} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
            <defs>
              {stackedData.procedures.map((p, i) => (
                <linearGradient key={p.code} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.05} />
                </linearGradient>
              ))}
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
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="reimb-tooltip" style={{ lineHeight: 1.8 }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{fmtMonth(String(label))}</div>
                    {[...stackedData.procedures].reverse().map((proc) => {
                      const origIdx = stackedData.procedures.indexOf(proc);
                      const entry = payload.find((p) => p.dataKey === proc.code);
                      if (!entry?.value) return null;
                      return (
                        <div key={proc.code}>
                          <span style={{ color: COLORS[origIdx % COLORS.length], fontWeight: 600 }}>●</span>{" "}
                          {proc.code} — {fmtDollars(entry.value as number)}
                        </div>
                      );
                    })}
                  </div>
                );
              }}
            />
            <Legend
              formatter={(value: string) => {
                const proc = stackedData.procedures.find((p) => p.code === value);
                const desc = proc?.description ?? value;
                const short = desc.length > 30 ? desc.slice(0, 28) + "..." : desc;
                return `${value} — ${short}`;
              }}
              wrapperStyle={{ fontSize: 11 }}
            />
            {stackedData.procedures.map((p, i) => (
              <Area
                key={p.code}
                type="monotone"
                dataKey={p.code}
                stackId="1"
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={1.5}
                fill={`url(#grad-${i})`}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={simpleData!} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
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
