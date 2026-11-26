import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Bell, CheckCheck, History } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ROLE } from "@/constants/roles";
import { hqRoutes, releaseRoutes, tehsilRoutes } from "@/constants/routes";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { roundNumbersInText } from "@/lib/roundNumbersInText";
import {
  fetchNotifications,
  markAllNotificationsReadOfType,
  markNotificationsRead,
  NOTIFICATION_TYPE_ENTRY_CHANGE,
  NOTIFICATIONS_QUERY_KEY,
  type AppNotification,
} from "@/services/notificationsService";

const POLL_MS = 60_000;

/** Where a notification should take the user, by role. Null = not clickable. */
export function notificationLink(n: AppNotification, role: string | undefined): string | null {
  const isHq = role === ROLE.SUPER_ADMIN;
  const isTehsil = role === ROLE.ADMIN;
  if (n.type === NOTIFICATION_TYPE_ENTRY_CHANGE && (isHq || isTehsil)) {
    const base = isHq ? hqRoutes.changeHistory : tehsilRoutes.changeHistory;
    return n.entity_id ? `${base}?highlight=${encodeURIComponent(n.entity_id)}` : base;
  }
  if (n.type === "release_note" && n.entity_id) {
    return releaseRoutes.note(n.entity_id);
  }
  if (n.submission_id) {
    if (isHq) return hqRoutes.waterSubmissionDetails(n.submission_id);
    if (isTehsil) return tehsilRoutes.waterSubmissionDetails(n.submission_id);
  }
  return null;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : formatDistanceToNow(d, { addSuffix: true });
}

export function NotificationBell() {
  const { user } = useAuth();
  const role = user?.role;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  /** Ids that were unread when the panel opened — kept highlighted as "New" while it stays open. */
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const knownIds = useRef<Set<string> | null>(null);

  const { data } = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: fetchNotifications,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
    enabled: Boolean(user),
  });
  const items = data?.notifications ?? [];
  const unread = data?.unread_count ?? 0;

  const markSeen = useMutation({
    mutationFn: markNotificationsRead,
    onSettled: () => qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }),
  });
  const markAll = useMutation({
    mutationFn: () => markAllNotificationsReadOfType(),
    onSettled: () => qc.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }),
  });

  // Toast notices that arrive while the app is open (not the ones present at first load).
  useEffect(() => {
    if (!data) return;
    const ids = new Set(items.map((n) => n.id));
    if (knownIds.current) {
      const arrived = items.filter((n) => !n.is_read && !knownIds.current!.has(n.id));
      for (const n of arrived.slice(0, 3)) {
        const link = notificationLink(n, role);
        toast.info(n.title, {
          description: roundNumbersInText(n.message),
          ...(link ? { action: { label: "View", onClick: () => navigate(link) } } : {}),
        });
      }
    }
    knownIds.current = ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Opening the panel = the user has seen what's listed → mark those read.
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      const unseen = items.filter((n) => !n.is_read).map((n) => n.id);
      setFreshIds(new Set(unseen));
      if (unseen.length) markSeen.mutate(unseen);
    } else {
      setFreshIds(new Set());
    }
  };

  const go = (n: AppNotification) => {
    const link = notificationLink(n, role);
    if (!link) return;
    setOpen(false);
    navigate(link);
  };

  const showHistoryLink = role === ROLE.SUPER_ADMIN || role === ROLE.ADMIN;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "relative text-muted-foreground hover:text-foreground",
        )}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <Bell className="size-4" />
        {unread > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-none text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,380px)] gap-0 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={markAll.isPending || items.every((n) => n.is_read && !freshIds.has(n.id))}
            onClick={() => markAll.mutate()}
          >
            <CheckCheck className="size-3.5" />
            Mark all read
          </Button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              You're all caught up.
            </p>
          ) : (
            items.map((n) => {
              const isNew = freshIds.has(n.id) || !n.is_read;
              const link = notificationLink(n, role);
              return (
                <button
                  key={n.id}
                  type="button"
                  disabled={!link}
                  onClick={() => go(n)}
                  className={cn(
                    "flex w-full gap-2.5 border-b px-3 py-2.5 text-left last:border-b-0",
                    link ? "hover:bg-muted/60" : "cursor-default",
                    isNew && "bg-sky-50/70 dark:bg-sky-950/30",
                  )}
                >
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      isNew ? "bg-sky-600" : "bg-transparent",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate text-sm", isNew && "font-semibold")}>
                        {n.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {timeAgo(n.created_at)}
                      </span>
                    </span>
                    <span className="mt-0.5 line-clamp-3 block text-xs text-muted-foreground">
                      {roundNumbersInText(n.message)}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
        {showHistoryLink ? (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate(role === ROLE.SUPER_ADMIN ? hqRoutes.changeHistory : tehsilRoutes.changeHistory);
            }}
            className="flex w-full items-center justify-center gap-1.5 border-t px-3 py-2 text-xs font-medium text-primary hover:bg-muted/60"
          >
            <History className="size-3.5" />
            View change history
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
