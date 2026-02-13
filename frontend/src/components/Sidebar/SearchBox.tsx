import { useState, useRef } from "react";
import { api } from "../../api/client";
import { useDashboard } from "../../store/dashboard";
import { fmtDollars } from "../../utils";
import type { ProviderSummary } from "../../types/api";

export function SearchBox() {
  const { setSelectedNpi } = useDashboard();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProviderSummary[]>([]);
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
      const data = await api.searchProviders(value);
      setResults(data);
      setOpen(data.length > 0);
    }, 250);
  }

  function select(npi: string) {
    setSelectedNpi(npi);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="search-box">
      <input
        type="text"
        placeholder="Search providers by name or NPI..."
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {open && (
        <ul className="search-results">
          {results.map((r) => (
            <li key={r.npi} onMouseDown={() => select(r.npi)}>
              <span className="search-name">{r.name}</span>
              <span className="search-meta">
                {r.city}, {r.state} · {fmtDollars(r.total_paid)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
