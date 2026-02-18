import { useState, useEffect, useCallback } from "react";
import { Analytics } from "@vercel/analytics/react";
import { DashboardContext } from "./store/dashboard";
import { ProviderMap } from "./components/Map/ProviderMap";
import { SpendingTimeSeries } from "./components/Charts/SpendingTimeSeries";
import { ProcedureReimbursementChart } from "./components/Charts/ProcedureReimbursementChart";
import { SearchBox } from "./components/Sidebar/SearchBox";
import { StateFilter } from "./components/Filters/StateFilter";
import { ProviderDetail } from "./components/Sidebar/ProviderDetail";
import { ProcedureDetail } from "./components/Sidebar/ProcedureDetail";
import { TopProviders } from "./components/Sidebar/TopProviders";
import { TopProcedures } from "./components/Sidebar/TopProcedures";

function parseUrl(): {
  npi: string | null;
  procedure: string | null;
  state: string | null;
} {
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const state = params.get("state");
  const providerMatch = path.match(/^\/provider\/(.+)$/);
  if (providerMatch) return { npi: providerMatch[1], procedure: null, state };
  const procedureMatch = path.match(/^\/procedure\/(.+)$/);
  if (procedureMatch) return { npi: null, procedure: procedureMatch[1], state };
  return { npi: null, procedure: null, state };
}

function buildUrl(
  npi: string | null,
  procedure: string | null,
  state: string | null,
): string {
  let path = "/";
  if (npi) path = `/provider/${npi}`;
  else if (procedure) path = `/procedure/${procedure}`;
  const params = new URLSearchParams();
  if (state) params.set("state", state);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

function App() {
  const initial = parseUrl();
  const [selectedState, setSelectedState] = useState<string | null>(initial.state);
  const [selectedNpi, setSelectedNpi] = useState<string | null>(initial.npi);
  const [selectedProcedure, setSelectedProcedure] = useState<string | null>(initial.procedure);
  const [excludedOnly, setExcludedOnly] = useState(false);

  // Sync URL on popstate (back/forward)
  useEffect(() => {
    const onPopState = () => {
      const parsed = parseUrl();
      setSelectedNpi(parsed.npi);
      setSelectedProcedure(parsed.procedure);
      setSelectedState(parsed.state);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const pushUrl = useCallback(
    (npi: string | null, procedure: string | null, state: string | null) => {
      const url = buildUrl(npi, procedure, state);
      if (url !== window.location.pathname + window.location.search) {
        window.history.pushState(null, "", url);
      }
    },
    [],
  );

  const ctx = {
    selectedState,
    selectedNpi,
    selectedProcedure,
    excludedOnly,
    setSelectedState: (state: string | null) => {
      setSelectedState(state);
      pushUrl(selectedNpi, selectedProcedure, state);
    },
    setSelectedNpi: (npi: string | null) => {
      setSelectedNpi(npi);
      if (npi) setSelectedProcedure(null);
      pushUrl(npi, npi ? null : selectedProcedure, selectedState);
    },
    setSelectedProcedure: (code: string | null) => {
      setSelectedProcedure(code);
      if (code) setSelectedNpi(null);
      pushUrl(code ? null : selectedNpi, code, selectedState);
    },
    setExcludedOnly,
  };

  return (
    <>
    <DashboardContext.Provider value={ctx}>
      <div className="app">
        <header className="app-header">
          <h1>Medicaid Provider Spending</h1>
          <p className="subtitle">
            Exploring HHS's{" "}
            <a
              href="https://data.cms.gov/summary-statistics-on-use-and-payments/medicaid-service-type-reports"
              target="_blank"
              rel="noopener noreferrer"
            >
              open-sourced Medicaid dataset
            </a>
            {" "}· $1.09T in Medicaid spending from 2018–2024
          </p>
        </header>

        <div className="main-grid">
          <div className="sidebar">
            <SearchBox />
            <StateFilter />
            {selectedNpi ? (
              <ProviderDetail />
            ) : selectedProcedure ? (
              <ProcedureDetail />
            ) : (
              <>
                <TopProviders />
                <TopProcedures />
              </>
            )}
          </div>
          <div className="content">
            <ProviderMap />
            <SpendingTimeSeries />
            <ProcedureReimbursementChart />
          </div>
        </div>
      </div>
    </DashboardContext.Provider>
    <Analytics />
    </>
  );
}

export default App;
