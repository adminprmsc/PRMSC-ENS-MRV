import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  const dismiss = useMutation({ mutationFn: dismissRelease, onSuccess: refresh });
  const read = useMutation({ mutationFn: markReleaseRead, onSuccess: refresh });

  const items = data?.items ?? [];
  const top = items[0];
  if (!top) return null;
  const more = items.length - 1;

  return (
    <div
      role="region"
      aria-label="New feature announcement"
      className="mb-4 flex flex-col gap-3 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/[0.07] to-transparent p-3 shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:p-4"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Megaphone className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
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
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
