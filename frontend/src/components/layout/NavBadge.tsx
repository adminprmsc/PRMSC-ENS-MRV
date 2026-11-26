import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

export type NavBadgeTone = "alert" | "info";

const TONE: Record<NavBadgeTone, string> = {
  alert: "bg-rose-500 text-white ring-rose-300/40",
  info: "bg-sky-500 text-white ring-sky-300/40",
};

/** High-contrast sidebar count badge; pops when the number changes. */
export function NavBadge({
  count,
  tone = "alert",
  className,
}: {
  count: number;
  tone?: NavBadgeTone;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      key={count}
      initial={reduce ? false : { scale: 0.3, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 560, damping: 15 }}
      className={cn(
        "ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none tabular-nums shadow-sm ring-2",
        TONE[tone],
        className,
      )}
      aria-label={`${count} new`}
    >
      {count > 99 ? "99+" : count}
    </motion.span>
  );
}

/** Dot for the collapsed (icon-only) sidebar rail. */
export function NavBadgeDot({ tone = "alert" }: { tone?: NavBadgeTone }) {
  const color = tone === "info" ? "bg-sky-400" : "bg-rose-500";
  return (
    <span className="absolute top-1 right-1 flex size-2.5">
      <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", color)} />
      <span className={cn("relative inline-flex size-2.5 rounded-full ring-2 ring-sidebar", color)} />
    </span>
  );
}
