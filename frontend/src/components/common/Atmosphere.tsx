import React, { useEffect, useRef, useState } from "react";
import { DitherBlobs } from "./DitherBlobs";
import { Clouds } from "./Clouds";
import { Worlds } from "./Worlds";
import { PLACES, camera, placeItem, setMotion, shownSpace, stepCamera, subscribeSpace, worldItems } from "../../hooks/useSpace";
import { tickClouds } from "./dither";
import { effectsChoice, onEffectsChange } from "../../utils/theme";

const PHASES = ["IDLE", "WAITING", "QUESTION", "ANSWER", "ELABORATION", "RESULT"];
const BASE = import.meta.env.BASE_URL;

/**
 * Everything behind the UI, back to front: paper/ink, phase light,
 * dithered blobs and clouds, the blended lens textures, then grain.
 */
export const Atmosphere: React.FC = () => {
  useMovingLights();
  return (
    <div className="jqzz-aura" aria-hidden="true">
      <span className="shadow" />
      <span className="warm" />
      {PHASES.map((p) => (
        <span key={p} className={`phase phase-${p}`} />
      ))}
      {/* each place washes the sky its own colour */}
      <span className="tint" />
      {/* the planets of the place you're in and the one you left: furthest back, the dots and clouds pass in front */}
      <Worlds />
      <DitherBlobs />
      <Clouds />
      <Texture className="tex-floor" src={`${BASE}bg.webp`} filter={() => "contrast(0.5)"} />
      <Texture
        className="tex-lens-a"
        src={`${BASE}tex/lens-a.webp`}
        filter={() => "hue-rotate(-20deg) brightness(3) saturate(0.5)"}
      />
      <Texture
        className="tex-lens-b"
        src={`${BASE}tex/lens-b.webp`}
        filter={(k) => `blur(${2 * k}px) hue-rotate(-80deg)`}
      />
    </div>
  );
};

/** can a canvas apply CSS filters as it draws? (Safari only learned late) */
const canBake = (() => {
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx || !("filter" in ctx)) return false;
    ctx.filter = "blur(1px)";
    return ctx.filter === "blur(1px)";
  } catch {
    return false;
  }
})();

/**
 * One of the blended textures. Its filter used to be live CSS, which the
 * browser reapplied to the whole screen on every frame the lights moved
 * beneath it. Here it's applied once, while drawing the picture into a
 * canvas the size of the window (cover-fit, like the background it was), and
 * again only when the window really changes size. Where a canvas can't
 * filter, it stays the plain CSS layer it was.
 */
