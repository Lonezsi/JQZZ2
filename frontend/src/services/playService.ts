import { api, API_BASE_URL } from "./api";
import type { GameState, GameTask, MyGame } from "../types/play";

/* Hosting and playing. Every call answers with the game's whole state. */

/** an answer, in whichever shape its question takes */
export interface Submission {
  picks?: number[];
  text?: string;
  tiers?: Record<number, string>;
  pairs?: Record<number, string>;
}

/** a drawing from a game in progress, or one kept with a game's history */
export const artUrl = (code: string, id: string) => `${API_BASE_URL}/play/${code}/art/${id}`;
export const keptArtUrl = (recordId: number, id: string) => `${API_BASE_URL}/history/${recordId}/drawing/${id}`;

const post = (path: string, body: object) => api.post<GameState>(path, body).then((r) => r.data);

export const playService = {
  host: (quizId: number, userId: string) => post("/play/host", { quizId, userId }),
  /** play it alone: hosted, joined and started in one go */
  practice: (userId: string, from: { quizId?: number; stashId?: number }) =>
    post("/play/practice", { userId, ...from }),
  /** the same quiz as a finished game, everyone from it invited */
  rematch: (userId: string, recordId: number) => post("/play/rematch", { userId, recordId }),
  /** how many games are under way right now, anyone's */
  live: () => api.get<{ live: number }>("/play/live").then((r) => r.data.live),
  state: (code: string) => api.get<GameState>(`/play/${code}`).then((r) => r.data),
  /** games you host or play that haven't finished */
  mine: (userId: string) => api.get<MyGame[]>("/play/mine", { params: { userId } }).then((r) => r.data),
  join: (code: string, userId: string) => post(`/play/${code}/join`, { userId }),
  leave: (code: string, userId: string) => post(`/play/${code}/leave`, { userId }),

  start: (code: string, userId: string) => post(`/play/${code}/start`, { userId }),
  pause: (code: string, userId: string) => post(`/play/${code}/pause`, { userId }),
  resume: (code: string, userId: string) => post(`/play/${code}/resume`, { userId }),
  skip: (code: string, userId: string) => post(`/play/${code}/skip`, { userId }),
  end: (code: string, userId: string) => post(`/play/${code}/end`, { userId }),
  restart: (code: string, userId: string) => post(`/play/${code}/restart`, { userId }),
  kick: (code: string, userId: string, playerId: string) =>
    post(`/play/${code}/kick`, { userId, playerId }),
  /** host only: playerId gets a notification, online or not */
  invite: (code: string, userId: string, playerId: string) =>
    api.post<{ invited: string }>(`/play/${code}/invite`, { userId, playerId }).then((r) => r.data),

  /** done with this step: nudge the host to move on */
  hurry: (code: string, userId: string) => post(`/play/${code}/hurry`, { userId }),

  submit: (code: string, userId: string, answer: Submission) => post(`/play/${code}/submit`, { userId, ...answer }),
  /** a drawing, sent as the picture file itself; who drew it goes in a header, not the address */
  draw: (code: string, userId: string, picture: Blob) =>
    api
      .post<GameState & { drawing: string }>(`/play/${code}/draw`, picture, {
        headers: { "Content-Type": picture.type || "image/png", "X-User-Id": userId },
      })
      .then((r) => r.data),
  /** what only you see right now: your secret word, what you're handed */
  task: (code: string, userId: string) =>
    api.get<GameTask>(`/play/${code}/task`, { headers: { "X-User-Id": userId } }).then((r) => r.data),
  vote: (
    code: string,
    userId: string,
    vote: { choice?: string; match?: number; guesses?: Record<string, string> },
  ) => post(`/play/${code}/vote`, { userId, ...vote }),
};
