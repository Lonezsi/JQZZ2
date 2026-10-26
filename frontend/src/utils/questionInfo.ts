import type { Question } from "../types";

/** Plain names for question types, as players would describe them. */
export const QUESTION_TYPE_LABEL: Record<string, string> = {
  PREWRITTEN_SINGLE: "single choice",
  PREWRITTEN_MULTIPLE: "multiple choice",
  USER_GENERATED: "players write",
  USER_GENERATED_VOTE: "write + vote",
  USER_GENERATED_IDENTIFY: "who wrote it",
  TIERLIST: "tier list",
  KNOCKOUT_BATTLE: "knockout",
};

export const typeLabel = (type: string | undefined) =>
  QUESTION_TYPE_LABEL[type ?? ""] ?? (type ?? "question").toLowerCase().replace(/_/g, " ");

/** Most points one player can get from this question, or null when it isn't scored by answers. */
export function maxPoints(q: Question | null | undefined): number | null {
  if (!q || !q.answers?.length) return null;
  const values = q.answers.map((a) => a.value || 0);
  if (q.type === "PREWRITTEN_SINGLE") return Math.max(0, ...values);
  if (q.type === "PREWRITTEN_MULTIPLE") return values.filter((v) => v > 0).reduce((s, v) => s + v, 0);
  return null;
}

/** Answers that score, i.e. the ones a player wants to pick. */
export const scoringAnswers = (q: Question | null | undefined) =>
  (q?.answers ?? []).filter((a) => (a.value || 0) > 0);
