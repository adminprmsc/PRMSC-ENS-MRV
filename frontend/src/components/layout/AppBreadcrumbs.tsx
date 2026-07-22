import { useMemo } from "react";
import { Link, matchPath, useLocation } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  HQ_DASHBOARD,
  accountRoutes,
  adminRoutes,
  hqRoutes,
  tehsilRoutes,
  trainingRoutes,
} from "@/constants/routes";

export type BreadcrumbNavItem = {
  path: string;
  label: string;
  end?: boolean;
};

export type BreadcrumbNavSection = {
  title: string;
  items: BreadcrumbNavItem[];
};

type Crumb = {
  label: string;
  href?: string;
};

function titleCaseSegment(value: string): string {
  return decodeURIComponent(value)
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function matchNavCrumb(
  pathname: string,
  sections: BreadcrumbNavSection[],
): Crumb[] | null {
  let best: { section: BreadcrumbNavSection; item: BreadcrumbNavItem } | null =
    null;

  for (const section of sections) {
    for (const item of section.items) {
      const exact = pathname === item.path;
      const nested =
        item.end !== true &&
        item.path !== "/" &&
        pathname.startsWith(`${item.path}/`);
      if (!exact && !nested) continue;
      if (!best || item.path.length > best.item.path.length) {
        best = { section, item };
      }
    }
  }

  if (!best) return null;

  const crumbs: Crumb[] = [{ label: best.section.title }];
  if (pathname === best.item.path) {
    crumbs.push({ label: best.item.label });
    return crumbs;
  }

  crumbs.push({ label: best.item.label, href: best.item.path });
  const rest = pathname.slice(best.item.path.length).replace(/^\//, "");
  const tail = rest.split("/").filter(Boolean).pop();
  if (tail) crumbs.push({ label: titleCaseSegment(tail) });
  return crumbs;
}

/** Extra detail routes that are not sidebar leaves. */
function matchDetailCrumb(pathname: string): Crumb[] | null {
  const patterns: Array<{
    pattern: string;
    crumbs: (params: Record<string, string | undefined>) => Crumb[];
  }> = [
    {
      pattern: "/hq/water-systems/:id",
      crumbs: (p) => [
        { label: "Analysis", href: hqRoutes.waterAnalysis },
        { label: "Water analysis", href: hqRoutes.waterAnalysis },
        { label: titleCaseSegment(p.id ?? "System") },
      ],
    },
    {
      pattern: "/hq/solar-sites/:id",
      crumbs: (p) => [
        { label: "Analysis", href: hqRoutes.solarAnalysis },
        { label: "Solar analysis", href: hqRoutes.solarAnalysis },
        { label: titleCaseSegment(p.id ?? "Site") },
      ],
    },
    {
      pattern: "/hq/submissions/:id",
      crumbs: (p) => [
        { label: "Monitoring", href: hqRoutes.sitesProgress },
        { label: "Submission", href: hqRoutes.sitesProgress },
        { label: titleCaseSegment(p.id ?? "Details") },
      ],
    },
    {
      pattern: "/hq/solar-records/:id",
      crumbs: (p) => [
        { label: "Analysis", href: hqRoutes.solarAnalysis },
        { label: "Solar record", href: hqRoutes.solarAnalysis },
        { label: titleCaseSegment(p.id ?? "Details") },
      ],
    },
    {
      pattern: "/tehsil/water-systems/:systemId/view",
      crumbs: (p) => [
        { label: "Water", href: tehsilRoutes.waterSystems },
        { label: "Water systems", href: tehsilRoutes.waterSystems },
        { label: titleCaseSegment(p.systemId ?? "System") },
      ],
    },
    {
      pattern: "/tehsil/solar-sites/:systemId/view",
      crumbs: (p) => [
        { label: "Solar", href: tehsilRoutes.solarSites },
        { label: "Solar systems", href: tehsilRoutes.solarSites },
        { label: titleCaseSegment(p.systemId ?? "Site") },
      ],
    },
    {
      pattern: "/tehsil/solar-sites/:systemId/edit",
      crumbs: (p) => [
        { label: "Solar", href: tehsilRoutes.solarSites },
        { label: "Solar systems", href: tehsilRoutes.solarSites },
        { label: `Edit · ${titleCaseSegment(p.systemId ?? "Site")}` },
      ],
    },
    {
      pattern: "/tehsil/submissions/:id/details",
      crumbs: (p) => [
        { label: "Water", href: tehsilRoutes.waterSubmissions },
        { label: "Submissions", href: tehsilRoutes.waterSubmissions },
        { label: titleCaseSegment(p.id ?? "Details") },
      ],
    },
    {
      pattern: "/tehsil/solar-monthly-logging/:recordId/edit",
      crumbs: (p) => [
        { label: "Solar", href: tehsilRoutes.solarMonthlyLogging },
        { label: "Monthly logging", href: tehsilRoutes.solarMonthlyLogging },
        { label: titleCaseSegment(p.recordId ?? "Edit") },
      ],
    },
    {
      pattern: "/tehsil/logging-compliance/water",
      crumbs: () => [
        { label: "Water" },
        { label: "Logging compliance" },
      ],
    },
    {
      pattern: "/tehsil/logging-compliance/solar",
      crumbs: () => [
        { label: "Solar" },
        { label: "Logging compliance" },
      ],
    },
    {
      pattern: "/training/guides/:slug",
      crumbs: (p) => [
        { label: "Help", href: trainingRoutes.hub },
        { label: "Training Center", href: trainingRoutes.hub },
        { label: titleCaseSegment(p.slug ?? "Guide") },
      ],
    },
    {
      pattern: "/training/videos",
      crumbs: () => [
        { label: "Help", href: trainingRoutes.hub },
        { label: "Training videos" },
      ],
    },
  ];

  for (const entry of patterns) {
    const match = matchPath({ path: entry.pattern, end: true }, pathname);
    if (match) return entry.crumbs(match.params);
  }
  return null;
}

function fallbackCrumb(pathname: string): Crumb[] {
  if (pathname === HQ_DASHBOARD || pathname === "/") {
    return [{ label: "Overview" }, { label: "Command Center" }];
  }
  if (pathname === adminRoutes.users) {
    return [{ label: "Administration" }, { label: "User accounts" }];
  }
  if (pathname === accountRoutes.changePassword) {
    return [{ label: "Account" }, { label: "Change password" }];
  }
  if (pathname === trainingRoutes.hub) {
    return [{ label: "Help" }, { label: "Training Center" }];
  }
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return [{ label: "Home" }];
  return parts.map((part, i): Crumb => {
    const label = titleCaseSegment(part);
    if (i >= parts.length - 1) return { label };
    return { label, href: `/${parts.slice(0, i + 1).join("/")}` };
  });
}

export function resolveAppBreadcrumbs(
  pathname: string,
  sections: BreadcrumbNavSection[],
): Crumb[] {
  return (
    matchDetailCrumb(pathname) ??
    matchNavCrumb(pathname, sections) ??
    fallbackCrumb(pathname)
  );
}

type AppBreadcrumbsProps = {
  sections: BreadcrumbNavSection[];
  className?: string;
};

/** Top-bar breadcrumbs: section › page (and detail when nested). */
export function AppBreadcrumbs({ sections, className }: AppBreadcrumbsProps) {
  const { pathname } = useLocation();
  const crumbs = useMemo(
    () => resolveAppBreadcrumbs(pathname, sections),
    [pathname, sections],
  );

  if (crumbs.length === 0) return null;

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList className="gap-1.5 sm:gap-2">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <span key={`${crumb.label}-${index}`} className="contents">
              {index > 0 ? <BreadcrumbSeparator className="opacity-50" /> : null}
              <BreadcrumbItem className="min-w-0">
                {isLast ? (
                  <BreadcrumbPage className="truncate text-sm font-medium">
                    {crumb.label}
                  </BreadcrumbPage>
                ) : crumb.href ? (
                  <BreadcrumbLink
                    render={<Link to={crumb.href} />}
                    className="truncate text-sm"
                  >
                    {crumb.label}
                  </BreadcrumbLink>
                ) : (
                  <span className="truncate text-sm text-muted-foreground">
                    {crumb.label}
                  </span>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
