import { api } from "./api";
import type { CreateQuizRequest } from "../types";

/** the unlocked panel's token: this tab only, gone when it closes */
export const ADMIN_TOKEN = "jqzz-admin-token";

export function adminToken(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN);
  } catch {
    return null;
  }
}

function setToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(ADMIN_TOKEN, token);
    else sessionStorage.removeItem(ADMIN_TOKEN);
  } catch {
    // private window: it lasts until the page does
  }
}

const auth = () => ({ headers: { "X-Admin-Token": adminToken() ?? "" } });

export interface AdminOverview {
  users: number;
  online: number;
  quizzes: number;
  games: number;
  liveGames: number;
  records: number;
  images: number;
  stash: number;
}

export interface AdminUser {
  id: string;
  handle: string;
  name: string;
  email: string | null;
  profilePictureUrl: string | null;
  online: boolean;
  googleLinked: boolean;
  hasKey: boolean;
  quizzes: number;
}

export interface AdminQuiz {
  id: number;
  name: string;
  authorId: string | null;
  authorName: string | null;
  questions: number;
}

export interface AdminGame {
  code: string;
  quizName: string;
  hostId: string;
  hostName: string | null;
  status: "LOBBY" | "PLAYING" | "PAUSED" | "FINISHED";
  touchedAt: number;
  players: { id: string; name: string }[];
}

export interface AdminRecord {
  id: number;
  code: string;
  quizName: string;
  hostName: string | null;
  finishedAt: string | null;
  players: { name: string; score: number; ranking: number }[];
}

export type Visibility = "PUBLIC" | "PRIVATE" | "SEMI_PRIVATE";

export interface AdminImage {
  id: number;
  handle: string;
  visibility: Visibility;
  uploadedBy: string | null;
  mimeType: string;
  size: number;
  createdAt: string | null;
}

export interface AdminStashItem {
  id: number;
  kind: string;
  handle: string;
  title: string | null;
  visibility: Visibility;
  savedBy: string | null;
  createdAt: string | null;
}

export const adminService = {
  /** 404 for anyone but the admin account */
  question: () => api.get<{ question: string }>("/admin/question").then((r) => r.data.question),
  unlock: (answer: string) =>
    api.post<{ token: string }>("/admin/unlock", { answer }).then((r) => setToken(r.data.token)),
  lock: () =>
    api
      .post("/admin/lock", null, auth())
      .catch(() => {})
      .finally(() => setToken(null)),
  forget: () => setToken(null),

  overview: () => api.get<AdminOverview>("/admin/overview", auth()).then((r) => r.data),

  users: () => api.get<AdminUser[]>("/admin/users", auth()).then((r) => r.data),
  editUser: (id: string, change: Partial<Pick<AdminUser, "name" | "handle" | "email">>) =>
    api.patch(`/admin/users/${encodeURIComponent(id)}`, change, auth()),
  newKey: (id: string) =>
    api.post<{ loginKey: string }>(`/admin/users/${encodeURIComponent(id)}/key`, null, auth()).then((r) => r.data.loginKey),
  deleteUser: (id: string) => api.delete(`/admin/users/${encodeURIComponent(id)}`, auth()),

  quizzes: () => api.get<AdminQuiz[]>("/admin/quizzes", auth()).then((r) => r.data),
  putQuiz: (id: number, quiz: CreateQuizRequest) => api.put(`/admin/quizzes/${id}`, quiz, auth()),
  editQuiz: (id: number, change: { name?: string; authorId?: string }) => api.patch(`/admin/quizzes/${id}`, change, auth()),
  deleteQuiz: (id: number) => api.delete(`/admin/quizzes/${id}`, auth()),

  games: () => api.get<AdminGame[]>("/admin/games", auth()).then((r) => r.data),
  control: (code: string, action: string, playerId?: string) =>
    api.post(`/admin/games/${code}/${action}`, null, { ...auth(), params: playerId ? { playerId } : undefined }),

  history: () => api.get<AdminRecord[]>("/admin/history", auth()).then((r) => r.data),
  deleteRecord: (id: number) => api.delete(`/admin/history/${id}`, auth()),

  images: () => api.get<AdminImage[]>("/admin/images", auth()).then((r) => r.data),
  /** the picture as an object URL: an img tag can't send the token */
  imageUrl: (id: number) =>
    api.get<Blob>(`/admin/images/${id}`, { ...auth(), responseType: "blob" }).then((r) => URL.createObjectURL(r.data)),
  imageVisibility: (id: number, visibility: Visibility) => api.patch(`/admin/images/${id}`, { visibility }, auth()),
  deleteImage: (id: number) => api.delete(`/admin/images/${id}`, auth()),

  stash: () => api.get<AdminStashItem[]>("/admin/stash", auth()).then((r) => r.data),
  deleteStash: (id: number) => api.delete(`/admin/stash/${id}`, auth()),

  announce: (text: string) => api.post<{ sent: number }>("/admin/announce", { text }, auth()).then((r) => r.data.sent),
};
