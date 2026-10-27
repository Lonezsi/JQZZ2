import type { ImageVisibility, Phase } from "./index";

/* The stash and the game history: what /stash and /history send back. */

export type StashKind = "QUIZ" | "QUESTION" | "IMAGE" | "TYPE";

/** A question's shape without its words: what a TYPE item holds, and what the add tray offers. */
export interface TypeShape {
  name: string;
  questionType: string;
  answers: { text: string; value: number }[];
  steps: { phase: Phase; time: number; preview: string | null }[];
}

/** Named and shared like images: "handle" when public, "owner:handle" otherwise. */
export interface StashItem {
  id: number;
  kind: StashKind;
  handle: string;
  /** null when public */
  ownerId: string | null;
  visibility: ImageVisibility;
  savedBy: string;
  title: string | null;
  /** where it came from: the quiz it was played in, or the reference it was copied from */
  source: string | null;
  /** QUIZ and QUESTION: a StashContent as JSON */
  payload: string | null;
  /** IMAGE: the picture in the image library */
  imageId: number | null;
  createdAt: string;
  reference: string;
}

export interface StashedQuestion {
  key: number;
  text: string;
  type: string;
  imageUrl?: string | null;
  elaborationText?: string | null;
  elaborationImageUrl?: string | null;
  answers: { text: string; value: number; imageUrl?: string | null }[];
}

/** A quiz, or a single question with its own steps; picture refs are absolute. */
export interface StashContent {
  name?: string;
  questions: StashedQuestion[];
  steps: { phase: Phase; time: number; preview: string | null; question: number | null }[];
  /** history only: what happened on each question, by its key */
  results?: Record<string, QuestionResult>;
}

export interface QuestionResult {
  /** choice questions: how many picked each answer, by position */
  counts?: number[];
  /** tier lists: the group's tier for each answer, by position */
  tiers?: (string | null)[];
  /** written answers, with who wrote them once it was over */
  entries?: { text: string; by: string; votes: number }[];
  champion?: { text: string; by: string };
  /** points each player got, by user id */
  gains?: Record<string, number>;
}

/** An image you uploaded, as /images/mine lists it. */
export interface LibraryImage {
  id: number;
  handle: string;
  ownerId: string | null;
  visibility: ImageVisibility;
  mimeType: string;
  createdAt: string;
  uploadedBy?: string | null;
  reference: string;
}

export interface StashList {
  items: StashItem[];
  images: LibraryImage[];
}

export interface HistoryPlayer {
  userId: string;
  name: string;
  score: number;
  ranking: number;
}

export interface HistorySummary {
  id: number;
  code: string;
  quizId: number | null;
  quizName: string;
  finishedAt: string;
  hosted: boolean;
  playerCount: number;
  /** your result, when you played rather than hosted */
  you: HistoryPlayer | null;
  podium: HistoryPlayer[];
}

export interface ProfileStats {
  games: number;
  hosted: number;
  played: number;
  wins: number;
  podiums: number;
  points: number;
  avgRank: number | null;
  /** best question types first, by points per question */
  byType: { type: string; points: number; questions: number }[];
}

export interface Profile {
  user: { id: string; name: string; handle: string; profilePictureUrl?: string | null };
  self: boolean;
  stats: ProfileStats;
  /** all of them when it's you, otherwise the games you were both in */
  games: HistorySummary[];
  /** what they made public */
  shelf: StashItem[];
}

export interface HistoryRecord extends HistorySummary {
  players: HistoryPlayer[];
  content: StashContent;
}
