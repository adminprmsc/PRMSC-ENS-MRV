import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export type DetailTileField = {
  label: string;
  value: ReactNode;
  className?: string;
};

type DetailTileProps = {
  title: string;
  summary?: string;
  badge?: ReactNode;
  progress?: number | null;
  progressHint?: string;
  fields: DetailTileField[];
  actionHref?: string;
  actionLabel?: string;
  children?: ReactNode;
  className?: string;
};

/** Compact enterprise panel used inside DataGrid row expansions. */
export function DetailTile({
  title,
  summary,
  badge,
  progress,
  progressHint,
  fields,
  actionHref,
  actionLabel = "Open",
  children,
  className,
}: DetailTileProps) {
  return (
    <div
      className={cn(
        "animate-fade-in-up rounded-xl border border-border/70 bg-card/90 p-4 shadow-sm ring-1 ring-foreground/[0.03]",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold tracking-tight text-foreground">
              {title}
            </p>
            {badge}
          </div>
          {summary ? (
            <p className="text-xs text-muted-foreground">{summary}</p>
          ) : null}
          {progress != null ? (
            <div className="max-w-md space-y-1.5 pt-1">
              <Progress value={progress} className="h-1.5" />
              {progressHint ? (
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  {progressHint}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        {actionHref ? (
          <Link
            to={actionHref}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-8 shrink-0 gap-1.5 self-start",
            )}
          >
            {actionLabel}
            <ArrowRight className="size-3.5" />
          </Link>
        ) : null}
      </div>

      {fields.length > 0 ? (
        <dl
          className={cn(
            "mt-4 grid gap-2.5",
            fields.length <= 2
              ? "sm:grid-cols-2"
              : fields.length === 3
                ? "sm:grid-cols-3"
                : "sm:grid-cols-2 lg:grid-cols-4",
          )}
        >
          {fields.map((field) => (
            <div
              key={field.label}
              className={cn(
                "rounded-lg border border-border/60 bg-muted/35 px-3 py-2.5",
                field.className,
              )}
            >
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {field.label}
              </dt>
              <dd className="mt-1 text-sm font-medium leading-snug text-foreground">
                {field.value || "—"}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
