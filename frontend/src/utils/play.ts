import type { GameAbout, GameEntry, GameState } from "../types/play";
import { modeOf } from "./questionTypes";

/** answer tiles take the aura's colours, in this order */
const TILE_COLOURS = [
  "var(--phase-QUESTION)",
  "var(--warm)",
  "var(--phase-ANSWER)",
  "var(--phase-RESULT)",
  "var(--ok)",
  "var(--phase-WAITING)",
];
export const tileColour = (i: number) => TILE_COLOURS[i % TILE_COLOURS.length];
export const tileLetter = (i: number) => String.fromCharCode(65 + (i % 26));

/** someone's name in this game: a player here, or someone a person question lists (they may have left) */
export const nameOf = (game: GameState, id?: string | null) =>
  game.players.find((p) => p.id === id)?.name ??
  game.question?.people?.find((p) => p.id === id)?.name ??
  "someone who left";

/** what an entry was made about, in one line: Anna: “went to the zoo”, or just the words while who wrote them is a secret */
export function subjectOf(about: GameAbout | undefined): string | null {
  if (!about?.text) return null;
  const words = about.text.length > 60 ? `${about.text.slice(0, 60)}…` : about.text;
  return about.name ? `${about.name}: “${words}”` : `“${words}”`;
}

/**
 * How a board of entries came out, for the reveals of drawings and of words
 * alike: which one is marked the winner, and what each one's count says.
 */
export function boardOutcome(game: GameState) {
  const r = game.reveal!;
  const entries = r.entries ?? [];
  const { ask, score } = modeOf(game.question);
  // a pick on earlier answers is all about its votes, even when they score nothing
  const scored = r.settled && (score !== "none" || ask === "pick");
  const top = Math.max(0, ...entries.map((e) => e.votes ?? 0));
  // anything voted on has one stored winner, a tie already settled; other boards mark their top
  const voted = score === "votes" || ask === "pick";
  const isWinner = (e: GameEntry) =>
    r.winner != null ? e.key === r.winner : !voted && scored && top > 0 && e.votes === top;
  const sorted = scored
    ? [...entries].sort((a, b) => Number(isWinner(b)) - Number(isWinner(a)) || (b.votes ?? 0) - (a.votes ?? 0))
    : entries;
  const count = (e: GameEntry) => {
    const n = e.votes ?? 0;
    if (score === "secret") return `${n} got it`;
    if (score === "authors") return `${n} saw through it`;
    return `${n} ${n === 1 ? "vote" : "votes"}${e.shown !== undefined ? ` · seen by ${e.shown}` : ""}`;
  };
  return { entries, sorted, scored, isWinner, count };
}

/** what a picks counter says: how many so far, or that it's full */
export const pickCount = (k: number, n: number) => (k >= n ? `that's ${n}. tap one to take it back.` : `${k} of ${n} picked`);
