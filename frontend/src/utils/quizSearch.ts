import type { Quiz } from "../types";

/** What made a quiz match: its name, or one of its questions. */
export function matchQuiz(q: Quiz, query: string): { hit: boolean; via?: string } {
  const needle = query.trim().toLowerCase();
  if (!needle) return { hit: true };
  if (q.name.toLowerCase().includes(needle)) return { hit: true };
  const question = q.actions.find((a) => a.question?.text?.toLowerCase().includes(needle))
    ?.question?.text;
  return question ? { hit: true, via: question } : { hit: false };
}
