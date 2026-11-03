import { useLayoutEffect, useSyncExternalStore } from "react";

/*
 * Every page has a place. Going up and down is going between kinds of page:
 * loading is lowest, then being in a game, then the editor, and the profile is
 * above all of them, the admin panel highest. Going sideways is going between
 * the profile's tabs, which hang side by side in a row at the profile's height.
 * The shared background (components/common/Ground.tsx) is one camera that
 * travels between them: the clouds stream past it and the planets of the two
 * places slide by. Only the planet of the place you're in, and the one you're
 * leaving, exist.
 *
 * alt is how high, in screens; col how far along, in screens; tint is the
 * colour the place washes the sky with.
 */
export const PLACES = {
  // only the first load: way below the front page, straight under it, where the site waits until it's ready
  loading: { alt: -1.5, col: -1, tint: "rgba(84, 108, 160, 0.17)" },
  game: { alt: 1, col: 0, tint: "rgba(176, 68, 124, 0.13)" },
  // the front page, with no quiz open: just left of the editor, so opening one slides across
  front: { alt: 2, col: -1, tint: "rgba(120, 92, 214, 0.1)" },
  editor: { alt: 2, col: 0, tint: "rgba(66, 102, 214, 0.14)" },
  history: { alt: 3, col: 0, tint: "rgba(62, 170, 158, 0.12)" },
  stash: { alt: 3, col: 1, tint: "rgba(216, 148, 66, 0.12)" },
  shelf: { alt: 3, col: 1, tint: "rgba(226, 132, 160, 0.12)" },
  notifications: { alt: 3, col: 2, tint: "rgba(96, 188, 226, 0.12)" },
  friends: { alt: 3, col: 2, tint: "rgba(150, 110, 220, 0.13)" },
  you: { alt: 3, col: 3, tint: "rgba(70, 168, 132, 0.12)" },
  settings: { alt: 3, col: 4, tint: "rgba(120, 150, 160, 0.13)" },
  admin: { alt: 4.6, col: 0, tint: "rgba(214, 70, 52, 0.14)" },
} as const;

export type Place = keyof typeof PLACES;

interface Shown {
  place: Place;
  phase: string;
}

let shown: Shown = { place: "loading", phase: "IDLE" };
let launched = false;
let launchedAt = -Infinity;

/** how long ago the launch was, in ms; the front page's star, mounting late, joins it where it's got to */
export const sinceLaunch = () => performance.now() - launchedAt;

/** how the camera should fly when the place changes: wait this long, then take about this long */
interface Flight {
  delay: number;
  ms: number;
  /** straight up: the planets don't lean sideways on the way */
  straight?: boolean;
}

/** how long a page took to load last time, by place: a flight to it lasts about that long */
const loadTimes: Partial<Record<Place, number>> = {};
export const recordLoad = (place: Place, ms: number) => {
  loadTimes[place] = ms;
};
/** a page that has to load is flown to as slowly as it takes to load, between a snap and a long way round */
export const loadFlightMs = (place: Place) => Math.min(3500, Math.max(600, loadTimes[place] ?? 800));

/** the poster's star shoots up first and the camera follows it: it waits for the star to get going */
const LAUNCH: Flight = { delay: 0.45, ms: 3100, straight: true };
const listeners = new Set<() => void>();

export const shownSpace = () => shown;

export const subscribeSpace = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export function setSpace(place: Place, phase: string, flightMs?: number) {
  if (shown.place === place && shown.phase === phase) return;
  const prev = shown;
  let flight: Flight | null = flightMs ? { delay: 0, ms: flightMs } : null;
  if (!launched && prev.place === "loading" && place !== "loading") {
    // the first time the site goes anywhere: up from the loading planet, behind the front page's star
    launched = true;
    launchedAt = performance.now();
    flight = LAUNCH;
  }
  shown = { place, phase };
  const moves = PLACES[place].alt !== PLACES[prev.place].alt || PLACES[place].col !== PLACES[prev.place].col;
  if (moves && flight) camera.flight = flight;
  listeners.forEach((l) => l());
}

/** The place this page is in, and which phase's light it has. Said as it mounts, before the first paint. */
export function useSpace(place: Place, phase: string) {
  useLayoutEffect(() => setSpace(place, phase), [place, phase]);
}

export const useShownSpace = () => useSyncExternalStore(subscribeSpace, shownSpace);

