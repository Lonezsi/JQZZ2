/* What the dithered layers share, so they print on one grid in one pattern. */

// 8x8 Bayer matrix, normalised to 0..1: ordered dithering, like print halftone
export const BAYER = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28,
  52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39,
  13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
].map((v) => (v + 0.5) / 64);

/** chunk size of one dither cell, in CSS pixels */
export const CELL = 4;

export function hexToRgb(value: string): [number, number, number] {
  const hex = value.trim().replace("#", "");
  const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex;
  const n = parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* The clouds are moved by the lights' loop (Atmosphere.tsx) rather than a loop
   of their own: it calls tickClouds with its clock and the eased lean.
   scrollY is how far the page has scrolled, in px; fast is true while it's
   scrolling, when they may redraw on every frame. */
export type CloudTick = (
  secs: number,
  leanX: number,
  leanY: number,
  scrollY: number,
  fast: boolean,
  now: number,
) => void;
export const cloudTicks = new Set<CloudTick>();

export function tickClouds(secs: number, leanX: number, leanY: number, scrollY: number, fast: boolean, now: number) {
  cloudTicks.forEach((t) => t(secs, leanX, leanY, scrollY, fast, now));
}
