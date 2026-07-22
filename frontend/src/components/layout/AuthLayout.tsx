import type { ReactNode } from "react";
import {
  Building2,
  ClipboardCheck,
  Droplets,
  ShieldCheck,
  Sun,
} from "lucide-react";

import companyLogo from "@/assets/company-logo.png";
import govtPunjabLogo from "@/assets/govt-punjab-logo.png";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AuthLayoutProps = {
  children: ReactNode;
  className?: string;
};

const FEATURES = [
  {
    icon: Droplets,
    title: "Water infrastructure",
    description: "Tube wells, bulk meters, and daily compliance logging.",
  },
  {
    icon: Sun,
    title: "Solar generation",
    description: "Monthly export, import, and net generation tracking.",
  },
  {
    icon: Building2,
    title: "Tehsil operations",
    description: "Operators, submissions, and verification workflows.",
  },
] as const;

const CAPABILITIES = [
  { icon: Droplets, label: "Water systems" },
  { icon: Sun, label: "Solar energy" },
  { icon: ClipboardCheck, label: "MRV verification" },
] as const;

export function AuthLayout({ children, className }: AuthLayoutProps) {
  return (
    <div className={cn("flex min-h-screen bg-background", className)}>
      {/* Left — enterprise branding */}
      <div className="relative hidden w-[44%] shrink-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0a2e55] via-[#0d3a6b] to-[#08243f] lg:flex xl:w-[46%]">
        <div
          aria-hidden
          className="enterprise-grid-bg pointer-events-none absolute inset-0 opacity-50"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-16 -left-16 size-56 rounded-full bg-white/5 blur-2xl"
        />

        <div className="relative z-10 flex flex-col gap-8 p-10 xl:p-12">
          <div className="flex items-center gap-4">
            <div className="flex shrink-0 items-center gap-3 rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
              <img
                src={companyLogo}
                alt="PRMSC"
                className="size-11 object-contain"
              />
              <div className="h-9 w-px bg-white/20" aria-hidden />
              <img
                src={govtPunjabLogo}
                alt="Government of Punjab"
                className="size-10 object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight text-white">
                PRMSC
              </p>
              <p className="text-[11px] leading-tight text-sidebar-muted">
                Govt. of Punjab
              </p>
            </div>
          </div>

          <Badge
            variant="outline"
            className="w-fit gap-1.5 border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white hover:bg-white/10"
          >
            <ShieldCheck className="size-3.5" />
            Enterprise portal
          </Badge>

          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-white xl:text-4xl">
              MRV System
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-sidebar-muted">
              Punjab Rural Municipal Services Company — monitoring, reporting,
              and verification for water and solar infrastructure across
              tehsils.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {CAPABILITIES.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white/90"
              >
                <Icon className="size-3" />
                {label}
              </span>
            ))}
          </div>

          <div className="space-y-2.5">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm transition-colors hover:bg-white/[0.07]"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
                  <Icon className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-sidebar-muted">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 border-t border-white/10 px-10 py-5 xl:px-12">
          <p className="text-[11px] text-sidebar-muted">
            © {new Date().getFullYear()} Punjab Rural Municipal Services
            Company
          </p>
        </div>
      </div>

      {/* Right — credentials */}
      <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-12 sm:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--muted)_0%,transparent_55%)]"
        />

        <div className="relative w-full max-w-[400px]">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <div className="flex size-10 items-center justify-center rounded-lg border border-border/60 bg-card shadow-sm">
              <img
                src={companyLogo}
                alt="PRMSC"
                className="size-7 object-contain"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                MRV System
              </p>
              <p className="truncate text-xs text-muted-foreground">
                PRMSC secure portal
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/95 p-8 shadow-[0_8px_30px_rgb(15_23_42/0.06)] backdrop-blur-sm sm:p-9">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthBrandingPanel() {
  return null;
}

export function AuthMobileBrand() {
  return null;
}
