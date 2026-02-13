import type {
  Overview,
  MonthlyData,
  StateMonthlyData,
  ProviderSummary,
  ProviderDetail,
  ProviderProcedure,
  ProcedureSummary,
  ProcedureDetail,
  ProcedureProvider,
  MapProvider,
} from "../types/api";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

export const api = {
  overview: () => get<Overview>("/api/stats/overview"),
  nationalTimeseries: () => get<MonthlyData[]>("/api/stats/timeseries/national"),
  stateTimeseries: (state?: string) =>
    get<StateMonthlyData[]>(
      `/api/stats/timeseries/state${state ? `?state=${state}` : ""}`
    ),

  searchProviders: (q: string) =>
    get<ProviderSummary[]>(`/api/providers/search?q=${encodeURIComponent(q)}`),
  topProviders: (state?: string, limit = 25) =>
    get<ProviderSummary[]>(
      `/api/providers/top?limit=${limit}${state ? `&state=${state}` : ""}`
    ),
  providerDetail: (npi: string) => get<ProviderDetail>(`/api/providers/${npi}`),
  providerTimeseries: (npi: string) =>
    get<MonthlyData[]>(`/api/providers/${npi}/timeseries`),
  providerProcedures: (npi: string) =>
    get<ProviderProcedure[]>(`/api/providers/${npi}/procedures`),

  searchProcedures: (q: string) =>
    get<ProcedureSummary[]>(
      `/api/procedures/search?q=${encodeURIComponent(q)}`
    ),
  topProcedures: (limit = 25) =>
    get<ProcedureSummary[]>(`/api/procedures/top?limit=${limit}`),
  procedureDetail: (code: string) =>
    get<ProcedureDetail>(`/api/procedures/${encodeURIComponent(code)}/detail`),
  procedureProviders: (code: string) =>
    get<ProcedureProvider[]>(`/api/procedures/${encodeURIComponent(code)}/providers`),
  procedureTimeseries: (code: string) =>
    get<MonthlyData[]>(`/api/procedures/${encodeURIComponent(code)}/timeseries`),

  mapProviders: (opts?: {
    state?: string;
    month_from?: string;
    month_to?: string;
    limit?: number;
  }) => {
    const params = new URLSearchParams();
    if (opts?.state) params.set("state", opts.state);
    if (opts?.month_from) params.set("month_from", opts.month_from);
    if (opts?.month_to) params.set("month_to", opts.month_to);
    if (opts?.limit) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return get<MapProvider[]>(`/api/map/providers${qs ? `?${qs}` : ""}`);
  },
};
