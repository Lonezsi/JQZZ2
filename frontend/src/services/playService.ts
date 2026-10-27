import { api } from "./api";
import type { GameState, MyGame } from "../types/play";

/* Hosting and playing. Every call answers with the game's whole state. */

const post = (path: string, body: object) => api.post<GameState>(path, body).then((r) => r.data);

export const playService = {
  host: (quizId: number, userId: string) => post("/play/host", { quizId, userId }),
  /** play it alone: hosted, joined and started in one go */
  practice: (userId: string, from: { quizId?: number; stashId?: number }) =>
    post("/play/practice", { userId, ...from }),
  /** the same quiz as a finished game, everyone from it invited */
  rematch: (userId: string, recordId: number) => post("/play/rematch", { userId, recordId }),
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

  submit: (
    code: string,
    userId: string,
    answer: { picks?: number[]; text?: string; tiers?: Record<number, string> },
  ) => post(`/play/${code}/submit`, { userId, ...answer }),
  vote: (
    code: string,
    userId: string,
    vote: { choice?: string; match?: number; guesses?: Record<string, string> },
  ) => post(`/play/${code}/vote`, { userId, ...vote }),
};
