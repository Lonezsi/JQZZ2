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
  /** the other half of a pair (MATCH), once revealed */
  match?: string;
}

export interface GameQuestion {
  id: number;
  /** points it gives in percent, when not 100: 0 is unscored, 200 double */
  weight?: number;
  text: string;
  imageUrl?: string | null;
  type: string;
  answers: GameAnswer[];
  elaborationText?: string | null;
  elaborationImageUrl?: string | null;
  /** what players do and how it scores (docs/script.md); older servers only send type */
  ask?: string;
  score?: string;
  /** answering sooner scores more */
  speed?: boolean;
  /** NUMBER: what it's counted in, and the ends of the slider */
  unit?: string;
  min?: number;
  max?: number;
  /** MATCH: the other halves, shuffled, under keys that don't give the pairs away */
  halves?: { key: string; text: string }[];
}

/** something a player made: written (text) or drawn (image, an art id); anonymous until the voting on it is over */
export interface GameEntry {
  key: string;
  text?: string;
  image?: string;
  authorId?: string;
  votes?: number;
  /** DRAW_GUESS, once settled: the secret word, and what everyone guessed */
  word?: string | null;
  guesses?: { userId: string; text: string; right: boolean }[];
}

export interface GameSide {
  key: string;
  text?: string;
  image?: string;
}

export interface GameMatch {
  id: number;
  a: GameSide;
  b: GameSide | null;
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
  champion?: GameSide & { authorId: string };
}

/** one telephone chain: what its starter wrote, and everything handed on from it */
export interface GameChain {
  starter: string;
  links: { authorId: string; text?: string; image?: string }[];
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
  /** TYPED: what was typed, alike answers together */
  typed?: { text: string; count: number; right: boolean }[];
  /** ORDER: the right order, and how many put each one in its place */
  order?: number[];
  placedRight?: Record<string, number>;
  /** MATCH: how many paired each one right */
  pairedRight?: Record<string, number>;
  /** NUMBER: the right number, everyone's guess, who came closest */
  right?: number | null;
  /** NUMBER scored by the crowd: right is the room's average */
  average?: boolean;
  numbers?: Record<string, number>;
  closest?: string[];
  /** TELEPHONE */
  prompt?: string;
  chains?: GameChain[];
}

/** a telephone question while it's handed round */
export interface GameTelephone {
  round: number;
  rounds: number;
  kind: "write" | "draw" | "describe";
  roundEndsAt: number | null;
  /** how long this turn gets */
  roundSeconds: number;
  players: string[];
}

/** what only you see now: your secret word, what you're handed */
export interface GameTask {
  question?: number;
  kind?: "draw" | "write" | "describe" | "watch";
  word?: string | null;
  drawing?: string | null;
  round?: number;
  rounds?: number;
  handed?: { text?: string; image?: string };
  mine?: { text?: string; image?: string };
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
  /** the host has the game's screen open */
  hostHere?: boolean;
  /** paused by the game itself because the host's screen went away */
  pausedForHost?: boolean;
  /** players done with this step who nudged the host to move on */
  hurry?: string[];
  /** a telephone question being handed round */
  telephone?: GameTelephone;
}

/** a game you're in that hasn't finished, as /play/mine lists it */
export interface MyGame {
  code: string;
  quizName: string;
  status: GameStatus;
  role: "host" | "player";
}

export const TIERS = ["S", "A", "B", "C", "D"] as const;