/* ─── the camera ─────────────────────────────────────────────────────
   Where it is, in screens, and how fast it's moving. Moved by the lights'
   loop (Atmosphere.tsx), once per frame, as a critically damped spring: it
   eases out of where it was and into where it's going, and a new destination
   mid-flight carries the speed on instead of jumping. */
export const camera = {
  /** how high, in screens, and how fast it's rising */
  x: PLACES.loading.alt as number,
  v: 0,
  /** how far along, in screens, and how fast */
  c: PLACES.loading.col as number,
  cv: 0,
  smoothTime: 0.5,
  toAlt: PLACES.loading.alt as number,
  toCol: PLACES.loading.col as number,
  /** how the next flight goes, if it isn't the usual one; taken when the flight starts */
  flight: null as Flight | null,
  /** seconds still to wait before the flight starts */
  delay: 0,
  /** how much a climb leans sideways: none on a straight flight */
  lean: 1,
};

/** one axis, one frame: critically damped, so it eases out and in and keeps its speed when the goal moves */
function spring(pos: number, vel: number, goal: number, smoothTime: number, dt: number): [number, number] {
  const change = pos - goal;
  if (Math.abs(change) < 0.0004 && Math.abs(vel) < 0.002) return [goal, 0];
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const temp = (vel + omega * change) * dt;
  return [goal + (change + temp) * e, (vel - omega * temp) * e];
}

/** one frame of travel toward a place; true while there is any (including the frame it lands on) */
export function stepCamera(dt: number, alt: number, col: number): boolean {
  if (alt !== camera.toAlt || col !== camera.toCol) {
    camera.toAlt = alt;
    camera.toCol = col;
    const planned = camera.flight;
    camera.flight = null;
    camera.delay = planned?.delay ?? 0;
    camera.lean = planned?.straight ? 0 : 1;
    // a spring is within a hundredth of its goal after about 3.3 times its smooth time
    camera.smoothTime = planned
      ? planned.ms / 3300
      : // a longer way takes a little longer, not proportionally so
        0.42 + 0.1 * Math.min(Math.max(Math.abs(alt - camera.x), Math.abs(col - camera.c)), 4);
  }
  if (camera.delay > 0) {
    camera.delay -= dt;
    return true;
  }
  const [x, v] = spring(camera.x, camera.v, alt, camera.smoothTime, dt);
  const [c, cv] = spring(camera.c, camera.cv, col, camera.smoothTime, dt);
  const moved = x !== camera.x || c !== camera.c || v !== camera.v || cv !== camera.cv;
  camera.x = x;
  camera.v = v;
  camera.c = c;
  camera.cv = cv;
  return moved;
}

/* ─── what hangs in the sky ──────────────────────────────────────────
   The planets register here and are put where the camera says. With the
   loop stopped (effects turned down, or less motion asked for) they're not
   moved at all: the planet of the place you're in just sits where it sits. */
export interface WorldItem {
  el: HTMLElement;
  place: Place;
}

export const worldItems = new Set<WorldItem>();
let motion = false;

/** how many screens a planet moves per screen the camera does */
const TRAVEL = 0.9;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** whether the camera travels at all (it doesn't with effects turned down or less motion asked for) */
export const inMotion = () => motion;

export function setMotion(on: boolean) {
  motion = on;
  if (!on) worldItems.forEach(placeItem);
}

export function placeItem(it: WorldItem) {
  if (!motion) {
    it.el.style.transform = "";
    it.el.style.opacity = "";
    return;
  }
  const dy = camera.x - PLACES[it.place].alt;
  const dc = camera.c - PLACES[it.place].col;
  const d = Math.hypot(dy, dc);
  // the place you're going to is visible from a long way off; the one you left goes at once
  const o = shown.place === it.place ? 1 - smooth(0.5, 2.4, d) : 1 - smooth(0.3, 1.5, d);
  // a screen along is a screen along; a climb leans a little sideways too
  const x = -dc * window.innerWidth * TRAVEL - dy * 0.05 * camera.lean * window.innerWidth;
  it.el.style.transform = `translate3d(${x.toFixed(1)}px, ${(dy * window.innerHeight * TRAVEL).toFixed(1)}px, 0)`;
  it.el.style.opacity = o.toFixed(3);
}

export function registerWorldItem(el: HTMLElement, place: Place) {
  const item: WorldItem = { el, place };
  worldItems.add(item);
  placeItem(item);
  return () => void worldItems.delete(item);
}
