import type { Phase } from "./index";

/* What /play sends back, and /topic/play/{code} pushes on every change. */

export type GameStatus = "LOBBY" | "PLAYING" | "PAUSED" | "FINISHED";
export type Interaction = "answer" | "vote" | "guess" | "bracket" | null;

export interface GamePlayer {
  id: string;
  name: string;
  picture?: string | null;
  score: number;
  /** points from the last question that was scored */
  gain: number;
  rank: number;
  online: boolean;
}

export interface GameAnswer {
  id: number;
  text: string;
  imageUrl?: string | null;
  /** only once the question is revealed */
  value?: number;
}

export interface GameQuestion {
  id: number;
  text: string;
  imageUrl?: string | null;
  type: string;
  answers: GameAnswer[];
  elaborationText?: string | null;
  elaborationImageUrl?: string | null;
}

/** a written answer, anonymous until the voting on it is over */
export interface GameEntry {
  key: string;
  text: string;
  authorId?: string;
  votes?: number;
}

export interface GameMatch {
  id: number;
  a: { key: string; text: string };
  b: { key: string; text: string } | null;
  votesA?: number;
  votesB?: number;
  winner?: string | null;
  authorA?: string;
  authorB?: string | null;
}

export interface GameBracket {
  round: number;
  rounds: number;
  roundEndsAt: number | null;
  done: boolean;
  matches: GameMatch[];
  history: GameMatch[][];
  champion?: { key: string; text: string; authorId: string };
}

export interface GameReveal {
  settled: boolean;
  counts?: Record<string, number>;
  correct?: number[];
  tierCounts?: Record<string, Record<string, number>>;
  consensus?: Record<string, string>;
  entries?: GameEntry[];
  authors?: string[];
  bracket?: GameBracket;
  gains?: Record<string, number>;
}

export interface GameState {
  code: string;
  hostId: string;
  quizName: string;
  /** whose quiz it is: picture references like ":handle" are theirs */
  authorId?: string;
  /** once it's finished: the game's entry in everyone's history */
  recordId?: number | null;
  status: GameStatus;
  version: number;
  /** server clock when this was sent */
  now: number;
  index: number;
  total: number;
  questionCount: number;
  phase?: Phase;
  seconds?: number;
  endsAt?: number | null;
  pausedLeft?: number | null;
  questionNumber?: number;
  question?: GameQuestion;
  answered?: string[];
  acted?: string[];
  reveal?: GameReveal;
  interaction: Interaction;
  players: GamePlayer[];
}

export const TIERS = ["S", "A", "B", "C", "D"] as const;
