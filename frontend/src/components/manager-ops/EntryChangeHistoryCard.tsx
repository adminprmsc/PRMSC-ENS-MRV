import { useCallback, useEffect, useState } from "react";
import { History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  listEntryChangeLogs,
  type EntryChangeLogRow,
} from "@/services/tehsilManagerOperatorService";
import { formatPakistanDateTime } from "@/utils/pakistanTime";
import { ChangeActionBadge } from "./ChangeActionBadge";

type Props = {
  entryId: string;
  /** Bump to refetch after an action. */
  refreshKey?: number;
};

/** Manager Operations overrides recorded against one entry. Hidden when there are none. */
export function EntryChangeHistoryCard({ entryId, refreshKey = 0 }: Props) {
  const [rows, setRows] = useState<EntryChangeLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!entryId) return;
    setLoading(true);
    setError("");
    try {
      const data = await listEntryChangeLogs({ entry_id: entryId });
      setRows(Array.isArray(data.change_logs) ? data.change_logs : []);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not load change history"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (!loading && !error && rows.length === 0) return null;

  return (
    <Card>
      <CardHeader className="border-b border-border/60 bg-muted/20 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <History className="size-4" />
          Manager Operations changes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {loading ? (
          <Skeleton className="h-14 w-full" />
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="rounded-lg border px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <ChangeActionBadge action={r.action} />
                <span className="font-medium text-foreground">
                  {r.performed_by_name ?? "Unknown user"}
                </span>
                <span>·</span>
                <span>{formatPakistanDateTime(r.created_at) || "—"}</span>
                {r.previous_status ? (
                  <span>
                    · {r.previous_status} → {r.new_status ?? "—"}
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm">{r.reason}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
