import { useState, useRef } from "react";
import { api } from "../../api/client";
import { useDashboard } from "../../store/dashboard";
import { fmtDollars } from "../../utils";
import type { ProviderSummary, ProcedureSummary } from "../../types/api";

type Result =
  | { type: "provider"; data: ProviderSummary }
  | { type: "procedure"; data: ProcedureSummary };

export function SearchBox() {
  const { setSelectedNpi, setSelectedProcedure } = useDashboard();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  function handleInput(value: string) {
    setQuery(value);
    clearTimeout(timerRef.current);
    if (value.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      const [providers, procedures] = await Promise.all([
        api.searchProviders(value),
        api.searchProcedures(value),
      ]);
      const merged: Result[] = [
        ...procedures.slice(0, 5).map((d) => ({ type: "procedure" as const, data: d })),
        ...providers.slice(0, 10).map((d) => ({ type: "provider" as const, data: d })),
      ];
      setResults(merged);
      setOpen(merged.length > 0);
    }, 250);
  }

  function select(r: Result) {
    if (r.type === "provider") {
      setSelectedNpi(r.data.npi);
    } else {
      setSelectedProcedure(r.data.hcpcs_code);
    }
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="search-box">
      <input
        type="text"
        placeholder="Search by NPI, provider name, procedure code or name..."
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {open && (
        <ul className="search-results">
          {results.map((r) => (
            <li
              key={r.type === "provider" ? r.data.npi : r.data.hcpcs_code}
              onMouseDown={() => select(r)}
            >
              {r.type === "procedure" ? (
                <>
                  <span className="search-name">
                    <span className="search-tag procedure">PROC</span>
                    {r.data.hcpcs_code} — {r.data.description || r.data.hcpcs_code}
                  </span>
                  <span className="search-meta">
                    {fmtDollars(r.data.total_paid)} · {r.data.unique_providers.toLocaleString()} providers
                  </span>
                </>
              ) : (
                <>
                  <span className="search-name">
                    <span className="search-tag provider">PROV</span>
                    {r.data.name}
                  </span>
                  <span className="search-meta">
                    {r.data.city}, {r.data.state} · {fmtDollars(r.data.total_paid)}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
