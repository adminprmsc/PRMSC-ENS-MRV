import api from "@/api/api";

export type ReleaseNoteItem = {
  id: string;
  version: string;
  date: string;
  title: string;
  category: "feature" | "enhancement" | "fix";
  summary: string;
  highlights: string[];
  training: Array<{ title: string; steps: string[] }>;
  numbers_change: string[];
  link: { label: string; path: string } | null;
  /** Inside its announcement window (≈30 days from go-live). */
  announced: boolean;
  announce_until: string;
  read_at: string | null;
  dismissed_at: string | null;
};

export async function getReleaseNotes() {
  const res = await api.get("/releases");
  return res.data as { items: ReleaseNoteItem[]; unread: number };
}

export async function getReleaseAnnouncements() {
  const res = await api.get("/releases/announcements");
  return res.data as { items: ReleaseNoteItem[] };
}

export async function markReleaseRead(id: string) {
  await api.post(`/releases/${encodeURIComponent(id)}/read`);
}

export async function dismissRelease(id: string) {
  await api.post(`/releases/${encodeURIComponent(id)}/dismiss`);
}

export const RELEASE_QUERY_KEYS = {
  list: ["releaseNotes"] as const,
  announcements: ["releaseAnnouncements"] as const,
};
