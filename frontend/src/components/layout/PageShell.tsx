import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageShellProps = {
  children: ReactNode;
  className?: string;
  /** Constrain inner content width when a page needs a narrower column. */
  narrow?: boolean;
};

export function PageShell({ children, className, narrow }: PageShellProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col space-y-6",
        narrow && "mx-auto max-w-2xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
