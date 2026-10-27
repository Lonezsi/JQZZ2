import { api } from "./api";
import type { ImageVisibility, Quiz } from "../types";
import type {
  HistoryRecord,
  HistorySummary,
  LibraryImage,
  Profile,
  StashItem,
  StashKind,
  StashList,
} from "../types/stash";

/* Your stash and your games. Who you are travels in X-User-Id, like the image library. */

const as = (userId: string) => ({ headers: { "X-User-Id": userId } });

export const stashService = {
  list: (userId: string) => api.get<StashList>("/stash", as(userId)).then((r) => r.data),

  /** the whole quiz of a game you were in, or one question of it */
  fromGame: (userId: string, recordId: number, questionKey?: number) =>
    api.post<StashItem[]>("/stash/from-game", { recordId, questionKey }, as(userId)).then((r) => r.data),
  fromQuiz: (userId: string, quizId: number) =>
    api.post<StashItem[]>("/stash/from-quiz", { quizId }, as(userId)).then((r) => r.data),
  /** a copy of someone's public or semi-private item */
  fromRef: (userId: string, kind: StashKind, ref: string) =>
    api.post<StashItem>("/stash/from-ref", { kind, ref }, as(userId)).then((r) => r.data),

  update: (
    userId: string,
    id: number,
    patch: { handle?: string; visibility?: ImageVisibility; title?: string; payload?: string },
  ) => api.patch<StashItem>(`/stash/${id}`, patch, as(userId)).then((r) => r.data),

  /** full: your types thrown away, the defaults back. add: just the defaults you're missing. */
  resetTypes: (userId: string, mode: "full" | "add") =>
    api.post<StashItem[]>("/stash/types/reset", { mode }, as(userId)).then((r) => r.data),
  /** a question's shape as a new type, from a game or from a stashed question */
  asType: (
    userId: string,
    from: { recordId?: number; questionKey?: number; itemId?: number },
    title?: string,
  ) => api.post<StashItem>("/stash/as-type", { ...from, title }, as(userId)).then((r) => r.data),
  remove: (userId: string, id: number) => api.delete(`/stash/${id}`, as(userId)),

  /** public items anyone can copy in */
  browse: (kind: StashKind, q: string) =>
    api.get<StashItem[]>("/stash/public", { params: { kind, q } }).then((r) => r.data),

  /** a stashed quiz as a new quiz of yours */
  open: (userId: string, id: number) =>
    api.post<Quiz>(`/stash/${id}/open`, null, as(userId)).then((r) => r.data),

  imageVisibility: (userId: string, id: number, visibility: ImageVisibility) =>
    api.patch<LibraryImage>(`/images/${id}`, { visibility }, as(userId)).then((r) => r.data),
};

export const profileService = {
  get: (viewerId: string, userId: string) =>
    api.get<Profile>(`/profile/${encodeURIComponent(userId)}`, as(viewerId)).then((r) => r.data),
};

/** a link that copies an item into whoever opens it */
export const shareLink = (kind: StashKind, reference: string) =>
  `${window.location.origin}${window.location.pathname}#/stash/add/${kind.toLowerCase()}/${encodeURIComponent(reference)}`;

export const historyService = {
  list: (userId: string) => api.get<HistorySummary[]>("/history", as(userId)).then((r) => r.data),
  get: (userId: string, id: number) =>
    api.get<HistoryRecord>(`/history/${id}`, as(userId)).then((r) => r.data),
};

/** where the picture behind an image id can be loaded from */
export const imageUrl = (id: number, viewerId: string) =>
  `${api.defaults.baseURL}/images/${id}?userId=${encodeURIComponent(viewerId)}`;
