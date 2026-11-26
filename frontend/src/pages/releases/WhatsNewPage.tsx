import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpenCheck,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Rocket,
  Sparkles,
  Wrench,
} from "lucide-react";

import { PageHeader, PageShell } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  RELEASE_QUERY_KEYS,
  getReleaseNotes,
  markReleaseRead,
  type ReleaseNoteItem,
} from "@/services/releaseNotesService";

const CATEGORY: Record<
  ReleaseNoteItem["category"],
  { label: string; icon: React.ReactNode; className: string }
> = {
  feature: {
    label: "New feature",
    icon: <Rocket className="size-3" />,
    className:
      "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-300",
  },
  enhancement: {
    label: "Enhancement",
    icon: <Sparkles className="size-3" />,
    className:
      "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
  },
  fix: {
    label: "Fix",
    icon: <Wrench className="size-3" />,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
};

function fmtDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function ReleaseCard({
  note,
  defaultOpen,
  onOpenFeature,
}: {
  note: ReleaseNoteItem;
  defaultOpen: boolean;
  onOpenFeature: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => setOpen(defaultOpen), [defaultOpen]);
  const cat = CATEGORY[note.category];
  const isNew = note.announced && !note.read_at;

  return (
    <Card
      id={note.id}
      className={cn(
        "scroll-mt-24 overflow-hidden shadow-sm",
        isNew && "ring-2 ring-primary/20",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left sm:p-5"
      >
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                cat.className,
              )}
            >
              {cat.icon}
              {cat.label}
            </span>
            <span className="text-xs text-muted-foreground">
              v{note.version} · {fmtDate(note.date)}
            </span>
            {isNew ? (
              <Badge className="h-5 px-1.5 text-[10px]">New</Badge>
            ) : null}
          </div>
          <h2 className="text-base font-semibold leading-snug sm:text-lg">
            {note.title}
          </h2>
          <p className="text-sm text-muted-foreground">{note.summary}</p>
        </div>
        <ChevronDown
          className={cn(
            "mt-1 size-5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <CardContent className="space-y-5 border-t border-border/60 bg-muted/10 pt-5">
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <CheckCircle2 className="size-4 text-emerald-600" />
              What’s new
            </h3>
            <ul className="space-y-1.5 text-sm">
              {note.highlights.map((h) => (
                <li key={h} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <BookOpenCheck className="size-4 text-blue-600" />
              How to use it
            </h3>
            <div className="grid gap-3 lg:grid-cols-2">
              {note.training.map((t) => (
                <div
                  key={t.title}
                  className="rounded-lg border border-border/70 bg-background p-3"
                >
                  <p className="mb-2 text-sm font-medium">{t.title}</p>
                  <ol className="space-y-2">
                    {t.steps.map((s, i) => (
                      <li key={s} className="flex gap-2.5 text-sm">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                          {i + 1}
                        </span>
                        <span className="text-foreground/90">{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>

          {note.numbers_change.length ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
              <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-200">
                <Calculator className="size-4" />
                How your numbers may change
              </h3>
              <ul className="space-y-1 text-sm text-amber-900/90 dark:text-amber-100/90">
                {note.numbers_change.map((c) => (
                  <li key={c}>• {c}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {note.link ? (
            <Link
              to={note.link.path}
              onClick={onOpenFeature}
              className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
            >
              {note.link.label}
              <ArrowRight className="size-3.5" />
            </Link>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

/** "What's new" — release notes with training, filtered to your role. */
export default function WhatsNewPage() {
  const qc = useQueryClient();
  const { hash } = useLocation();
  const { data, isLoading } = useQuery({
    queryKey: RELEASE_QUERY_KEYS.list,
    queryFn: getReleaseNotes,
    staleTime: 60_000,
  });
  const read = useMutation({
    mutationFn: markReleaseRead,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: RELEASE_QUERY_KEYS.list });
      void qc.invalidateQueries({ queryKey: RELEASE_QUERY_KEYS.announcements });
    },
  });

  const target = decodeURIComponent(hash.replace(/^#/, ""));
  const items = useMemo(() => data?.items ?? [], [data]);

  // Opening the page marks announced notes as read (the badge clears).
  const unreadIds = useMemo(
    () => items.filter((i) => i.announced && !i.read_at).map((i) => i.id),
    [items],
  );
  useEffect(() => {
    if (!unreadIds.length) return;
    const t = window.setTimeout(() => {
      for (const id of unreadIds) read.mutate(id);
    }, 1500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadIds.join("|")]);

  useEffect(() => {
    if (!target || !items.length) return;
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [target, items.length]);

  return (
    <PageShell>
      <PageHeader
        icon={<Sparkles />}
        title="What’s new"
        description="Feature updates and enhancements, with step-by-step training for your role."
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No release notes for your role yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((n, idx) => (
            <ReleaseCard
              key={n.id}
              note={n}
              defaultOpen={target ? target === n.id : idx === 0}
              onOpenFeature={() => read.mutate(n.id)}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}
