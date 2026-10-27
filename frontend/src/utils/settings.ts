import type { Action } from "../types";

/*
 * Quiz settings. A SETTING block in the timeline switches some of them for
 * everything after it, until another block changes them again; in text mode
 * the same thing reads as a group: `shuffle {` ... `}`. The server reads the
 * same "key=value, key=value" text (GameEngine.Settings).
 */

export interface QuizSettings {
  /** questions in the group swap places, each keeping its own steps */
  shuffle: boolean;
  /** each question's answers come in a random order */
  mix: boolean;
  /** off: the questions are played but give no points */
  grade: boolean;
  /** points multiplier: 2 is double */
  points: number;
}

export const DEFAULTS: QuizSettings = { shuffle: false, mix: false, grade: true, points: 1 };

export const SETTING_LABEL: Record<keyof QuizSettings, string> = {
  shuffle: "shuffle questions",
  mix: "mix answers",
  grade: "counts for points",
  points: "points ×",
};

const OFF = ["off", "false", "no", "0"];

/** "shuffle=on, points=2" -> { shuffle: true, points: 2 }; bare "shuffle" means on */
export function parseSettings(text: string | undefined): Partial<QuizSettings> {
  const out: Partial<QuizSettings> = {};
  for (const part of (text ?? "").split(/[,;]/)) {
    const [rawKey, rawValue] = part.split("=").map((s) => s?.trim().toLowerCase());
    if (!rawKey) continue;
    const value = rawValue ?? "on";
    const on = !OFF.includes(value);
    if (rawKey === "shuffle" || rawKey === "mix" || rawKey === "grade") out[rawKey] = on;
    if (rawKey === "points") {
      const n = Number(value.replace(/^[x×]/, ""));
      out.points = Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 1;
    }
  }
  return out;
}

export function formatSettings(s: Partial<QuizSettings>): string {
  return (Object.keys(s) as (keyof QuizSettings)[])
    .filter((k) => s[k] !== undefined)
    .map((k) => (k === "points" ? `points=${s.points}` : `${k}=${s[k] ? "on" : "off"}`))
    .join(", ");
}

/** short chips for a block or a group: "shuffle", "no points", "×2" */
export function describe(s: Partial<QuizSettings>, all = false): string[] {
  const chips: string[] = [];
  if (s.shuffle !== undefined && (all || s.shuffle)) chips.push(s.shuffle ? "shuffled" : "in order");
  if (s.mix !== undefined && (all || s.mix)) chips.push(s.mix ? "answers mixed" : "answers in order");
  if (s.grade !== undefined && (all || !s.grade)) chips.push(s.grade ? "graded" : "no points");
  if (s.points !== undefined && (all || s.points !== 1)) chips.push(`×${s.points}`);
  return chips;
}

/** The settings in force at each action, after every block before it. */
export function settingsAt(actions: Action[]): Map<number, QuizSettings> {
  const at = new Map<number, QuizSettings>();
  let current = { ...DEFAULTS };
  for (const a of actions) {
    if (a.phase === "SETTING") current = { ...current, ...parseSettings(a.preview) };
    at.set(a.id, current);
  }
  return at;
}

/** What differs from the defaults: the chips a question group wears. */
export const changed = (s: QuizSettings): Partial<QuizSettings> => {
  const out: Partial<QuizSettings> = {};
  (Object.keys(DEFAULTS) as (keyof QuizSettings)[]).forEach((k) => {
    if (s[k] !== DEFAULTS[k]) (out as Record<string, unknown>)[k] = s[k];
  });
  return out;
};

/** Ready-made blocks for the add tray. */
export const SETTING_PRESETS: { label: string; text: string; note: string }[] = [
  { label: "shuffle", text: "shuffle=on", note: "questions after this swap places" },
  { label: "mix answers", text: "mix=on", note: "answers in a random order" },
  { label: "no points", text: "grade=off", note: "played, but nobody scores" },
  { label: "double points", text: "points=2", note: "everything scores ×2" },
  { label: "back to normal", text: "shuffle=off, mix=off, grade=on, points=1", note: "ends every setting above" },
];