const Texture: React.FC<{ className: string; src: string; filter: (scale: number) => string }> = ({
  className,
  src,
  filter,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const filterRef = useRef(filter);
  const [baked, setBaked] = useState(canBake);

  useEffect(() => {
    filterRef.current = filter;
  });

  useEffect(() => {
    if (!baked) return;
    const canvas = ref.current;
    if (!canvas) return;
    const img = new Image();
    let drawnW = 0;
    let drawnH = 0;
    const draw = () => {
      const k = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(window.innerWidth * k));
      const h = Math.max(1, Math.round(window.innerHeight * k));
      drawnW = window.innerWidth;
      drawnH = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx || !img.naturalWidth) return;
      // cover, centred
      const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * s;
      const dh = img.naturalHeight * s;
      ctx.filter = filterRef.current(k);
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    };
    let t = 0;
    const onResize = () => {
      // a phone's address bar sliding is a resize on every scroll: skip small ones
      if (window.innerWidth === drawnW && Math.abs(window.innerHeight - drawnH) < 160) return;
      window.clearTimeout(t);
      t = window.setTimeout(draw, 200);
    };
    img.onload = draw;
    img.onerror = () => setBaked(false);
    img.src = src;
    window.addEventListener("resize", onResize);
    return () => {
      img.onload = null;
      img.onerror = null;
      window.clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, [baked, src]);

  return baked ? (
    <canvas ref={ref} className={`tex ${className} baked`} />
  ) : (
    <span className={`tex ${className}`} />
  );
};

/* ─── the lights move ────────────────────────────────────────────────
   Each light drifts slowly on its own (to and fro, eased), and the lot lean
   toward the pointer, each at its own depth, so it reads as space rather
   than a slide. On a phone they follow how it's tilted instead.

   The planet leans too, and everything rises slower than the page as it
   scrolls (below). This runs as one small loop writing transforms straight
   onto the lights, rather than CSS animations plus a variable on the root: a root
   variable made the browser recheck every element's style on every frame,
   and a 60fps drift made it re-mix the whole blended background just as
   often. Drifting a few pixels a second needs 15 frames a second; catching
   up with the pointer gets 30. Nothing else on the page is touched. */

interface Light {
  /** px it leans at full tilt, x and y */
  lean: [number, number];
  /** drift from / to: translate in % of its own size, then scale */
  from: [number, number, number];
  to: [number, number, number];
  /** seconds for one way */
  period: number;
  /** how far it rises as the page scrolls, as a share of the scroll */
  scroll: number;
}

const LIGHTS: Record<string, Light> = {
  phase: { lean: [70, 50], from: [-4, 2, 1], to: [5, -3, 1.12], period: 26, scroll: 0.06 },
  warm: { lean: [-90, -60], from: [3, 0, 1.05], to: [-6, -5, 0.95], period: 31, scroll: 0.1 },
  shadow: { lean: [40, -30], from: [0, -2, 0.96], to: [6, 4, 1.08], period: 37, scroll: 0.08 },
  // far back: it doesn't drift, only leans a little and rises slowly with the page
  // way back from the camera: further than the furthest cloud, so it barely moves
  planet: { lean: [8, 5], from: [0, 0, 1], to: [0, 0, 1], period: 1, scroll: 0.02 },
};

/* ─── scrolling ──────────────────────────────────────────────────────
   Whatever is scrolling the page (the window, .jqzz-body, a page's own
   container) the background rises with it, slower the further back it is.
   Only scrollers about the window's height count: a list scrolling inside a
   panel isn't the page moving. Read at frame time, so the listener does
   nothing but note which element it is and wake the loop. */
const scroll = { el: null as Element | null, until: 0 };
let wakeLights: (() => void) | null = null;

const onScroll = (e: Event) => {
  const t = e.target;
  const el = t === document || t === window ? document.scrollingElement : (t as Element);
  if (!el || !(el instanceof Element)) return;
  if (el !== document.scrollingElement && el.clientHeight < window.innerHeight * 0.6) return;
  scroll.el = el;
  scroll.until = performance.now() + 250;
  wakeLights?.();
};
// a new page starts at the top, whatever was scrolled before
const onRoute = () => {
  scroll.el = null;
  wakeLights?.();
};

function scrollY(): number {
  const el = scroll.el;
  if (!el) return 0;
  if (!el.isConnected) {
    scroll.el = null;
    return 0;
  }
  return el.scrollTop;
}
const BURST_LEAN: [number, number] = [24, 18];
/** screens of scroll a cloud sees per screen the camera climbs (it then moves by its depth's share of that) */
const CLOUD_CLIMB = 4;

let users = 0;
const EPOCH = performance.now();
let stopLights: (() => void) | null = null;
const target = { x: 0, y: 0 };

/** ease-in-out, like the cubic-bezier(0.65, 0, 0.35, 1) the drift used */
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function startLights(): () => void {
  const lean = { x: 0, y: 0 };
  let raf = 0;
  let timer = 0;
  let last = 0;
  // the lights, found again once a second (pages come and go), not every frame
  let lights: HTMLElement[] = [];
  let bursts: HTMLElement[] = [];
  let foundAt = -Infinity;
  // the camera starts where the page is, so the loop starting isn't a journey
  camera.x = camera.toAlt = PLACES[shownSpace().place].alt;
  camera.c = camera.toCol = PLACES[shownSpace().place].col;
  camera.v = camera.cv = 0;
  setMotion(true);

  // woken by a timer at the rate it needs, rather than on every screen refresh
  // only to skip most of them; the frame itself still lands on a refresh
  const next = (ms: number) => {
    timer = window.setTimeout(() => {
      timer = 0;
      raf = requestAnimationFrame(frame);
    }, ms);
  };
  // scrolling: every refresh, so the background keeps up with the content
  const wake = () => {
    if (!timer) return; // a frame is already on its way
    window.clearTimeout(timer);
    timer = 0;
    raf = requestAnimationFrame(frame);
  };
  wakeLights = wake;
  const offSpace = subscribeSpace(wake);
  const frame = (now: number) => {
    const settling = Math.abs(target.x - lean.x) + Math.abs(target.y - lean.y) > 0.002;
    const gap = last ? now - last : 66;
    last = now;
    // the camera flies toward the page's place; every frame while it does
    const there = PLACES[shownSpace().place];
    const flying = stepCamera(Math.min(gap, 120) / 1000, there.alt, there.col);
    const scrolling = now < scroll.until || flying;
    if (scrolling) raf = requestAnimationFrame(frame);
    else next(settling ? 33 : 66);
    if (flying) worldItems.forEach(placeItem);
    if (now - foundAt > 1000) {
      lights = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".jqzz-aura > .phase, .jqzz-aura > .warm, .jqzz-aura > .shadow, .jqzz-aura .planet",
        ),
      );
      bursts = Array.from(document.querySelectorAll<HTMLElement>(".jqzz-welcome-burst"));
      foundAt = now;
    }
    // the lean eases toward where the pointer is, about as quick as the old 1.4s transition
    const k = 1 - Math.exp(-Math.min(gap, 100) / 380);
    lean.x += (target.x - lean.x) * k;
    lean.y += (target.y - lean.y) * k;

    // one clock for the page: stopped and started again, the drift carries on
    // from where time says it is, instead of jumping back to its start
    const secs = (now - EPOCH) / 1000;
    const sy = scrollY();
    lights.forEach((el) => {
      const light = LIGHTS[el.classList[0]];
      if (!light) return;
      const cycle = (secs / light.period) % 2;
      const p = easeInOut(cycle < 1 ? cycle : 2 - cycle);
      const tx = light.from[0] + (light.to[0] - light.from[0]) * p;
      const ty = light.from[1] + (light.to[1] - light.from[1]) * p;
      const s = light.from[2] + (light.to[2] - light.from[2]) * p;
      el.style.transform =
        `translate3d(${(lean.x * light.lean[0] - camera.cv * window.innerWidth * light.scroll * 0.8).toFixed(1)}px, ${(lean.y * light.lean[1] - sy * light.scroll + camera.v * window.innerHeight * light.scroll * 0.8).toFixed(1)}px, 0) ` +
        `translate(${tx.toFixed(2)}%, ${ty.toFixed(2)}%) scale(${s.toFixed(4)})`;
    });
    bursts.forEach((el) => {
      el.style.translate = `${(lean.x * BURST_LEAN[0]).toFixed(1)}px ${(lean.y * BURST_LEAN[1]).toFixed(1)}px`;
    });
    // the clouds ride the same clock; they redraw only when one moves a whole cell
    // flying up is like scrolling up: the nearer the cloud, the further it falls past
    tickClouds(secs, lean.x, lean.y, sy - camera.x * window.innerHeight * CLOUD_CLIMB, scrolling, now, -camera.c * window.innerWidth * CLOUD_CLIMB);
  };
  raf = requestAnimationFrame(frame);
  const stopListening = listen();
  document.addEventListener("scroll", onScroll, { capture: true, passive: true });
  window.addEventListener("hashchange", onRoute);
  window.addEventListener("popstate", onRoute);
  return () => {
    window.clearTimeout(timer);
    cancelAnimationFrame(raf);
    stopListening();
    wakeLights = null;
    offSpace();
    setMotion(false);
    document.removeEventListener("scroll", onScroll, { capture: true });
    window.removeEventListener("hashchange", onRoute);
    window.removeEventListener("popstate", onRoute);
    // stopped (effects turned down): everything back where it stands still
    lights.forEach((el) => (el.style.transform = ""));
    tickClouds((performance.now() - EPOCH) / 1000, 0, 0, 0, false, performance.now());
  };
}

