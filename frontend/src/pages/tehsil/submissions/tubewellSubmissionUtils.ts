export type TubewellSubmissionRow = {
  id: string;
  submission_type: "water_system" | string;
  status: "submitted" | "accepted" | "rejected" | "reverted_back" | string;
  operator_name?: string;
  operator_email?: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by_name?: string | null;
  remarks?: string | null;
  system_info?: {
    id?: string;
    uid?: string;
    village?: string;
    tehsil?: string;
    year?: number;
    month?: number;
    last_edited_at?: string | null;
    pump_start_time?: string | null;
    pump_end_time?: string | null;
    pump_operating_hours?: number | null;
    total_water_pumped?: number | null;
    bulk_meter_image_url?: string | null;
  };
};

export type WaterSystemCatalogRow = {
  id: string;
  tehsil?: string;
  village?: string;
  unique_identifier?: string;
};

export type SubmissionListFilters = {
  search: string;
  status: string;
  tehsil: string;
  waterSystemId: string;
  year: string;
  month: string;
};

export function isWaterSubmission(row: TubewellSubmissionRow): boolean {
  return row.submission_type === "water_system";
}

export function filterTubewellSubmissions(
  rows: TubewellSubmissionRow[],
  filters: SubmissionListFilters,
): TubewellSubmissionRow[] {
  const q = filters.search.trim().toLowerCase();

  return rows
    .filter(isWaterSubmission)
    .filter((r) => (filters.status === "all" ? true : r.status === filters.status))
    .filter((r) => {
      const t = (r.system_info?.tehsil ?? "").trim();
      if (filters.tehsil === "all") return true;
      return t.toUpperCase() === filters.tehsil.toUpperCase();
    })
    .filter((r) => {
      const sid = (r.system_info?.id ?? "").trim();
      if (filters.waterSystemId === "all") return true;
      return sid === filters.waterSystemId;
    })
    .filter((r) => {
      const y = r.system_info?.year;
      if (!filters.year) return true;
      return y === Number(filters.year);
    })
    .filter((r) => {
      const m = r.system_info?.month;
      if (!filters.month) return true;
      return m === Number(filters.month);
    })
    .filter((r) => {
      if (!q) return true;
      const blob = [
        r.id,
        r.operator_name ?? "",
        r.operator_email ?? "",
        r.status,
        r.reviewed_by_name ?? "",
        r.system_info?.uid ?? "",
        r.system_info?.tehsil ?? "",
        r.system_info?.village ?? "",
        String(r.system_info?.month ?? ""),
        String(r.system_info?.year ?? ""),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    })
    .sort((a, b) => {
      const ad = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const bd = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
      return bd - ad;
    });
}

export function tubewellSubmissionStats(rows: TubewellSubmissionRow[]) {
  const water = rows.filter(isWaterSubmission);
  return {
    total: water.length,
    pending: water.filter((r) => r.status === "submitted").length,
    accepted: water.filter((r) => r.status === "accepted").length,
    rejected: water.filter((r) => r.status === "rejected").length,
    reverted: water.filter((r) => r.status === "reverted_back").length,
  };
}

export function buildWaterSystemOptions(
  rows: TubewellSubmissionRow[],
  waterSystems: WaterSystemCatalogRow[],
  tehsil: string,
): Array<{ id: string; label: string }> {
  const map = new Map<
    string,
    { id: string; uid: string; village?: string; tehsil?: string }
  >();

  for (const s of waterSystems) {
    const id = String(s.id ?? "").trim();
    const uid = String(s.unique_identifier ?? "").trim();
    const t = String(s.tehsil ?? "").trim();
    const v = String(s.village ?? "").trim();
    if (!id || !uid) continue;
    if (tehsil !== "all" && t.toUpperCase() !== tehsil.toUpperCase()) continue;
    map.set(id, { id, uid, tehsil: t || undefined, village: v || undefined });
  }

  for (const r of rows) {
    if (!isWaterSubmission(r)) continue;
    const sysId = String(r.system_info?.id ?? "").trim();
    const uid = String(r.system_info?.uid ?? "").trim();
    const t = String(r.system_info?.tehsil ?? "").trim();
    if (!sysId || !uid) continue;
    if (tehsil !== "all" && t.toUpperCase() !== tehsil.toUpperCase()) continue;
    if (!map.has(sysId)) {
      map.set(sysId, {
        id: sysId,
        uid,
        village: (r.system_info?.village ?? "").trim() || undefined,
        tehsil: t || undefined,
      });
    }
  }

  return [{ id: "all", label: "All water systems" }].concat(
    Array.from(map.values())
      .sort((a, b) => a.uid.localeCompare(b.uid))
      .map((s) => ({
        id: s.id,
        label: `${s.uid}${s.village ? ` — ${s.village}` : ""}`,
      })),
  );
}

export function fmtSubmissionNum(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toFixed(2);
}
