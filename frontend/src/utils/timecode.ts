import type { Action, Quiz } from "../types";

/** 83 -> "01:23"; over an hour -> "1:02:03" */
export function formatTimecode(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Seconds into the quiz at which each action starts, keyed by action id. */
export function actionStartTimes(actions: Action[]): Map<number, number> {
  const starts = new Map<number, number>();
  let t = 0;
  for (const a of actions) {
    starts.set(a.id, t);
    t += a.time || 0;
  }
  return starts;
}

export function quizRuntime(quiz: Quiz | undefined): number {
  return quiz ? quiz.actions.reduce((sum, a) => sum + (a.time || 0), 0) : 0;
}

export function questionCount(quiz: Quiz | undefined): number {
  if (!quiz) return 0;
  return new Set(quiz.actions.map((a) => a.question?.id).filter((id) => id != null)).size;
}

/** Database id as a short code, e.g. 6 -> "QZ-006" */
export function quizCode(id: number | undefined): string {
  return id ? `QZ-${String(id).padStart(3, "0")}` : "QZ-···";
}
