/**
 * Short two-tone notification chime, synthesised with Web Audio (no asset to
 * load). Browsers block audio until the user has interacted with the page, so
 * the context is created/resumed on the first pointer or key event; before
 * that, `playNotificationChime` quietly does nothing.
 */

type AudioCtx = typeof AudioContext;

let ctx: AudioContext | null = null;
let unlocked = false;
/** A chime requested before audio was unlocked (played on first gesture). */
let pendingSince = 0;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor: AudioCtx | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioCtx }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Call once at app start: unlocks audio on the first user gesture. */
export function installAudioUnlock() {
  if (unlocked || typeof window === "undefined") return;
  const unlock = () => {
    const c = getCtx();
    void c?.resume().then(() => {
      unlocked = true;
      // Play a chime that was blocked at page load, if it's still recent.
      if (pendingSince && Date.now() - pendingSince < 60_000) {
        pendingSince = 0;
        playNotificationChime();
      }
    });
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

let lastPlayed = 0;

/** Soft two-note chime (E5 → A5). Throttled to once every 2 s. */
export function playNotificationChime(volume = 0.18): boolean {
  const now = Date.now();
  if (now - lastPlayed < 2000) return false;
  const c = getCtx();
  if (!c || c.state !== "running") {
    pendingSince = now;
    return false;
  }
  lastPlayed = now;
  const t0 = c.currentTime;
  const notes: Array<[number, number]> = [
    [659.25, 0],
    [880, 0.13],
  ];
  for (const [freq, offset] of notes) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = t0 + offset;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.5);
  }
  return true;
}

/**
 * For explicit user actions (Test sound, unmute): resume audio inside the
 * gesture, then play. Resolves false only if the browser has no audio.
 */
export async function playChimeFromGesture(): Promise<boolean> {
  const c = getCtx();
  if (!c) return false;
  try {
    if (c.state !== "running") await c.resume();
  } catch {
    return false;
  }
  unlocked = true;
  pendingSince = 0;
  lastPlayed = 0;
  return playNotificationChime();
}
