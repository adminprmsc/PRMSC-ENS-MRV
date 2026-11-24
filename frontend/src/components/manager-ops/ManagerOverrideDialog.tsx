import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Keep in sync with backend `entry-moderation.rules.ts`. */
export const OVERRIDE_REASON_MIN = 10;
export const OVERRIDE_REASON_MAX = 1000;
const CONFIRM_WORD = "delete";

export type OverrideMode = "reject" | "delete";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: OverrideMode;
  /** e.g. "water log" / "solar entry" */
  entryKind: string;
  /** e.g. "WS-123 · 2026-01-04" */
  entryLabel: string;
  /** Resolve to close; throw to keep the dialog open (caller shows the error). */
  onConfirm: (reason: string) => Promise<void>;
};

export function ManagerOverrideDialog({
  open,
  onOpenChange,
  mode,
  entryKind,
  entryLabel,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setReason("");
      setTyped("");
      setBusy(false);
    }
  }, [open]);

  const trimmed = reason.trim();
  const tooShort = trimmed.length < OVERRIDE_REASON_MIN;
  const tooLong = trimmed.length > OVERRIDE_REASON_MAX;
  const confirmOk = mode === "reject" || typed.trim().toLowerCase() === CONFIRM_WORD;
  const canSubmit = !busy && !tooShort && !tooLong && confirmOk;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onConfirm(trimmed);
      onOpenChange(false);
    } catch {
      // Caller surfaces the error; keep the dialog open so the reason isn't lost.
    } finally {
      setBusy(false);
    }
  };

  const isDelete = mode === "delete";

  return (
    <AlertDialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AlertDialogContent
        size="default"
        className="data-[size=default]:max-w-lg data-[size=default]:sm:max-w-lg"
      >
        <AlertDialogHeader>
          <AlertDialogMedia
            className={isDelete ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}
          >
            <AlertTriangle className="size-6" />
          </AlertDialogMedia>
          <AlertDialogTitle className="text-lg">
            {isDelete ? `Delete approved ${entryKind}?` : `Reject approved ${entryKind}?`}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left text-sm leading-relaxed">
            <span className="font-medium text-foreground">{entryLabel}</span>
            <br />
            {isDelete
              ? `This permanently removes the ${entryKind} from the system and from all totals. A full copy is kept in the change history together with your reason.`
              : `The ${entryKind} stays on record but is marked rejected and excluded from all totals. The operator and tehsil manager are notified with your reason.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="override-reason">
            Why are you {isDelete ? "deleting" : "rejecting"} this entry?{" "}
            <span className="font-normal text-muted-foreground">(required)</span>
          </Label>
          <Textarea
            id="override-reason"
            value={reason}
            autoFocus
            disabled={busy}
            maxLength={OVERRIDE_REASON_MAX + 50}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Meter photo shows 12,430 m³ but 14,230 m³ was entered."
            rows={4}
            className="min-h-[96px] resize-y text-sm"
          />
          <div className="flex justify-between text-xs">
            <span className={tooShort && reason.length > 0 ? "text-rose-700" : "text-muted-foreground"}>
              {tooShort
                ? `At least ${OVERRIDE_REASON_MIN} characters (${OVERRIDE_REASON_MIN - trimmed.length} more)`
                : "Stored permanently in the change history."}
            </span>
            <span className={tooLong ? "text-rose-700" : "text-muted-foreground"}>
              {trimmed.length}/{OVERRIDE_REASON_MAX}
            </span>
          </div>
        </div>

        {isDelete ? (
          <div className="space-y-2">
            <Label htmlFor="override-confirm">
              Type <span className="font-mono font-semibold">{CONFIRM_WORD}</span> to confirm
            </Label>
            <Input
              id="override-confirm"
              autoComplete="off"
              spellCheck={false}
              value={typed}
              disabled={busy}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder={CONFIRM_WORD}
              className="font-mono"
            />
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            variant="destructive"
            disabled={!canSubmit}
            onClick={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {isDelete ? "Delete entry" : "Reject entry"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
