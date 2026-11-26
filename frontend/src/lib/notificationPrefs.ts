import { useCallback, useEffect, useState } from "react";

/**
 * Per-user, per-device notification preferences (sound is a device choice —
 * muting the office PC shouldn't mute a phone). Stored in localStorage;
 * every read/write is guarded so private mode or blocked storage just falls
 * back to defaults.
 */
export type NotificationPrefs = {
  /** Play a chime when new notifications arrive. */
  sound: boolean;
  /** Show pop-up toasts for new notifications. */
  popups: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  sound: true,
  popups: true,
};

const EVENT = "prmsc:notification-prefs";
const key = (userId: string) => `prmsc.notificationPrefs.${userId}`;

export function readNotificationPrefs(userId: string | undefined): NotificationPrefs {
  if (!userId) return DEFAULT_NOTIFICATION_PREFS;
  try {
    const raw = window.localStorage.getItem(key(userId));
    if (!raw) return DEFAULT_NOTIFICATION_PREFS;
    const p = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      sound: typeof p.sound === "boolean" ? p.sound : DEFAULT_NOTIFICATION_PREFS.sound,
      popups: typeof p.popups === "boolean" ? p.popups : DEFAULT_NOTIFICATION_PREFS.popups,
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

export function writeNotificationPrefs(userId: string, prefs: NotificationPrefs) {
  try {
    window.localStorage.setItem(key(userId), JSON.stringify(prefs));
  } catch {
    /* storage blocked — preference lasts for this page only */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { userId, prefs } }));
}

/** Live preferences; updates across components and browser tabs. */
export function useNotificationPrefs(userId: string | undefined) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(() =>
    readNotificationPrefs(userId),
  );

  useEffect(() => {
    setPrefs(readNotificationPrefs(userId));
    if (!userId) return;
    const onLocal = (e: Event) => {
      const d = (e as CustomEvent<{ userId: string; prefs: NotificationPrefs }>).detail;
      if (d?.userId === userId) setPrefs(d.prefs);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === key(userId)) setPrefs(readNotificationPrefs(userId));
    };
    window.addEventListener(EVENT, onLocal);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onLocal);
      window.removeEventListener("storage", onStorage);
    };
  }, [userId]);

  const update = useCallback(
    (patch: Partial<NotificationPrefs>) => {
      if (!userId) return;
      const next = { ...readNotificationPrefs(userId), ...patch };
      setPrefs(next);
      writeNotificationPrefs(userId, next);
    },
    [userId],
  );

  return { prefs, update };
}

/** Last time this user was alerted on this device (ms) — avoids re-chiming. */
export function lastAlertedAt(userId: string): number {
  try {
    return Number(window.localStorage.getItem(`prmsc.lastAlertedAt.${userId}`) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function setLastAlertedAt(userId: string, ms: number) {
  try {
    window.localStorage.setItem(`prmsc.lastAlertedAt.${userId}`, String(ms));
  } catch {
    /* ignore */
  }
}
