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

const CONFIRM_WORD = "delete";
const MIN_REASON_LENGTH = 10;

type TypeToConfirmDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Human-visible site UID the user must type in step 1 */
  confirmSiteId: string;
  /** Optional display label (village / name); defaults to confirmSiteId */
  resourceName?: string;
  resourceKind: "water system" | "solar site";
  confirming?: boolean;
  /** Called with the required deletion reason after both confirm steps. */
  onConfirm: (reason: string) => void | Promise<void>;
};

/**
 * Two-step delete request confirm:
 * 1) Type the site UID + provide a reason for Manager Operations
 * 2) Type "delete"
 */
export function TypeToConfirmDeleteDialog({
  open,
  onOpenChange,
  confirmSiteId,
  resourceName,
  resourceKind,
  confirming = false,
  onConfirm,
}: TypeToConfirmDeleteDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");

  const siteId = confirmSiteId.trim();
  const label = (resourceName?.trim() || siteId || `this ${resourceKind}`).trim();
  const reasonTrimmed = reason.trim();
  const reasonOk = reasonTrimmed.length >= MIN_REASON_LENGTH;

  useEffect(() => {
    if (!open) {
      setStep(1);
      setTyped("");
      setReason("");
    }
  }, [open]);

  const matchesStep1 =
    siteId.length > 0 && typed.trim().toLowerCase() === siteId.toLowerCase();
  const matchesStep2 = typed.trim().toLowerCase() === CONFIRM_WORD;
  const canContinue = matchesStep1 && reasonOk;
  const matches = step === 1 ? canContinue : matchesStep2;

  const handleOpenChange = (next: boolean) => {
    if (confirming) return;
    onOpenChange(next);
  };

  const goNext = () => {
    if (!canContinue || confirming) return;
    setTyped("");
    setStep(2);
  };

  const finish = () => {
    if (!matchesStep2 || !reasonOk || confirming) return;
    void onConfirm(reasonTrimmed);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        size="default"
        className="data-[size=default]:max-w-lg data-[size=default]:sm:max-w-lg"
      >
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-rose-100 text-rose-700">
            <AlertTriangle className="size-6" />
          </AlertDialogMedia>
          <AlertDialogTitle className="text-lg text-rose-950 sm:text-xl">
            {step === 1
              ? `Request deletion of ${resourceKind}?`
              : `Confirm delete request`}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left text-sm leading-relaxed text-slate-700">
            {step === 1
              ? `You are requesting permanent deletion of ${label}. Manager Operations must approve before the ${resourceKind} and all related submissions are removed. The site stays active until approved.`
              : `Last chance to send this request. After Manager Operations approves, ${label} and every related submission will be erased permanently.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {step === 1 ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-950">
            This does not delete the site yet — it creates an approval request for
            Manager Operations covering this tehsil.
          </div>
        ) : (
          <div className="rounded-lg border border-rose-300 bg-rose-100 px-3 py-2.5 text-sm font-medium text-rose-950">
            Site ID and reason confirmed. Type{" "}
            <span className="font-mono">{CONFIRM_WORD}</span> to submit the
            delete request.
          </div>
        )}

        {step === 1 ? (
          <div className="space-y-2">
            <Label htmlFor="delete-request-reason" className="text-slate-800">
              Reason for Manager Operations{" "}
              <span className="font-normal text-muted-foreground">
                (min {MIN_REASON_LENGTH} characters)
              </span>
            </Label>
            <Textarea
              id="delete-request-reason"
              value={reason}
              disabled={confirming}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this site should be deleted (duplicate registration, wrong village, decommissioned, etc.)"
              rows={3}
              className="min-h-[80px] resize-y text-sm"
            />
            {reason.length > 0 && !reasonOk ? (
              <p className="text-xs text-rose-700">
                Add a clearer reason ({MIN_REASON_LENGTH - reasonTrimmed.length}{" "}
                more characters).
              </p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-slate-700">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Reason
            </p>
            <p className="mt-1 whitespace-pre-wrap">{reasonTrimmed}</p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="type-to-confirm-delete" className="text-slate-800">
            {step === 1 ? (
              <>
                Type site ID{" "}
                <span className="font-mono font-semibold">{siteId || "—"}</span>{" "}
                (step 1 of 2)
              </>
            ) : (
              <>
                Type{" "}
                <span className="font-mono font-semibold">{CONFIRM_WORD}</span>{" "}
                (step 2 of 2)
              </>
            )}
          </Label>
          <Input
            id="type-to-confirm-delete"
            key={step}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={typed}
            disabled={confirming || !siteId}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && step === 2) {
                e.preventDefault();
                finish();
              }
            }}
            placeholder={step === 1 ? siteId || "Site ID" : CONFIRM_WORD}
            className="h-11 font-mono text-base"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirming}>Cancel</AlertDialogCancel>
          {step === 1 ? (
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={!matches || confirming || !siteId}
              onClick={(e) => {
                e.preventDefault();
                goNext();
              }}
            >
              Continue
            </AlertDialogAction>
          ) : (
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={!matches || confirming}
              onClick={(e) => {
                e.preventDefault();
                finish();
              }}
            >
              {confirming ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit delete request"
              )}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
