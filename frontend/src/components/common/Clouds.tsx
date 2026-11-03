import React, { useEffect, useRef } from "react";
import { BAYER, CELL, cloudTicks, hexToRgb, type CloudTick } from "./dither";
import { effectsChoice, onEffectsChange, onThemeChange } from "../../utils/theme";

const BASE = import.meta.env.BASE_URL;

/*
 * Clouds, dithered where they thin out and smooth where they're dense, on
 * the very grid the dither blobs use: each cloud (a
 * Blender render with real transparency, public/clouds) is shrunk once to one
 * pixel per dither cell, then every frame that matters it's stamped into a
 * cell-sized canvas through the same Bayer matrix, in three inks: navy
 * shadow, slate middle, cream light. How deep in the cloud a cell is decides how it's
 * printed: its edges break into dots, its core (the innermost 30%) is smooth
 * shading through the same inks (a second canvas, scaled up softly), and in between it's a
 * mix. The dots are scaled up with hard edges, like the blobs, and the clouds
 * only ever move by whole cells, so the dots stay put on the grid.
 *
 * They drift slowly on their own (a crossing takes minutes) and, with a mouse,
 * lean toward it by depth. Moved by the lights' loop in Atmosphere.tsx
 * (tickClouds, in dither.ts), which already runs at the pace this needs; redrawn only when
 * some cloud has moved by a cell. With effects turned down they're not drawn;
 * with less motion asked for they stand still.
 */

interface CloudDef {
  src: string;
  /** where its left edge starts, as a fraction of the crossing; top as a fraction of the height */
  x: number;
  y: number;
  /** width as a fraction of the window's longer side */
  size: number;
  /** 0 far .. 1 near: how far it leans, how fast it drifts, drawn in this order */
  depth: number;
  /** how dense it prints, 0..1 */
  k: number;
  /** mirrored, so a picture used twice doesn't look it */
  flip?: boolean;
}

const CLOUDS: CloudDef[] = [
  { src: "haze", x: 0.1, y: -0.06, size: 0.62, depth: 0.15, k: 0.55 },
  { src: "scatter", x: 0.62, y: 0.58, size: 0.44, depth: 0.35, k: 0.6, flip: true },
  { src: "cumulus-c", x: 0.38, y: 0.02, size: 0.3, depth: 0.5, k: 0.8 },
  { src: "cumulus-a", x: 0.82, y: -0.04, size: 0.36, depth: 0.7, k: 0.9 },
  { src: "cumulus-b", x: 0.02, y: 0.66, size: 0.4, depth: 0.95, k: 0.85 },
];

/** a crossing of the window, in seconds: far clouds ~9 min, near ones ~4 */
const crossing = (depth: number) => 540 - 300 * depth;
/** px a cloud leans with the pointer at the window's edge, at depth 1 */
const LEAN: [number, number] = [56, 28];
/** at most this often, even when the loop runs faster */
const MIN_GAP = 60;
/** the share of a cloud's area, its innermost, that prints smooth with no dots */
const SOLID_SHARE = 0.3;
/** the dots start thinning this far in, as a share of the way to that smooth core */
const SOLID_START = 0.25;
/** how far it rises as the page scrolls, as a share of the scroll: far 0.1, near 0.4 */
const scrollShare = (depth: number) => 0.1 + 0.3 * depth;

interface Sprite {
  w: number;
  h: number;
  /** per cell: coverage 0..1 and tone 0..1 (0 shadow, 1 light) */
  alpha: Float32Array;
  tone: Float32Array;
  /** per cell: 0 at the cloud's edge (all dots) .. 1 in its core (smooth) */
  solid: Float32Array;
}

/**
 * How deep inside the cloud each cell is: a two-pass chamfer distance to the
 * nearest clear cell (alpha under 0.1; outside the picture counts as clear).
 * The innermost SOLID_SHARE of the cloud's cells print smooth, and from
 * there out to the edge it breaks gradually into dots.
 */
