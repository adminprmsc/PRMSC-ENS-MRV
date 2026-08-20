import type { QueryFilters } from "@/services/types";
import { ALL_ASSIGNED_TEHSILS } from "./fetchExecutiveScopedDashboard";

/**
 * When scope is "All Tehsils", pass assigned tehsils as one CSV param so the
 * backend can answer in a single request instead of N parallel calls.
 */
export function buildScopedApiFilters(
  apiFilters: QueryFilters,
  allowedTehsils: string[],
): QueryFilters {
  if (apiFilters.tehsil !== ALL_ASSIGNED_TEHSILS || allowedTehsils.length === 0) {
    return apiFilters;
  }
  return {
    ...apiFilters,
    tehsils: allowedTehsils.join(","),
  };
}
