import { useQuery } from "@tanstack/react-query";

import { getDashboardProgramSummary } from "../services/tehsilManagerOperatorService";

export type TehsilProgramSummarySystemRow = {
  id: string;
  unique_identifier?: string | null;
  tehsil: string;
  village: string;
  settlement?: string | null;
  site_type?: string | null;
  logs_count: number;
  days_logged?: number;
  months_logged?: number;
  last_log_date?: string | null;
  lifetime_last_log_date?: string | null;
  lifetime_last_log_year?: number | null;
  lifetime_last_log_month?: number | null;
  logged: boolean;
};

export type TehsilProgramSummaryByTehsil = {
  tehsil: string;
  water_sites: number;
  solar_sites: number;
  water_logs: number;
  solar_logs: number;
  water_sites_logged: number;
  solar_sites_logged: number;
};

export type TehsilProgramSummary = {
  ohr_count: number;
  solar_facilities: number;
  bulk_meters: number;
  water_logs_count?: number;
  solar_logs_count?: number;
  water_sites_logged?: number;
  solar_sites_logged?: number;
  by_tehsil?: TehsilProgramSummaryByTehsil[];
  water_systems?: TehsilProgramSummarySystemRow[];
  solar_systems?: TehsilProgramSummarySystemRow[];
};

export type TehsilProgramSummaryFilters = {
  tehsil?: string;
  village?: string;
  month?: string | number;
  year?: number;
};

/** Tehsil dashboard KPI strip — same `/dashboard/program-summary` API, scoped by filters. */
export function useTehsilProgramSummary(filters: TehsilProgramSummaryFilters) {
  return useQuery({
    queryKey: ["tehsil-program-summary", filters],
    queryFn: async () =>
      (await getDashboardProgramSummary(filters)) as TehsilProgramSummary,
  });
}
