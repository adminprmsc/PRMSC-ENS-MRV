import { useState } from "react";
import { toast } from "sonner";
import { Ban, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE } from "@/constants/roles";
import { useAuth } from "@/contexts/AuthContext";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  managerOpsDeleteSolarLog,
  managerOpsDeleteWaterLog,
  managerOpsRejectWaterLog,
} from "@/services/tehsilManagerOperatorService";
import { ManagerOverrideDialog, type OverrideMode } from "./ManagerOverrideDialog";

type Props =
  | {
      entryType: "water_log";
      recordId: string;
      /** Current water log / submission status. */
      status: string;
      entryLabel: string;
      onDone: (action: OverrideMode) => void;
    }
  | {
      entryType: "solar_log";
      recordId: string;
      status?: undefined;
      entryLabel: string;
      onDone: (action: OverrideMode) => void;
    };

/**
 * Manager Operations (SUPER_ADMIN) actions on an approved entry.
 * Renders nothing for other roles or when no action applies to the status —
 * the backend enforces the same rules.
 */
export function ManagerOverrideCard(props: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<OverrideMode | null>(null);

  if (user?.role !== ROLE.SUPER_ADMIN || !props.recordId) return null;

  const isWater = props.entryType === "water_log";
  const status = (props.status ?? "").toLowerCase();
  const canReject = isWater && status === "accepted";
  const canDelete = isWater ? status === "accepted" || status === "rejected" : true;
  if (!canReject && !canDelete) return null;

  const entryKind = isWater ? "water log" : "solar entry";

  const confirm = async (reason: string) => {
    if (!mode) return;
    try {
      if (isWater && mode === "reject") {
        await managerOpsRejectWaterLog(props.recordId, reason);
        toast.success("Water log rejected");
      } else if (isWater) {
        await managerOpsDeleteWaterLog(props.recordId, reason);
        toast.success("Water log deleted");
      } else {
        await managerOpsDeleteSolarLog(props.recordId, reason);
        toast.success("Solar entry deleted");
      }
      props.onDone(mode);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Action failed"));
      throw e;
    }
  };

  return (
    <>
      <Card className="border-rose-200/70">
        <CardHeader className="border-b border-border/60 bg-rose-50/40 py-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <ShieldAlert className="size-4 text-rose-700" />
            Manager Operations override
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {isWater && status === "rejected"
              ? "This log was rejected. You can remove it permanently; a reason is required."
              : `Reject or delete this approved ${entryKind}. A reason is required and every change is kept in the change history.`}
          </p>
        </CardHeader>
        <CardFooter className="flex flex-wrap justify-end gap-2 py-3">
          {canReject ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-amber-300 text-amber-800 hover:bg-amber-50"
              onClick={() => setMode("reject")}
            >
              <Ban className="size-4" />
              Reject
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              type="button"
              size="sm"
              className="bg-rose-700 text-white hover:bg-rose-800"
              onClick={() => setMode("delete")}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          ) : null}
        </CardFooter>
      </Card>
      <ManagerOverrideDialog
        open={mode !== null}
        onOpenChange={(o) => !o && setMode(null)}
        mode={mode ?? "reject"}
        entryKind={entryKind}
        entryLabel={props.entryLabel}
        onConfirm={confirm}
      />
    </>
  );
}
