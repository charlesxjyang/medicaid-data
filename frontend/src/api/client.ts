import type {
  Overview,
  MonthlyData,
  StateMonthlyData,
  ProviderSummary,
  ProviderDetail,
  ProviderProcedure,
  ProviderProcedureTimeseries,
  ProcedureSummary,
  ProcedureDetail,
  ProcedureProvider,
  ProcedureBenchmark,
  ProcedureAvgReimbursement,
  MapProvider,
  ExcludedProvidersResponse,
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
  topProviders: (state?: string, limit = 25, offset = 0, sort_by = "total_paid") =>
    get<ProviderSummary[]>(
      `/api/providers/top?limit=${limit}&offset=${offset}&sort_by=${sort_by}${state ? `&state=${state}` : ""}`
    ),
  providerDetail: (npi: string) => get<ProviderDetail>(`/api/providers/${npi}`),
  providerTimeseries: (npi: string) =>
    get<MonthlyData[]>(`/api/providers/${npi}/timeseries`),
  providerProcedures: (npi: string, limit = 20, offset = 0, sort_by = "total_paid") =>
    get<ProviderProcedure[]>(`/api/providers/${npi}/procedures?limit=${limit}&offset=${offset}&sort_by=${sort_by}`),
  providerProcedureTimeseries: (npi: string) =>
    get<ProviderProcedureTimeseries>(`/api/providers/${npi}/procedure-timeseries`),

  searchProcedures: (q: string) =>
    get<ProcedureSummary[]>(
      `/api/procedures/search?q=${encodeURIComponent(q)}`
    ),
  topProcedures: (state?: string, limit = 25, offset = 0, sort_by = "total_paid") =>
    get<ProcedureSummary[]>(
      `/api/procedures/top?limit=${limit}&offset=${offset}&sort_by=${sort_by}${state ? `&state=${state}` : ""}`
    ),
  procedureDetail: (code: string) =>
    get<ProcedureDetail>(`/api/procedures/${encodeURIComponent(code)}/detail`),
  procedureProviders: (code: string, limit = 25, offset = 0, sort_by = "total_paid") =>
    get<ProcedureProvider[]>(
      `/api/procedures/${encodeURIComponent(code)}/providers?limit=${limit}&offset=${offset}&sort_by=${sort_by}`
    ),
  procedureTimeseries: (code: string) =>
    get<MonthlyData[]>(`/api/procedures/${encodeURIComponent(code)}/timeseries`),
  procedureAvgReimbursement: (code: string, state?: string) =>
    get<ProcedureAvgReimbursement>(
      `/api/procedures/${encodeURIComponent(code)}/avg-reimbursement?limit=50${state ? `&state=${state}` : ""}`
    ),
  procedureBenchmarks: (codes: string, state?: string) =>
    get<ProcedureBenchmark[]>(
      `/api/procedures/benchmarks?codes=${encodeURIComponent(codes)}${state ? `&state=${state}` : ""}`
    ),

  excludedProviders: (limit = 50, offset = 0) =>
    get<ExcludedProvidersResponse>(
      `/api/analysis/excluded-providers?limit=${limit}&offset=${offset}`
    ),

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

  mapProvidersByProcedure: (code: string, state?: string, limit = 2000) => {
    const params = new URLSearchParams();
    if (state) params.set("state", state);
    params.set("limit", String(limit));
    const qs = params.toString();
    return get<MapProvider[]>(
      `/api/map/providers/procedure/${encodeURIComponent(code)}${qs ? `?${qs}` : ""}`
    );
  },
};
