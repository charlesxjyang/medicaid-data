import { useState } from "react";
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

function App() {
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedNpi, setSelectedNpi] = useState<string | null>(null);
  const [selectedProcedure, setSelectedProcedure] = useState<string | null>(null);

  const ctx = {
    selectedState,
    selectedNpi,
    selectedProcedure,
    setSelectedState,
    setSelectedNpi: (npi: string | null) => {
      setSelectedNpi(npi);
      if (npi) setSelectedProcedure(null);
    },
    setSelectedProcedure: (code: string | null) => {
      setSelectedProcedure(code);
      if (code) setSelectedNpi(null);
    },
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
