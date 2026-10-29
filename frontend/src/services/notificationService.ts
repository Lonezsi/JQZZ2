import { api } from "./api";
import type { FriendPerson } from "./friendService";

/* Notifications: friend requests, a friend saying yes, invites to games.
   Who you are travels in X-User-Id. */

export type NotificationKind = "FRIEND_REQUEST" | "FRIEND_ACCEPTED" | "INVITE";

export interface AppNotification {
  id: number;
  kind: NotificationKind | string;
  /** null once they've deleted themselves */
  from: FriendPerson | null;
  /** an invite: the game's code and quiz; rematch when it's the same quiz again */
  payload: { code?: string; quizName?: string; rematch?: boolean };
  createdAt: string | null;
  read: boolean;
}

const as = (userId: string) => ({ headers: { "X-User-Id": userId } });

export const notificationService = {
  list: (userId: string) => api.get<AppNotification[]>("/notifications", as(userId)).then((r) => r.data),
  read: (userId: string, id: number) =>
    api.post<AppNotification[]>(`/notifications/${id}/read`, null, as(userId)).then((r) => r.data),
  readAll: (userId: string) =>
    api.post<AppNotification[]>("/notifications/read-all", null, as(userId)).then((r) => r.data),
};
