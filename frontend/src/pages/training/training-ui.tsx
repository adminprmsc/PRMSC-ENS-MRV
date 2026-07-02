import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Clock3, GraduationCap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { trainingRoutes } from "@/constants/routes";
import type { TrainingGuide } from "@/content/training/guides";
import { cn } from "@/lib/utils";

type TrainingHeroProps = {
  title?: string;
  description?: string;
  moduleCount: number;
  guideCount: number;
  moduleLabel?: string;
  guideLabel?: string;
  showVideos?: boolean;
};

export function TrainingHero({
  title = "Training Center",
  description = "Self-paced guides and videos for PRMSC MRV — learn the platform without waiting for a live walkthrough.",
  moduleCount,
  guideCount,
  moduleLabel = "Modules",
  guideLabel = "Guides",
  showVideos,
}: TrainingHeroProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-sidebar-border/20 bg-sidebar text-white shadow-sm">
      <div
        aria-hidden
        className="enterprise-grid-bg pointer-events-none absolute inset-0 opacity-40"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/25 blur-3xl"
      />
      <div className="relative px-6 py-7 md:px-8 md:py-8">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 backdrop-blur-sm">
            <GraduationCap className="size-5 text-white" />
          </div>
          <div className="min-w-0">
            <Badge
              variant="secondary"
              className="mb-2 border-white/20 bg-white/10 text-[10px] uppercase tracking-wider text-white"
            >
              Learning &amp; support
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">
              {description}
            </p>
          </div>
        </div>
        <dl className="mt-6 flex flex-wrap gap-3 text-xs">
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 backdrop-blur-sm">
            <dt className="text-white/60">{moduleLabel}</dt>
            <dd className="mt-0.5 text-sm font-semibold">{moduleCount}</dd>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 backdrop-blur-sm">
            <dt className="text-white/60">{guideLabel}</dt>
            <dd className="mt-0.5 text-sm font-semibold">{guideCount}</dd>
          </div>
          {showVideos ? (
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 backdrop-blur-sm">
              <dt className="text-white/60">Video library</dt>
              <dd className="mt-0.5">
                <Link
                  to={trainingRoutes.videos}
                  className="text-sm font-semibold text-white underline-offset-4 hover:underline"
                >
                  Open videos
                </Link>
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}

type TrainingContentCardProps = {
  children: ReactNode;
  className?: string;
  padding?: "default" | "none";
};

export function TrainingContentCard({
  children,
  className,
  padding = "default",
}: TrainingContentCardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm",
        padding === "default" && "p-6 md:p-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

type TrainingBreadcrumbProps = {
  category?: string;
  current: string;
};

export function TrainingBreadcrumb({
  category,
  current,
}: TrainingBreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
    >
      <Link
        to={trainingRoutes.hub}
        className="font-medium transition-colors hover:text-foreground"
      >
        Training Center
      </Link>
      {category ? (
        <>
          <ChevronRight className="size-3.5 opacity-50" />
          <span>{category}</span>
        </>
      ) : null}
      <ChevronRight className="size-3.5 opacity-50" />
      <span className="font-medium text-foreground">{current}</span>
    </nav>
  );
}

type TrainingReadMetaProps = {
  minutes: number;
};

export function TrainingReadMeta({ minutes }: TrainingReadMetaProps) {
  return (
    <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
      <Clock3 className="size-3.5" />
      {minutes} min read
    </div>
  );
}

type TrainingModuleCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
  guides: TrainingGuide[];
};

export function TrainingModuleCard({
  icon,
  title,
  description,
  guides,
}: TrainingModuleCardProps) {
  return (
    <section className="group flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="border-l-4 border-l-primary bg-muted/20 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background text-primary shadow-sm">
            {icon}
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
      </div>
      <ul className="flex flex-1 flex-col divide-y divide-border/60">
        {guides.map((guide) => (
          <li key={guide.slug}>
            <Link
              to={trainingRoutes.guide(guide.slug)}
              className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm transition-colors hover:bg-muted/30"
            >
              <span className="font-medium text-foreground group-hover:text-foreground">
                {guide.title}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                {guide.readMinutes} min
                <ChevronRight className="size-3.5 opacity-60" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

type TrainingSidebarHeaderProps = {
  title?: string;
  subtitle?: string;
};

export function TrainingSidebarHeader({
  title = "Training modules",
  subtitle = "Guides & video library",
}: TrainingSidebarHeaderProps) {
  return (
    <div className="border-b border-border/60 bg-muted/30 px-4 py-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {subtitle}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{title}</p>
    </div>
  );
}

type TrainingNavLinkProps = {
  to: string;
  icon: ReactNode;
  label: string;
  active: boolean;
};

export function TrainingNavLink({
  to,
  icon,
  label,
  active,
}: TrainingNavLinkProps) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
        active
          ? "border border-primary/20 bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md",
          active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        )}
      >
        {icon}
      </span>
      {label}
    </Link>
  );
}

export function TrainingSectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
      {children}
    </p>
  );
}

export function TrainingGuideLink({
  to,
  label,
  active,
}: {
  to: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "block rounded-lg py-2 pl-9 pr-3 text-[13px] transition-colors",
        active
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}
