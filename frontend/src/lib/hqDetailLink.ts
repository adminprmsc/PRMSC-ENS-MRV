/** Props for React Router links that should open in a new browser tab. */
export const HQ_NEW_TAB_LINK_PROPS = {
  target: "_blank" as const,
  rel: "noopener noreferrer",
};

/** Append `?from=` so detail pages can navigate back after a new-tab open. */
export function withHqReturnPath(path: string, from?: string): string {
  const trimmed = from?.trim();
  if (!trimmed) return path;
  const params = new URLSearchParams({ from: trimmed });
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${params.toString()}`;
}

export function resolveHqReturnPath(
  locationState: unknown,
  searchParams: URLSearchParams,
  fallback: string,
): string {
  const fromState = (locationState as { from?: string } | null)?.from;
  if (typeof fromState === "string" && fromState.trim()) {
    return fromState.trim();
  }
  const fromQuery = searchParams.get("from");
  if (fromQuery?.trim()) return fromQuery.trim();
  return fallback;
}