const aim = (x: number, y: number) => {
  target.x = Math.max(-1, Math.min(1, x));
  target.y = Math.max(-1, Math.min(1, y));
};

const onMove = (e: PointerEvent) => {
  if (e.pointerType !== "mouse") return; // a finger dragging isn't a pointer to follow
  aim((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
};

// gamma: tilting left and right; beta: tilting toward you, held at about 45°
const onTilt = (e: DeviceOrientationEvent) => {
  if (e.gamma == null || e.beta == null) return;
  aim(e.gamma / 30, (e.beta - 45) / 30);
};

type AskingOrientation = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };

function listen(): () => void {
  window.addEventListener("pointermove", onMove, { passive: true });
  if (!window.matchMedia("(pointer: coarse)").matches || typeof DeviceOrientationEvent === "undefined") {
    return () => window.removeEventListener("pointermove", onMove);
  }
  const orientation = DeviceOrientationEvent as AskingOrientation;
  const startTilt = () => window.addEventListener("deviceorientation", onTilt);
  // most phones send tilt straight away; iPhones only after a tap says yes
  startTilt();
  let ask: (() => void) | null = null;
  if (typeof orientation.requestPermission === "function") {
    ask = () => {
      orientation.requestPermission!()
        .then((answer) => answer === "granted" && startTilt())
        .catch(() => {});
    };
    window.addEventListener("pointerup", ask, { once: true });
  }
  return () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("deviceorientation", onTilt);
    if (ask) window.removeEventListener("pointerup", ask);
  };
}

/** One loop for the whole page, however many backgrounds are mounted; none with effects turned down. */
function useMovingLights() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const sync = () => {
      const want = users > 0 && effectsChoice() !== "reduced";
      if (want && !stopLights) stopLights = startLights();
      if (!want && stopLights) {
        stopLights();
        stopLights = null;
      }
    };
    users++;
    sync();
    const off = onEffectsChange(sync);
    return () => {
      off();
      users--;
      sync();
    };
  }, []);
}

/** Light leaks, huge grain, dust and scratches over everything, like a scanned print. */
export const Imperfections: React.FC = () => (
  <div className="jqzz-imperfections" aria-hidden="true">
    <span className="leaks" />
    <span className="grain-huge" />
    <span className="scratches" />
    <span className="dust" />
  </div>
);
