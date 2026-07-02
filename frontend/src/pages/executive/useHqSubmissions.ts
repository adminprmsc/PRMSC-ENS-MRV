import { useCallback, useEffect, useState } from "react";
import { getWaterVerificationQueue } from "@/services/tehsilManagerOperatorService";
import { getApiErrorMessage } from "@/lib/api-error";
import type { HqSubmissionRow, HqSubmissionScope } from "./hqSubmissionTypes";

export function filterApprovedSubmissions(
  submissions: HqSubmissionRow[],
  opts: {
    waterSystemId: string;
    scope?: HqSubmissionScope;
  },
): HqSubmissionRow[] {
  const { waterSystemId, scope } = opts;
  return submissions.filter((s) => {
    if (s.status !== "accepted") return false;
    if (String(s.system_info?.id ?? "") !== String(waterSystemId)) return false;
    if (scope?.year != null && s.system_info?.year !== scope.year) return false;
    if (scope?.month != null && s.system_info?.month !== scope.month) return false;
    return true;
  });
}

export function latestAcceptedByWaterSystem(
  submissions: HqSubmissionRow[],
): Map<string, HqSubmissionRow> {
  const map = new Map<string, HqSubmissionRow>();
  for (const s of submissions) {
    if (s.status !== "accepted") continue;
    const wsId = String(s.system_info?.id ?? "").trim();
    if (!wsId) continue;
    const existing = map.get(wsId);
    const reviewed = String(s.reviewed_at ?? s.submitted_at ?? "");
    const existingReviewed = String(
      existing?.reviewed_at ?? existing?.submitted_at ?? "",
    );
    if (!existing || reviewed > existingReviewed) {
      map.set(wsId, s);
    }
  }
  return map;
}

export function useHqSubmissions() {
  const [submissions, setSubmissions] = useState<HqSubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = (await getWaterVerificationQueue()) as {
        submissions?: HqSubmissionRow[];
      };
      setSubmissions(Array.isArray(data?.submissions) ? data.submissions : []);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load submissions"));
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { submissions, loading, error, reload: load };
}
