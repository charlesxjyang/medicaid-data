import { useState, useRef, useCallback } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { api } from "../../api/client";
import { fmtDollars } from "../../utils";
import { useApi } from "../../hooks/useApi";
import type { ProcedureSummary } from "../../types/api";

export function ProcedureReimbursementChart() {
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [sort, setSort] = useState<"asc" | "desc">("desc");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProcedureSummary[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetcher = useCallback(
    () => (selectedCode ? api.procedureAvgReimbursement(selectedCode, sort) : Promise.resolve(null)),
    [selectedCode, sort]
  );
  const { data, loading } = useApi(fetcher, [selectedCode, sort]);

  function handleInput(value: string) {
    setQuery(value);
    clearTimeout(timerRef.current);
    if (value.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      const procs = await api.searchProcedures(value);
      setResults(procs.slice(0, 8));
      setOpen(procs.length > 0);
    }, 250);
  }

  function select(proc: ProcedureSummary) {
    setSelectedCode(proc.hcpcs_code);
    setSelectedLabel(`${proc.hcpcs_code} — ${proc.description || proc.hcpcs_code}`);
    setQuery("");
    setOpen(false);
  }

  const chartData = data?.providers?.map((p) => ({
    name: p.name.length > 28 ? p.name.slice(0, 26) + "..." : p.name,
    fullName: p.name,
    avg_per_claim: p.avg_per_claim,
    total_claims: p.total_claims,
    state: p.state,
    npi: p.npi,
  }));

  return (
    <div className="chart-panel">
      <div className="reimb-header">
        <h3 className="panel-title" style={{ marginBottom: 0 }}>
          Avg Reimbursement per Claim by Provider
        </h3>
        <div className="reimb-controls">
          <div className="search-box reimb-search">
            <input
              type="text"
              placeholder="Search procedure code or name..."
              value={query}
              onChange={(e) => handleInput(e.target.value)}
              onFocus={() => results.length > 0 && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 200)}
            />
            {open && (
              <ul className="search-results">
                {results.map((r) => (
                  <li key={r.hcpcs_code} onMouseDown={() => select(r)}>
                    <span className="search-name">
                      <span className="code">{r.hcpcs_code}</span>{" "}
                      {r.description}
                    </span>
                    <span className="search-meta">
                      {fmtDollars(r.total_paid)} · {r.unique_providers.toLocaleString()} providers
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {selectedCode && (
            <div className="reimb-sort">
              <button
                className={sort === "desc" ? "active" : ""}
                onClick={() => setSort("desc")}
              >
                Highest
              </button>
              <button
                className={sort === "asc" ? "active" : ""}
                onClick={() => setSort("asc")}
              >
                Lowest
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedCode && (
        <div className="reimb-label">{selectedLabel}</div>
      )}

      {!selectedCode ? (
        <div className="reimb-empty">
          Search for a procedure above to see average reimbursement by provider
        </div>
      ) : loading || !data ? (
        <div className="chart-skeleton" style={{ height: 400 }} />
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={chartData}
            margin={{ top: 16, right: 16, bottom: 80, left: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              interval={0}
              height={80}
            />
            <YAxis
              tickFormatter={(v) => fmtDollars(v)}
              tick={{ fontSize: 11 }}
              width={70}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const d = payload[0].payload;
                return (
                  <div className="reimb-tooltip">
                    <div className="reimb-tooltip-name">{d.fullName}</div>
                    <div>{d.state} · NPI {d.npi}</div>
                    <div className="reimb-tooltip-val">
                      {fmtDollars(d.avg_per_claim)} / claim
                    </div>
                    <div>{d.total_claims.toLocaleString()} total claims</div>
                  </div>
                );
              }}
            />
            {data.national_avg && (
              <ReferenceLine
                y={data.national_avg}
                stroke="#ef4444"
                strokeDasharray="6 4"
                strokeWidth={2}
                label={{
                  value: `National avg: ${fmtDollars(data.national_avg)}`,
                  position: "insideTopRight",
                  fill: "#ef4444",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              />
            )}
            <Bar
              dataKey="avg_per_claim"
              fill="#3b82f6"
              radius={[3, 3, 0, 0]}
              maxBarSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
