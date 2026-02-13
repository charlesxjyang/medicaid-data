import { createContext, useContext } from "react";

export interface DashboardState {
  selectedState: string | null;
  selectedNpi: string | null;
  selectedProcedure: string | null;
}

export interface DashboardActions {
  setSelectedState: (state: string | null) => void;
  setSelectedNpi: (npi: string | null) => void;
  setSelectedProcedure: (code: string | null) => void;
}

export type DashboardContextType = DashboardState & DashboardActions;

export const DashboardContext = createContext<DashboardContextType | null>(null);

export function useDashboard(): DashboardContextType {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
