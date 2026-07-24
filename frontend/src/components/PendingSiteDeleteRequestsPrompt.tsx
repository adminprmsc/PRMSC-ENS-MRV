import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
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
import { hqRoutes } from "@/constants/routes";
import { listSiteDeleteRequests } from "@/services/tehsilManagerOperatorService";

const DISMISS_KEY = "mrv:pending-delete-requests-dismissed-count";

type PendingSiteDeleteRequestsPromptProps = {
  /** When false, skip polling and close any open prompt. */
  enabled: boolean;
  /** Optional: surface pending count to parent (e.g. sidebar badge). */
  onCountChange?: (count: number) => void;
};

/**
 * Manager Operations: popup when tehsil managers have pending site delete
 * requests that need approve/reject.
 */
export function PendingSiteDeleteRequestsPrompt({
  enabled,
  onCountChange,
}: PendingSiteDeleteRequestsPromptProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      setOpen(false);
      onCountChange?.(0);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const data = await listSiteDeleteRequests("pending");
        const next = Array.isArray(data.requests) ? data.requests.length : 0;
        if (cancelled) return;
        setCount(next);
        onCountChange?.(next);

        const onDeletePage =
          location.pathname === hqRoutes.deleteRequests ||
          location.pathname.startsWith(`${hqRoutes.deleteRequests}/`);
        if (onDeletePage || next <= 0) {
          setOpen(false);
          return;
        }

        const dismissed = Number(
          sessionStorage.getItem(DISMISS_KEY) || "0",
        );
        if (next > dismissed) {
          setOpen(true);
        }
      } catch {
        if (!cancelled) {
          setCount(0);
          onCountChange?.(0);
          setOpen(false);
        }
      }
    };

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 60_000);

    const onFocus = () => {
      if (document.visibilityState === "hidden") return;
      void load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [enabled, location.pathname, onCountChange]);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, String(count));
    setOpen(false);
  };

  const review = () => {
    sessionStorage.setItem(DISMISS_KEY, String(count));
    setOpen(false);
    navigate(hqRoutes.deleteRequests);
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
        else setOpen(true);
      }}
    >
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-rose-100 text-rose-700">
            <Trash2 className="size-5" />
          </AlertDialogMedia>
          <AlertDialogTitle>
            {count === 1
              ? "1 site delete request pending"
              : `${count} site delete requests pending`}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left">
            Tehsil managers requested site deletions that need your decision.
            Approve to permanently remove the site, or reject to keep it and
            reopen logging.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={dismiss}>Later</AlertDialogCancel>
          <AlertDialogAction
            className="bg-rose-700 text-white hover:bg-rose-800"
            onClick={review}
          >
            Review requests
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
