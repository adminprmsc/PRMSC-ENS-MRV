import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Megaphone, X } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { releaseRoutes } from "@/constants/routes";
import { cn } from "@/lib/utils";
import {
  RELEASE_QUERY_KEYS,
  dismissRelease,
  getReleaseAnnouncements,
  markReleaseRead,
} from "@/services/releaseNotesService";

/**
 * Shown on every portal page while a release is in its announcement window
 * (~30 days) and the user hasn't dismissed it. Fetching it also delivers the
 * one-time bell notification server-side.
 */
export function ReleaseAnnouncementBanner() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: RELEASE_QUERY_KEYS.announcements,
    queryFn: getReleaseAnnouncements,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: RELEASE_QUERY_KEYS.announcements });
    void qc.invalidateQueries({ queryKey: RELEASE_QUERY_KEYS.list });
    void qc.invalidateQueries({ queryKey: ["notifications"] });
  };
  const dismiss = useMutation({
    mutationFn: dismissRelease,
    onSuccess: refresh,
  });
  const read = useMutation({ mutationFn: markReleaseRead, onSuccess: refresh });

  const reduce = useReducedMotion();
  const items = data?.items ?? [];
  const top = items[0];
  const more = items.length - 1;

  return (
    <AnimatePresence initial mode="wait">
      {top ? (
        <motion.div
          key={top.id}
          role="region"
          aria-label="New feature announcement"
          initial={
            reduce ? { opacity: 0 } : { opacity: 0, y: -14, scale: 0.97 }
          }
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 380, damping: 26 }}
          className="relative mb-4 flex flex-col gap-3 overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-r from-primary/[0.09] via-primary/[0.04] to-transparent p-3 pl-4 shadow-md sm:flex-row sm:items-center sm:gap-4 sm:p-4 sm:pl-5"
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-1 bg-primary"
          />
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <motion.span
              className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"
              animate={
                reduce ? { rotate: 0 } : { rotate: [0, -14, 12, -8, 5, 0] }
              }
              transition={{ duration: 0.9, delay: 0.35, ease: "easeInOut" }}
            >
              <Megaphone className="size-[18px]" />
              <span className="absolute -top-1 -right-1 flex size-3">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex size-3 rounded-full bg-sky-500 ring-2 ring-background" />
              </span>
            </motion.span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] tracking-wider">
                  New
                </span>
                What’s new · v{top.version}
                {more > 0 ? (
                  <span className="ml-1.5 font-medium normal-case tracking-normal text-muted-foreground">
                    +{more} more update{more === 1 ? "" : "s"}
                  </span>
                ) : null}
              </p>
              <p className="truncate text-sm font-semibold">{top.title}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground sm:line-clamp-1">
                {top.summary}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
            <Link
              to={releaseRoutes.note(top.id)}
              onClick={() => read.mutate(top.id)}
              className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
            >
              See how it works
              <ArrowRight className="size-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => dismiss.mutate(top.id)}
              disabled={dismiss.isPending}
              aria-label={`Dismiss announcement: ${top.title}`}
              title="Dismiss — you can find it later in What’s new"
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
