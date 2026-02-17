export interface Overview {
  total_paid: number;
  total_claims: number;
  total_beneficiaries: number;
  total_providers: number;
  first_month: string;
  last_month: string;
}

export interface MonthlyData {
  month: string;
  unique_providers?: number;
  total_beneficiaries: number;
  total_claims: number;
  total_paid: number;
}

export interface StateMonthlyData extends MonthlyData {
  state: string;
}

export interface ProviderSummary {
  npi: string;
  name: string;
  state: string;
  city: string;
  total_paid: number;
  total_claims: number;
  total_beneficiaries?: number;
  is_excluded?: boolean;
}

export interface ExclusionInfo {
  is_excluded: boolean;
  exclusion_type: string;
  exclusion_date: string;
  reinstatement_date: string | null;
}

export interface ProviderDetail extends ProviderSummary {
  zip: string;
  lat: number | null;
  lng: number | null;
  unique_procedures: number;
  first_month: string;
  last_month: string;
  is_excluded: boolean;
  exclusion?: ExclusionInfo | null;
  nppes?: {
    org_name: string | null;
    first_name: string | null;
    last_name: string | null;
    credentials: string | null;
    taxonomy: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    phone: string | null;
    enumeration_date: string | null;
    sex: string | null;
  };
}

export interface ProviderProcedure {
  hcpcs_code: string;
  description: string;
  total_beneficiaries: number;
  total_claims: number;
  total_paid: number;
}

export interface ProcedureSummary {
  hcpcs_code: string;
  description: string;
  unique_providers: number;
  total_paid: number;
  total_claims?: number;
}

export interface ProcedureDetail {
  hcpcs_code: string;
  description: string;
  unique_providers: number;
  total_paid: number;
  total_claims: number;
  total_beneficiaries: number;
}

export interface ProcedureProvider {
  npi: string;
  name: string;
  state: string;
  city: string;
  total_beneficiaries: number;
  total_claims: number;
  total_paid: number;
}

export interface ProcedureBenchmark {
  hcpcs_code: string;
  national_per_claim: number | null;
  state_per_claim: number | null;
}

export interface ProcedureAvgReimbursement {
  national_avg: number | null;
  state_avg: number | null;
  providers: {
    npi: string;
    name: string;
    state: string | null;
    avg_per_claim: number;
    total_claims: number;
    total_paid: number;
  }[];
}

export interface ProviderProcedureTimeseries {
  procedures: { code: string; description: string }[];
  series: Record<string, string | number>[];
}

export interface MapProvider {
  npi: string;
  name: string;
  state: string;
  city: string;
  lat: number;
  lng: number;
  total_paid: number;
  total_claims: number;
  total_beneficiaries: number;
}

export interface ExcludedProvider {
  npi: string;
  name: string;
  state: string;
  city: string;
  total_paid: number;
  total_claims: number;
  exclusion_type: string;
  exclusion_date: string;
  reinstatement_date: string | null;
  business_name: string | null;
  specialty: string | null;
}

export interface ExcludedProvidersResponse {
  providers: ExcludedProvider[];
  total: number;
}
