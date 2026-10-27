import type { GameState } from "../types/play";

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

export const nameOf = (game: GameState, id?: string | null) =>
  game.players.find((p) => p.id === id)?.name ?? "someone who left";
