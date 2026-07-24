import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  Droplets,
  FileCheck,
  FileText,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  PanelLeft,
  Radio,
  ShieldAlert,
  Sun,
  Trash2,
  UserPlus,
  Users,
  User as UserIcon,
  X,
} from "lucide-react";

import { PendingSiteDeleteRequestsPrompt } from "../components/PendingSiteDeleteRequestsPrompt";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import { AppBreadcrumbs } from "../components/layout/AppBreadcrumbs";
import {
  HQ_DASHBOARD,
  accountRoutes,
  adminRoutes,
  hqRoutes,
  tehsilRoutes,
  trainingRoutes,
} from "../constants/routes";
import {
  canOnboardOperators,
  isExecutiveRole,
  isTehsilManager,
  isUserAdminRole,
  roleDisplayLabel,
} from "../constants/roles";
import { useAuth } from "../contexts/AuthContext";
import companyLogo from "../assets/company-logo.png";
import { getActiveWaterSystemCalibrationCertificates } from "../services/tehsilManagerOperatorService";
import { pakistanCalendarDayDiff } from "../utils/pakistanTime";
import { cn } from "../lib/utils";

type NavItem = {
  path: string;
  icon: ReactNode;
  label: string;
  end?: boolean;
  badge?: number;
};

type NavSection = {
  title: string;
  items: NavItem[];
  /** Visual emphasis for operational callouts (e.g. Attention). */
  emphasis?: "alert";
};

const SIDEBAR_EXPANDED = 272;
const SIDEBAR_RAIL = 72;

const navLinkClass = (isActive: boolean, alert = false, collapsed = false) =>
  cn(
    "relative flex items-center rounded-md text-[13px] font-medium transition-all duration-200",
    collapsed
      ? "justify-center px-0 py-2.5"
      : "gap-2.5 px-3 py-2",
    isActive
      ? alert
        ? "bg-rose-500/20 font-medium text-rose-100 ring-1 ring-rose-400/30"
        : "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
      : alert
        ? "text-rose-100/85 hover:bg-rose-500/15 hover:text-rose-50"
        : "text-sidebar-muted hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
  );