function solidity(alpha: Float32Array, w: number, h: number): Float32Array {
  const n = w * h;
  const d = new Float32Array(n);
  const BIG = 1e9;
  const A = 1; // straight step
  const B = Math.SQRT2; // diagonal step
  for (let i = 0; i < n; i++) d[i] = alpha[i] > 0.1 ? BIG : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      d[i] = Math.min(d[i], at(x - 1, y) + A, at(x, y - 1) + A, at(x - 1, y - 1) + B, at(x + 1, y - 1) + B);
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      d[i] = Math.min(d[i], at(x + 1, y) + A, at(x, y + 1) + A, at(x + 1, y + 1) + B, at(x - 1, y + 1) + B);
    }
  }
  // the depth that the innermost share of the cloud reaches past
  const inside: number[] = [];
  for (let i = 0; i < n; i++) if (d[i]) inside.push(d[i]);
  const solid = new Float32Array(n);
  if (!inside.length) return solid;
  inside.sort((p, q) => p - q);
  const core = Math.max(1.5, inside[Math.floor(inside.length * (1 - SOLID_SHARE))]);
  const start = core * SOLID_START;
  for (let i = 0; i < n; i++) {
    if (!d[i]) continue;
    solid[i] = smooth(start, core, d[i]);
  }
  return solid;
}

/** a mouse, and no touchscreen: only then do the clouds follow the pointer */
const mouseOnly = (() => {
  try {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    return () => mq.matches && !(navigator.maxTouchPoints > 0);
  } catch {
    return () => false;
  }
})();

const reducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Shrinks a cloud picture to one pixel per cell and reads it as coverage and tone. */
function makeSprite(img: HTMLImageElement, cellsW: number, flip: boolean): Sprite | null {
  const w = Math.max(2, Math.round(cellsW));
  const h = Math.max(2, Math.round((cellsW * img.naturalHeight) / img.naturalWidth));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (flip) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const n = w * h;
  const alpha = new Float32Array(n);
  const lum = new Float32Array(n);
  // the renders are grey on grey: stretch the cloud's own shading to the full range
  let lo = 1;
  let hi = 0;
  for (let i = 0; i < n; i++) {
    // a little fuller than the render: solid cores, with the dither left to the edges
    const a = Math.pow(px[i * 4 + 3] / 255, 0.75);
    alpha[i] = a;
    // canvas pixels come back un-premultiplied, so this is the cloud's own shade
    const l = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
    lum[i] = l;
    if (a > 0.25) {
      if (l < lo) lo = l;
      if (l > hi) hi = l;
    }
  }
  const span = Math.max(0.05, hi - lo);
  const tone = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    // thin edges read as light catching them, like the reference's rims,
    // and the sun is overhead: tops a shade lighter, undersides a shade darker
    const t = (lum[i] - lo) / span;
    const up = 0.5 - Math.floor(i / w) / h;
    tone[i] = Math.max(0, Math.min(1, t * 0.8 + (1 - alpha[i]) * 0.25 + up * 0.3));
  }
  return { w, h, alpha, tone, solid: solidity(alpha, w, h) };
}

