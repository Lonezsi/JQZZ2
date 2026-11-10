import type { Action, Quiz } from "../types";
import { generateId } from "./idGenerator";

/*
 * Who's coming: the names a quiz expects (utils/scriptDocs.ts, WHO'S COMING).
 * The script says it in one line, Roster("Anna", "Bence"); the quiz keeps it
 * as a ROSTER step that never plays, its preview {"names":[...],"unique":true}.
 * Everyone who joins the game picks their name from it.
 */

export interface Roster {
  names: string[];
  /** two people can't pick the same name */
  unique: boolean;
}

/** names on one roster, at most */
export const ROSTER_MOST = 50;
/** letters in one name, at most */
export const ROSTER_NAME_MOST = 30;
/** the server keeps a step's preview up to this long (Action.java) */
const PREVIEW_MOST = 2000;

/** how names are compared: trimmed, inner spaces collapsed, lowercase */
export const nameKey = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** a name as it's kept: trimmed, inner spaces collapsed */
const tidy = (s: string) => s.trim().replace(/\s+/g, " ");

/**
 * A stored roster, read the way the game reads it: names tidied, blank and
 * too long ones dropped, each name once, at most 50. null when it isn't one.
 */
export function readRoster(preview: string | null | undefined): Roster | null {
  if (!preview) return null;
  let data: unknown;
  try {
    data = JSON.parse(preview);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || !Array.isArray((data as { names?: unknown }).names)) return null;
  const { names, unique } = data as { names: unknown[]; unique?: unknown };
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const n of names) {
    if (typeof n !== "string") continue;
    const name = tidy(n);
    if (!name || name.length > ROSTER_NAME_MOST || seen.has(nameKey(name))) continue;
    seen.add(nameKey(name));
    kept.push(name);
    if (kept.length === ROSTER_MOST) break;
  }
  return { names: kept, unique: unique !== false };
}

/** how a roster is stored: {"names":[...],"unique":true}, keys in that order */
export function writeRoster(r: Roster): string {
  return JSON.stringify({ names: r.names, unique: r.unique });
}

/** the script's line for it: Roster("Anna", "Bence"), or Roster("Anna", "Bence", unique: off) */
export function rosterLine(r: Roster): string {
  const names = r.names.map((n) => JSON.stringify(n)).join(", ");
  return `Roster(${names}${r.unique ? "" : ", unique: off"})`;
}

/** names typed one per line: trimmed, blank lines dropped */
export function splitNames(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** what's wrong with these names as a roster, or null when nothing is */
export function rosterProblem(names: string[]): string | null {
  if (names.length === 0) return "Roster needs at least one name";
  const seen = new Set<string>();
  for (const n of names) {
    const name = tidy(n);
    if (!name) return "a name on the roster can't be empty";
    if (name.length > ROSTER_NAME_MOST) return `names on the roster are up to ${ROSTER_NAME_MOST} letters`;
    if (seen.has(nameKey(name))) return `"${name}" is on the roster twice`;
    seen.add(nameKey(name));
  }
  if (names.length > ROSTER_MOST) return `the roster takes up to ${ROSTER_MOST} names`;
  // the longer of the two ways it can be stored
  if (writeRoster({ names: names.map(tidy), unique: false }).length > PREVIEW_MOST) {
    return "the roster is too long to keep: shorten some names";
  }
  return null;
}

/** a quiz's roster: its first ROSTER step, read; null when it has none */
export function rosterOf(quiz: Quiz | undefined): { action: Action; roster: Roster } | null {
  const action = quiz?.actions.find((a) => a.phase === "ROSTER");
  const roster = action ? readRoster(action.preview) : null;
  return action && roster ? { action, roster } : null;
}

/** the step that keeps a roster in a quiz */
export function rosterAction(r: Roster): Action {
  return { id: generateId(), phase: "ROSTER", time: 0, question: null, preview: writeRoster(r) };
}
