import { useState, useRef, useCallback, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from "recharts";
import { api } from "../../api/client";
import { fmtDollars } from "../../utils";
import { useApi } from "../../hooks/useApi";
import { useDashboard } from "../../store/dashboard";
import type { ProcedureSummary } from "../../types/api";

export function ProcedureReimbursementChart() {
  const { selectedProcedure, setSelectedNpi } = useDashboard();

  const [localCode, setLocalCode] = useState<string | null>(null);
  const [localLabel, setLocalLabel] = useState("");
  const [sort, setSort] = useState<"asc" | "desc">("desc");

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProcedureSummary[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sync with global procedure selection
  useEffect(() => {
    if (selectedProcedure) {
      setLocalCode(selectedProcedure);
      // Fetch procedure detail to get the label
      api.procedureDetail(selectedProcedure).then((d) => {
        setLocalLabel(`${d.hcpcs_code} — ${d.description || d.hcpcs_code}`);
      });
    }
  }, [selectedProcedure]);

  const activeCode = localCode;

  const fetcher = useCallback(
    () => (activeCode ? api.procedureAvgReimbursement(activeCode, sort) : Promise.resolve(null)),
    [activeCode, sort]
  );
  const { data, loading } = useApi(fetcher, [activeCode, sort]);

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
    setLocalCode(proc.hcpcs_code);
    setLocalLabel(`${proc.hcpcs_code} — ${proc.description || proc.hcpcs_code}`);
    setQuery("");
    setOpen(false);
  }

  function handleBarClick(npi: string) {
    setSelectedNpi(npi);
    // Scroll to top so the user sees the provider detail
    window.scrollTo({ top: 0, behavior: "smooth" });
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
          {activeCode && (
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

      {activeCode && (
        <div className="reimb-label">{localLabel}</div>
      )}

      {!activeCode ? (
        <div className="reimb-empty">
          Search for a procedure above to see average reimbursement by provider
        </div>
      ) : loading || !data ? (
        <div className="chart-skeleton" style={{ height: 400 }} />
      ) : (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={chartData}
            margin={{ top: 16, right: 16, bottom: 8, left: 8 }}
            style={{ cursor: "pointer" }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="name" tick={false} height={10} />
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
                    <div className="reimb-tooltip-hint">Click to view provider</div>
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
              radius={[3, 3, 0, 0]}
              maxBarSize={24}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick={(d: any) => handleBarClick(d.npi)}
            >
              {chartData?.map((_, i) => (
                <Cell key={i} fill="#3b82f6" className="reimb-bar" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
