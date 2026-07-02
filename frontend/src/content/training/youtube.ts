/** Extract an 11-character YouTube video id from common URL formats. */
export function youtubeVideoId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

export function youtubeEmbedUrl(url: string): string | null {
  const id = youtubeVideoId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

/** Direct file URL (e.g. Supabase storage) — not a YouTube link. */
export function isDirectVideoFileUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  return youtubeVideoId(trimmed) === null;
}

export function isValidTrainingVideoUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  return youtubeEmbedUrl(trimmed) !== null || isDirectVideoFileUrl(trimmed);
}
