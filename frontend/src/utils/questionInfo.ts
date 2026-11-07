import type { Question } from "../types";
import { describeQuestion, modeOf } from "./questionTypes";

type QuestionLike = Parameters<typeof describeQuestion>[0];

/**
 * What a question is, in the words players would use: a preset's name, or
 * its ask and score. Takes the question, or a stored type name on its own.
 */
export const typeLabel = (q: QuestionLike | string | undefined) =>
  q == null ? "question" : describeQuestion(typeof q === "string" ? { type: q } : q).label;

/** its glyph, the same way */
export const typeIcon = (q: QuestionLike | string | undefined) =>
  describeQuestion(typeof q === "string" ? { type: q } : (q ?? null)).icon;

/** Most points one player can get from this question, or null when it isn't scored by answers. */
export function maxPoints(q: Question | null | undefined): number | null {
  if (!q) return null;
  const { ask, score } = modeOf(q);
  const values = (q.answers ?? []).map((a) => a.value || 0);
  const best = Math.max(0, ...values);
  const sum = values.filter((v) => v > 0).reduce((s, v) => s + v, 0);
  if (score === "right") {
    // naming whoever made the winner of an earlier question; it has no answers of its own
    if (ask === "person") return 100;
    if (!values.length) return null;
    return ask === "pick-many" || ask === "order" || ask === "match" ? sum : best;
  }
  if (score === "crowd") {
    if (ask === "number") return values.length ? values[0] : 1000;
    if (ask === "rank") return (q.answers?.length ?? 0) * 50 || null;
    return values.length ? best : null;
  }
  return null;
}

/** Answers that score, i.e. the ones a player wants to pick. */
export const scoringAnswers = (q: Question | null | undefined) =>
  (q?.answers ?? []).filter((a) => (a.value || 0) > 0);