function titleCaseLabel(value: string): string {
  return value
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function formatTehsilScope(tehsils: string[] | null | undefined): string {
  const list = (tehsils ?? []).map((t) => t.trim()).filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return titleCaseLabel(list[0]!);
  return `${list.length} tehsils`;
}

function sidebarIdentity(
  user: {
    name?: string | null;
    role?: string | null;
    tehsils?: string[] | null;
  } | null | undefined,
  opts: { tehsilMgr: boolean; exec: boolean; userAdmin: boolean },
): { primary: string; secondary: string } {
  const name = user?.name?.trim() || "User";
  const scope = formatTehsilScope(user?.tehsils);

  if (opts.tehsilMgr) {
    const scopeKey = scope.replace(/\s/g, "").toUpperCase();
    const nameLooksLikeRole =
      /tehsil\s*manager/i.test(name) ||
      (scopeKey.length > 0 &&
        name.replace(/\s/g, "").toUpperCase().includes(scopeKey));

    if (nameLooksLikeRole && scope) {
      return { primary: scope, secondary: "Tehsil operator" };
    }
    return {
      primary: name,
      secondary: scope || "Tehsil operator",
    };
  }

  if (opts.exec) {
    return {
      primary: name,
      secondary: scope ? `HQ · ${scope}` : "Manager Operations",
    };
  }

  if (opts.userAdmin) {
    return { primary: name, secondary: "Platform admin" };
  }

  return { primary: name, secondary: roleDisplayLabel(user?.role) };
}

const MainLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [certificateAlertCount, setCertificateAlertCount] = useState(0);
  const [deleteRequestCount, setDeleteRequestCount] = useState(0);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const exec = user ? isExecutiveRole(user.role) : false;
  const tehsilMgr = user ? isTehsilManager(user.role) : false;
  const userAdmin = user ? isUserAdminRole(user.role) : false;
  const showOnboard = user ? canOnboardOperators(user.role) : false;

  const onDeleteRequestCountChange = useCallback((count: number) => {
    setDeleteRequestCount(count);
  }, []);

  const navSections: NavSection[] = useMemo(() => {
    const sections: NavSection[] = [];

    if (exec) {
      sections.push({
        title: "Overview",
        items: [
          {
            path: HQ_DASHBOARD,
            icon: <Radio className="size-4 shrink-0 opacity-90" />,
            label: "Command Center",
            end: true,
          },
        ],
      });
      sections.push({
        title: "Attention",
        emphasis: "alert",
        items: [
          {
            path: hqRoutes.attention,
            icon: <ShieldAlert className="size-4 shrink-0 opacity-90" />,
            label: "Attention needed",
          },
          {
            path: hqRoutes.deleteRequests,
            icon: <Trash2 className="size-4 shrink-0 opacity-90" />,
            label: "Delete requests",
            ...(deleteRequestCount > 0 ? { badge: deleteRequestCount } : {}),
          },
        ],
      });
      sections.push({
        title: "Monitoring",
        items: [
          {
            path: hqRoutes.sitesProgress,
            icon: <ListChecks className="size-4 shrink-0 opacity-90" />,
            label: "Sites Progress",
          },
        ],
      });
      sections.push({
        title: "Analysis",
        items: [
          {
            path: hqRoutes.waterAnalysis,
            icon: <Droplets className="size-4 shrink-0 opacity-90" />,
            label: "Water analysis",
          },
          {
            path: hqRoutes.solarAnalysis,
            icon: <Sun className="size-4 shrink-0 opacity-90" />,
            label: "Solar analysis",
          },
        ],
      });
    }

    if (userAdmin) {
      sections.push({
        title: "Administration",
        items: [
          {
            path: adminRoutes.users,
            icon: <Users className="size-4 shrink-0 opacity-90" />,
            label: "User accounts",
            end: true,
          },
        ],
      });
    }

    if (tehsilMgr) {
      sections.push({
        title: "Overview",
        items: [
          {
            path: tehsilRoutes.dashboard,
            icon: <LayoutDashboard className="size-4 shrink-0 opacity-90" />,
            label: "Dashboard",
            end: true,
          },
        ],
      });
      sections.push({
        title: "Water",
        items: [
          {
            path: tehsilRoutes.waterSystems,
            icon: <Droplets className="size-4 shrink-0 opacity-90" />,
            label: "Water systems",
          },
          {
            path: tehsilRoutes.calibrationCertificates,
            icon: <FileText className="size-4 shrink-0 opacity-90" />,
            label: "Calibration certificates",
            ...(certificateAlertCount > 0
              ? { badge: certificateAlertCount }
              : {}),
          },
          {
            path: tehsilRoutes.waterSubmissions,
            icon: <FileCheck className="size-4 shrink-0 opacity-90" />,
            label: "Submissions",
          },
          {
            path: tehsilRoutes.waterLoggingCompliance,
            icon: <CalendarClock className="size-4 shrink-0 opacity-90" />,
            label: "Logging compliance",
          },
          {
            path: tehsilRoutes.waterAlerts,
            icon: <AlertTriangle className="size-4 shrink-0 opacity-90" />,
            label: "Anomalies",
          },
        ],
      });
      sections.push({
        title: "Solar",
        items: [
          {
            path: tehsilRoutes.solarSites,
            icon: <Sun className="size-4 shrink-0 opacity-90" />,
            label: "Solar systems",
          },
          {
            path: tehsilRoutes.solarMonthlyLogging,
            icon: <ClipboardList className="size-4 shrink-0 opacity-90" />,
            label: "Monthly logging",
          },
          {
            path: tehsilRoutes.solarLoggingCompliance,
            icon: <CalendarClock className="size-4 shrink-0 opacity-90" />,
            label: "Logging compliance",
          },
        ],
      });
      sections.push({
        title: "Operators",
        items: [
          ...(showOnboard
            ? [
                {
                  path: tehsilRoutes.onboardOperator,
                  icon: <UserPlus className="size-4 shrink-0 opacity-90" />,
                  label: "Onboard operator",
                } satisfies NavItem,
              ]
            : []),
          {
            path: tehsilRoutes.operatorAssignments,
            icon: <Users className="size-4 shrink-0 opacity-90" />,
            label: "Assignments",
          },
        ],
      });
    }

    sections.push({
      title: "Help",
      items: [
        {
          path: trainingRoutes.hub,
          icon: <GraduationCap className="size-4 shrink-0 opacity-90" />,
          label: "Training Center",
        },
      ],
    });

    sections.push({
      title: "Account",
      items: [
        {
          path: accountRoutes.changePassword,
          icon: <KeyRound className="size-4 shrink-0 opacity-90" />,
          label: "Change password",
        },
      ],
    });

    return sections;
  }, [
    exec,
    tehsilMgr,
    userAdmin,
    showOnboard,
    certificateAlertCount,
    deleteRequestCount,
  ]);

  const identity = useMemo(
    () => sidebarIdentity(user, { tehsilMgr, exec, userAdmin }),
    [user, tehsilMgr, exec, userAdmin],
  );

  const userInitials = (identity.primary || user?.name || "User")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  useEffect(() => {
    if (!tehsilMgr) {
      setCertificateAlertCount(0);
      return;
    }

    let cancelled = false;

    const loadCertificateAlertCount = async () => {
      try {
        const rows =
          (await getActiveWaterSystemCalibrationCertificates()) as Array<{
            certificate?: { expiry_date?: string | null };
          }>;
        const list = Array.isArray(rows) ? rows : [];

        const count = list.filter((r) => {
          const raw = r?.certificate?.expiry_date;
          if (!raw) return false;
          const daysRemaining = pakistanCalendarDayDiff(
            String(raw).slice(0, 10),
          );
          return daysRemaining <= 7;
        }).length;

        if (!cancelled) setCertificateAlertCount(count);
      } catch {
        if (!cancelled) setCertificateAlertCount(0);
      }
    };

    void loadCertificateAlertCount();

    const timer = window.setInterval(() => {
      void loadCertificateAlertCount();
    }, 60_000);

    const onFocus = () => {
      if (document.visibilityState === "hidden") return;
      void loadCertificateAlertCount();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [tehsilMgr]);

  const renderSidebar = (collapsed: boolean) => (
    <>
      <div
        className={cn(
          "flex items-center border-b border-sidebar-border py-4",
          collapsed ? "justify-center px-2" : "gap-3 px-5",
        )}
      >
        <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar-accent p-1 ring-1 ring-sidebar-border/50">
          <img
            src={companyLogo}
            alt="MRV"
            className="h-full w-full object-contain"
          />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
              MRV System
            </h2>
            <p className="truncate text-[11px] text-sidebar-foreground/65">
              Monitoring & Verification
            </p>
          </div>
        ) : null}
      </div>

      <nav
        className={cn(
          "flex flex-1 flex-col overflow-y-auto py-3",
          collapsed ? "px-2" : "px-3",
        )}
      >
        {navSections.map((section, sectionIdx) => (
          <div
            key={section.title}
            className={cn(
              sectionIdx > 0 && (collapsed ? "mt-3" : "mt-5"),
              section.emphasis === "alert" &&
                (collapsed
                  ? "rounded-lg bg-rose-500/10 py-1"
                  : "rounded-lg border border-rose-400/25 bg-rose-500/10 px-1.5 py-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"),
            )}
          >
            {!collapsed ? (
              <p
                className={cn(
                  "mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider",
                  section.emphasis === "alert"
                    ? "text-rose-200/80"
                    : "text-sidebar-foreground/50",
                )}
              >
                {section.title}
              </p>
            ) : sectionIdx > 0 ? (
              <Separator className="mb-2 bg-sidebar-border/80" />
            ) : null}
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                if (!collapsed) {
                  return (
                    <NavLink
                      key={`${section.title}-${item.path}`}
                      to={item.path}
                      end={item.end ?? false}
                      className={({ isActive }) =>
                        navLinkClass(isActive, section.emphasis === "alert", false)
                      }
                    >
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                      {item.badge ? (
                        <Badge
                          variant="destructive"
                          className="ml-auto h-5 min-w-5 justify-center px-1 text-[10px]"
                        >
                          {item.badge}
                        </Badge>
                      ) : null}
                    </NavLink>
                  );
                }

                return (
                  <Tooltip key={`${section.title}-${item.path}`}>
                    <TooltipTrigger
                      render={
                        <NavLink
                          to={item.path}
                          end={item.end ?? false}
                          className={({ isActive }) =>
                            navLinkClass(
                              isActive,
                              section.emphasis === "alert",
                              true,
                            )
                          }
                        />
                      }
                    >
                      {item.icon}
                      {item.badge ? (
                        <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-destructive" />
                      ) : null}
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={10}>
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div
        className={cn(
          "border-t border-sidebar-border",
          collapsed ? "p-2" : "p-3",
        )}
      >
        {!collapsed ? (
          <div className="mb-2 flex items-center gap-2.5 rounded-md px-1 py-1">
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="bg-sidebar-primary text-[11px] font-semibold text-sidebar-primary-foreground">
                {userInitials || <UserIcon className="size-3.5" />}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight text-sidebar-foreground">
                {identity.primary}
              </p>
              <p className="truncate text-[11px] leading-tight text-sidebar-muted">
                {identity.secondary}
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-2 flex justify-center">
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="bg-sidebar-primary text-[11px] font-semibold text-sidebar-primary-foreground">
                {userInitials || <UserIcon className="size-3.5" />}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center rounded-md px-2 py-2 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  aria-label="Sign out"
                />
              }
            >
              <LogOut className="size-4 shrink-0" />
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              Sign out
            </TooltipContent>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-[13px] font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="size-4 shrink-0" />
            Sign out
          </button>
        )}
      </div>
    </>
  );

  return (
    <TooltipProvider>
      <PendingSiteDeleteRequestsPrompt
        enabled={exec}
        onCountChange={onDeleteRequestCountChange}
      />
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Desktop: expanded or icon rail */}
        <motion.aside
          initial={false}
          animate={{ width: isSidebarOpen ? SIDEBAR_EXPANDED : SIDEBAR_RAIL }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="relative hidden h-screen shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
        >
          {renderSidebar(!isSidebarOpen)}
        </motion.aside>

        {/* Mobile drawer */}
        {isSidebarOpen ? (
          <aside className="fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:hidden">
            {renderSidebar(false)}
          </aside>
        ) : null}
        {isSidebarOpen ? (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border/80 bg-background/80 px-4 backdrop-blur-md md:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarOpen((prev) => !prev)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={
                  isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"
                }
              >
                <span className="md:hidden">
                  {isSidebarOpen ? (
                    <X className="size-4" />
                  ) : (
                    <Menu className="size-4" />
                  )}
                </span>
                <PanelLeft className="hidden size-4 md:block" />
              </Button>

              <Separator
                orientation="vertical"
                className="hidden h-4 sm:block"
              />

              <AppBreadcrumbs
                sections={navSections}
                className="min-w-0 flex-1 overflow-hidden"
              />
            </div>

            <div className="flex shrink-0 items-center gap-2 rounded-lg border border-border/80 bg-card py-1 pr-3 pl-1 shadow-sm">
              <Avatar size="sm">
                <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                  {userInitials || <UserIcon className="size-3" />}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[160px] truncate text-sm font-medium text-foreground sm:inline">
                {identity.primary}
              </span>
            </div>
          </header>

          <main className="app-shell-bg flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-7xl">
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default MainLayout;