export const Clouds: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  const softRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const softCanvas = softRef.current;
    if (!canvas || !softCanvas) return;
    const ctx = canvas.getContext("2d");
    const softCtx = softCanvas.getContext("2d");
    if (!ctx || !softCtx) return;

    const imgs = CLOUDS.map(() => new Image());
    let sprites: (Sprite | null)[] = CLOUDS.map(() => null);
    let W = 1;
    let H = 1;
    let image: ImageData | null = null;
    let soft: ImageData | null = null;
    /** per column and row: how strongly clouds print there (quiet over the reading column) */
    let colW = new Float32Array(1);
    let rowW = new Float32Array(1);
    let inks: [number, number, number][] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    let drawnW = 0;
    let drawnH = 0;
    // last state drawn, to skip frames where nothing moved by a cell
    const offsets = new Int32Array(CLOUDS.length * 2).fill(-1e9);
    let clock = { secs: 0, lx: 0, ly: 0, sy: 0, sx: 0 };
    let lastAt = -Infinity;

    const readInks = () => {
      const css = getComputedStyle(document.documentElement);
      const ink = (name: string, fallback: string) => hexToRgb(css.getPropertyValue(name) || fallback);
      inks = [ink("--cloud-shadow", "#1b2240"), ink("--cloud-mid", "#5f7584"), ink("--cloud-light", "#f1e4cc")];
    };

    const build = () => {
      W = Math.max(1, Math.ceil(window.innerWidth / CELL));
      H = Math.max(1, Math.ceil(window.innerHeight / CELL));
      drawnW = window.innerWidth;
      drawnH = window.innerHeight;
      canvas.width = softCanvas.width = W;
      canvas.height = softCanvas.height = H;
      image = ctx.createImageData(W, H);
      soft = softCtx.createImageData(W, H);
      colW = new Float32Array(W);
      for (let x = 0; x < W; x++) {
        // a quarter strength down the middle, full at the sides
        colW[x] = 0.22 + 0.78 * smooth(0.12, 0.42, Math.abs(x / W - 0.5));
      }
      rowW = new Float32Array(H);
      for (let y = 0; y < H; y++) {
        // and a band along the top that prints at most two thirds
        rowW[y] = 0.62 * (1 - smooth(0.04, 0.26, y / H));
      }
      const unit = Math.max(W, H);
      sprites = CLOUDS.map((c, i) =>
        imgs[i].naturalWidth ? makeSprite(imgs[i], c.size * unit, !!c.flip) : null,
      );
      offsets.fill(-1e9);
    };

    /** where each cloud's top-left cell is now; true when any moved */
    const place = () => {
      const lean = mouseOnly();
      let moved = false;
      CLOUDS.forEach((c, i) => {
        const s = sprites[i];
        if (!s) return;
        const span = W + s.w;
        const travel = (clock.secs / crossing(c.depth)) * W + (clock.sx * scrollShare(c.depth)) / CELL;
        let x = (((c.x * span + travel) % span) + span) % span - s.w;
        // rising with the page, slower the further back; one that leaves at
        // the top comes round again from the bottom, so a long page has sky too
        const vspan = H + s.h;
        const rise = (clock.sy * scrollShare(c.depth)) / CELL;
        let y = ((((c.y * H + s.h - rise) % vspan) + vspan) % vspan) - s.h;
        if (lean) {
          x += (clock.lx * LEAN[0] * c.depth) / CELL;
          y += (clock.ly * LEAN[1] * c.depth) / CELL;
        }
        // whole cells only: the cloud moves, the dots don't
        const ox = Math.round(x);
        const oy = Math.round(y);
        if (offsets[i * 2] !== ox || offsets[i * 2 + 1] !== oy) moved = true;
        offsets[i * 2] = ox;
        offsets[i * 2 + 1] = oy;
      });
      return moved;
    };

    const paint = () => {
      if (!image || !soft) return;
      const dot = image.data;
      const sm = soft.data;
      dot.fill(0);
      sm.fill(0);
      const [shadow, mid, light] = inks;
      CLOUDS.forEach((c, i) => {
        const s = sprites[i];
        if (!s) return;
        const ox = offsets[i * 2];
        const oy = offsets[i * 2 + 1];
        // a cloud wrapping off the right edge shows again at the left
        for (const shift of [0, -(W + s.w)]) {
          const x0 = Math.max(0, ox + shift);
          const x1 = Math.min(W, ox + shift + s.w);
          if (x1 <= x0) continue;
          const y0 = Math.max(0, oy);
          const y1 = Math.min(H, oy + s.h);
          for (let y = y0; y < y1; y++) {
            const sRow = (y - oy) * s.w - (ox + shift);
            const rw = rowW[y];
            const b = (y & 7) * 8;
            for (let x = x0; x < x1; x++) {
              const si = sRow + x;
              const a = s.alpha[si];
              if (a < 0.02) continue;
              const cover = a * c.k * Math.max(colW[x], rw);
              // how solid it is here, by how far in from the cloud's edge:
              // the edges are all dots, the core all smooth shading, and in
              // between some of each
              const m = s.solid[si];
              const o = (y * W + x) * 4;
              const v = s.tone[si];

              if (m > 0) {
                // the smooth part: the cloud's own shading through the three
                // inks, laid over whatever cloud is behind it
                const lo = v < 0.5 ? shadow : mid;
                const hi = v < 0.5 ? mid : light;
                const f = v < 0.5 ? v * 2 : v * 2 - 1;
                const sa = cover * m;
                const da = sm[o + 3] / 255;
                const oa = sa + da * (1 - sa);
                const keep = (da * (1 - sa)) / oa;
                for (let ch = 0; ch < 3; ch++) {
                  const col = lo[ch] + (hi[ch] - lo[ch]) * f;
                  sm[o + ch] = col * (sa / oa) + sm[o + ch] * keep;
                }
                sm[o + 3] = oa * 255;
                // and it hides the dots of clouds behind it
                if (dot[o + 3]) dot[o + 3] *= 1 - sa;
              }

              if (m < 1) {
                const t = BAYER[b + (x & 7)];
                if (cover <= t) continue;
                // the tone dithered too, between the two inks it falls between,
                // against the matrix turned half over so it doesn't echo the coverage
                const v2 = v * 2;
                const u = BAYER[b + ((x + 4) & 7)];
                const ink = v2 < 1 ? (v2 > u ? mid : shadow) : v2 - 1 > u ? light : mid;
                dot[o] = ink[0];
                dot[o + 1] = ink[1];
                dot[o + 2] = ink[2];
                dot[o + 3] = 255 * (1 - m);
              }
            }
          }
        }
      });
      ctx.putImageData(image, 0, 0);
      softCtx.putImageData(soft, 0, 0);
    };

    const ready = () => sprites.some(Boolean);
    const redraw = () => {
      if (effectsChoice() === "reduced" || !ready()) return;
      place();
      paint();
    };

    const tick: CloudTick = (secs, lx, ly, sy, fast, now, sx = 0) => {
      if (document.hidden || effectsChoice() === "reduced" || !ready()) return;
      // while the page scrolls, every frame; otherwise a few times a second at most
      if (!fast && now - lastAt < MIN_GAP) return;
      clock = { secs, lx, ly, sy, sx };
      if (!place()) return;
      lastAt = now;
      paint();
    };
    // standing still: drawn where the clock would have them now, then left be
    const still = reducedMotion();
    if (!still) cloudTicks.add(tick);

    readInks();
    build();
    imgs.forEach((img, i) => {
      img.decoding = "async";
      img.onload = () => {
        sprites[i] = makeSprite(img, CLOUDS[i].size * Math.max(W, H), !!CLOUDS[i].flip);
        offsets.fill(-1e9);
        redraw();
      };
      img.src = `${BASE}clouds/${CLOUDS[i].src}.webp`;
    });

    let t = 0;
    const onResize = () => {
      // a phone's address bar sliding is a resize on every scroll: skip small ones
      if (window.innerWidth === drawnW && Math.abs(window.innerHeight - drawnH) < 160) return;
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        build();
        redraw();
      }, 150);
    };
    window.addEventListener("resize", onResize);
    const offTheme = onThemeChange(() => {
      readInks();
      offsets.fill(-1e9);
      redraw();
    });
    const offEffects = onEffectsChange(() => {
      offsets.fill(-1e9);
      redraw();
    });
    return () => {
      cloudTicks.delete(tick);
      window.clearTimeout(t);
      window.removeEventListener("resize", onResize);
      offTheme();
      offEffects();
      imgs.forEach((img) => (img.onload = null));
    };
  }, []);

  // two canvases on the same cells: the smooth one scaled up softly, the dots hard
  return (
    <>
      <canvas ref={softRef} className="jqzz-clouds soft" aria-hidden="true" />
      <canvas ref={ref} className="jqzz-clouds" aria-hidden="true" />
    </>
  );
};
