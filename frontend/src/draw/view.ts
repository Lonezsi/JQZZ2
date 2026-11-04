/*
 * How the sheet sits in its window: moved, turned and zoomed by two fingers.
 * Points here are screen pixels measured from the middle of the window; the
 * sheet's own middle sits at (x, y), turned by angle and grown by scale on
 * top of the size that fits it in the window.
 */

export interface View {
  x: number;
  y: number;
  scale: number;
  angle: number;
}

export interface Pt {
  x: number;
  y: number;
}

export const HOME: View = { x: 0, y: 0, scale: 1, angle: 0 };
export const MIN_SCALE = 0.3;
export const MAX_SCALE = 10;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** a screen point to where it lands on the sheet, in the sheet's own pixels */
export function toSheet(v: View, p: Pt, fit: number, width: number, height: number): Pt {
  const dx = p.x - v.x;
  const dy = p.y - v.y;
  const c = Math.cos(v.angle);
  const s = Math.sin(v.angle);
  // turn back, shrink back, then from fitted pixels to sheet pixels
  const ux = (dx * c + dy * s) / v.scale;
  const uy = (-dx * s + dy * c) / v.scale;
  return { x: ux / fit + width / 2, y: uy / fit + height / 2 };
}

/** how far two fingers must twist before the sheet turns with them: less is just a wobble in a pinch */
export const TURN_AFTER = (15 * Math.PI) / 180;

/** how much the line between two fingers turned going from a0, b0 to a, b */
export const twist = (a0: Pt, b0: Pt, a: Pt, b: Pt) =>
  wrap(Math.atan2(b.y - a.y, b.x - a.x) - Math.atan2(b0.y - a0.y, b0.x - a0.x));

/**
 * Two fingers moved from a0, b0 to a, b: the view that keeps the bit of
 * sheet that was under them under them, zoomed by how far apart they went
 * and, if `turn`, turned by how much the line between them turned.
 */
export function twoFingers(start: View, a0: Pt, b0: Pt, a: Pt, b: Pt, turn = true): View {
  const d0 = Math.max(1, Math.hypot(b0.x - a0.x, b0.y - a0.y));
  const d = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
  const scale = clamp((start.scale * d) / d0, MIN_SCALE, MAX_SCALE);
  const angle = turn ? start.angle + twist(a0, b0, a, b) : start.angle;
  const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return { ...pinned(start, m0, m, scale, angle), scale, angle };
}

/** zoomed around one point (a mouse wheel, a trackpad pinch) */
export function zoomAt(v: View, p: Pt, factor: number): View {
  const scale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
  return { ...pinned(v, p, p, scale, v.angle), scale, angle: v.angle };
}

/** where the middle goes so the sheet point under `from` (in view v) ends up under `to` */
function pinned(v: View, from: Pt, to: Pt, scale: number, angle: number): Pt {
  // the point under `from`, relative to the sheet's middle, unturned and unscaled
  const dx = from.x - v.x;
  const dy = from.y - v.y;
  const c0 = Math.cos(v.angle);
  const s0 = Math.sin(v.angle);
  const ux = (dx * c0 + dy * s0) / v.scale;
  const uy = (-dx * s0 + dy * c0) / v.scale;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: to.x - (ux * c - uy * s) * scale, y: to.y - (ux * s + uy * c) * scale };
}

/** -180..180 degrees, in radians */
function wrap(a: number) {
  const t = Math.PI * 2;
  return a - t * Math.round(a / t);
}

/** a turn close to straight (or a quarter turn) is meant to be straight */
export function snapAngle(a: number, within = (7 * Math.PI) / 180): number {
  const q = Math.PI / 2;
  const near = Math.round(a / q) * q;
  return wrap(Math.abs(a - near) < within ? near : a);
}

/** keeps some of the sheet in the window: its middle can't wander further than its own reach */
export function keepInReach(v: View, w: number, h: number, vw: number, vh: number): View {
  const r = (Math.hypot(w, h) / 2) * v.scale;
  const rx = Math.max(r, vw / 2 - 24);
  const ry = Math.max(r, vh / 2 - 24);
  return { ...v, x: clamp(v.x, -rx, rx), y: clamp(v.y, -ry, ry) };
}

export const isHome = (v: View) =>
  Math.abs(v.x) < 0.5 && Math.abs(v.y) < 0.5 && Math.abs(v.scale - 1) < 0.005 && Math.abs(wrap(v.angle)) < 0.001;

/** "140%", "140% · 30°" */
export function viewLabel(v: View): string {
  const deg = Math.round((wrap(v.angle) * 180) / Math.PI);
  return `${Math.round(v.scale * 100)}%${deg ? ` · ${deg}°` : ""}`;
}
