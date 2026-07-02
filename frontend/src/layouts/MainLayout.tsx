import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  ClipboardList,
  Droplets,
  FileCheck,
  FileText,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Sun,
  Table2,
  UserPlus,
  Users,
  User as UserIcon,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { HQ_DASHBOARD, adminRoutes, hqRoutes, tehsilRoutes } from "../constants/routes";
import { accountRoutes } from "../constants/routes";
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
};

const navLinkClass = (isActive: boolean) =>
  cn(
    "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
    isActive
      ? "bg-sidebar-active text-white"
      : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground",
  );

const MainLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [certificateAlertCount, setCertificateAlertCount] = useState(0);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const exec = user ? isExecutiveRole(user.role) : false;
  const tehsilMgr = user ? isTehsilManager(user.role) : false;
  const userAdmin = user ? isUserAdminRole(user.role) : false;
  const showOnboard = user ? canOnboardOperators(user.role) : false;

  const navSections: NavSection[] = useMemo(() => {
    const sections: NavSection[] = [];

    if (exec) {
      sections.push({
        title: "Overview",
        items: [
          {
            path: HQ_DASHBOARD,
            icon: <BarChart3 className="size-4 shrink-0 opacity-90" />,
            label: "Organization KPI",
            end: true,
          },
        ],
      });
      sections.push({
        title: "Water",
        items: [
          {
            path: hqRoutes.waterAnalysis,
            icon: <Table2 className="size-4 shrink-0 opacity-90" />,
            label: "Water analysis",
          },
        ],
      });
      sections.push({
        title: "Solar",
        items: [
          {
            path: hqRoutes.solarAnalysis,
            icon: <Table2 className="size-4 shrink-0 opacity-90" />,
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
  }, [exec, tehsilMgr, userAdmin, showOnboard, certificateAlertCount]);

  const roleLabel = roleDisplayLabel(user?.role);
  const roleTitle = tehsilMgr ? "Tehsil Manager Operator" : roleLabel;
  const primaryTehsil = user?.tehsils?.[0] ?? "";
  const tehsilLabel = primaryTehsil ? primaryTehsil.toUpperCase() : "";
  const userInitials = (user?.name ?? "User")
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

  const sidebarContent = (
    <>
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
        <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1">
          <img
            src={companyLogo}
            alt="MRV"
            className="h-full w-full object-contain"
          />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-tight text-white">
            MRV System
          </h2>
          <p className="truncate text-[11px] text-sidebar-muted">
            Monitoring & Verification
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-3">
        {navSections.map((section, sectionIdx) => (
          <div
            key={section.title}
            className={cn(sectionIdx > 0 && "mt-5")}
          >
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted/80">
              {section.title}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={`${section.title}-${item.path}`}
                  to={item.path}
                  end={item.end ?? false}
                  className={({ isActive }) => navLinkClass(isActive)}
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
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="mb-3 rounded-lg border border-sidebar-border bg-sidebar-accent/60 px-3 py-2.5">
          <p className="truncate text-sm font-medium text-white">
            {user?.name ?? "User"}
          </p>
          <p className="truncate text-xs text-sidebar-muted">
            {roleTitle}
            {tehsilLabel ? ` · ${tehsilLabel}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="size-4 shrink-0" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-muted/40">
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 272, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="relative hidden h-screen shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex"
          >
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      {isSidebarOpen ? (
        <aside className="fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:hidden">
          {sidebarContent}
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
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border/80 bg-card px-4 md:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className="text-muted-foreground hover:text-foreground"
          >
            {isSidebarOpen ? (
              <X className="size-4" />
            ) : (
              <Menu className="size-4" />
            )}
          </Button>

          <div className="flex items-center gap-2 rounded-full border border-border bg-muted/40 py-1 pr-3 pl-1">
            <Avatar size="sm">
              <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                {userInitials || <UserIcon className="size-3" />}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[160px] truncate text-sm font-medium text-foreground sm:inline">
              {user?.name ?? "User"}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-muted/30 p-5 md:p-8">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
