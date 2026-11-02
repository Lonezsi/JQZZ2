import type { Question } from "../types";
import { QUESTION_TYPES_INFO, typeInfo } from "./questionTypes";

/** Plain names for question types, as players would describe them (from the registry). */
export const QUESTION_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  QUESTION_TYPES_INFO.map((t) => [t.id, t.label]),
);

export const typeLabel = (type: string | undefined) =>
  type ? typeInfo(type).label : "question";

/** Most points one player can get from this question, or null when it isn't scored by answers. */
export function maxPoints(q: Question | null | undefined): number | null {
  if (!q || !q.answers?.length) return null;
  const values = q.answers.map((a) => a.value || 0);
  const best = Math.max(0, ...values);
  const sum = values.filter((v) => v > 0).reduce((s, v) => s + v, 0);
  switch (q.type) {
    case "PREWRITTEN_SINGLE":
    case "TYPED":
    case "NUMBER":
    case "POLL":
      return best;
    case "PREWRITTEN_MULTIPLE":
    case "ORDER":
    case "MATCH":
      return sum;
    default:
      return null;
  }
}

/** Answers that score, i.e. the ones a player wants to pick. */
export const scoringAnswers = (q: Question | null | undefined) =>
  (q?.answers ?? []).filter((a) => (a.value || 0) > 0);
