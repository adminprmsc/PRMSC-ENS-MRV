import api from "../api/api";

export const NOTIFICATION_TYPE_ENTRY_CHANGE = "entry_change";

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  is_read: boolean | null;
  submission_id: string | null;
  /** e.g. "entry_change"; null for general notices */
  type: string | null;
  /** Record the notice points at — for entry_change, the change-log row id */
  entity_id: string | null;
  created_at: string | null;
};

export type NotificationsResponse = {
  notifications: AppNotification[];
  unread_count: number;
};

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

export const fetchNotifications = async (): Promise<NotificationsResponse> => {
  const response = await api.get("/operator/notifications");
  const data = (response.data ?? {}) as Partial<NotificationsResponse>;
  return {
    notifications: Array.isArray(data.notifications) ? data.notifications : [],
    unread_count: Number(data.unread_count ?? 0) || 0,
  };
};

/** Mark specific notifications read (max 100 per call). */
export const markNotificationsRead = async (ids: string[]) => {
  if (!ids.length) return { updated: 0 };
  const response = await api.post("/operator/notifications/read-batch", {
    ids: ids.slice(0, 100),
  });
  return response.data as { updated: number };
};

/** Mark all unread notifications read, optionally only one type. */
export const markAllNotificationsReadOfType = async (type?: string) => {
  const qs = type ? `?type=${encodeURIComponent(type)}` : "";
  const response = await api.post(`/operator/notifications/read-all${qs}`);
  return response.data as { updated: number };
};
