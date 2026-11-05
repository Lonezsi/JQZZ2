/*
 * The fun group: brushes that don't pretend to be paint. A dither pen on the
 * background's own grid, stamps of the site's star and the font's dagger, an
 * RGB split that pulls the colours apart under the pen, and a pixel sorter.
 */
import { BAYER } from "../components/common/dither";
import { softTip, type Brush, type Knob } from "./brushes";

// ─── dither pen: halftone on the background's grid ─────────────────

/**
 * Prints in square cells the size the background's dither has on screen at
 * the zoom the stroke starts at, on one grid across the sheet, through the
 * same 8x8 Bayer pattern: pressing harder fills more of the cells.
 */
export const dither: Brush = {
  id: "dither",
  label: "dither pen",
  key: "d",
  kind: "dabs",
  spacing: 0.2,
  smoothing: 0.3,
  size: { min: 8, max: 160, start: 40 },
  opacity: 1,
  composite: "source-over",
  live: 1,
  reach: 1,
  mirrors: true,
  knobs: [
    { id: "dots", label: "dot size", min: 1, max: 4, step: 1, start: 1, show: (v) => `${v}×` },
    { id: "fill", label: "fill", min: 20, max: 200, step: 5, start: 100, show: (v) => `${v}%` },
  ],
  dab(s, d) {
    const c = Math.max(1, s.cell * s.knobs.dots);
    const r = (s.size / 2) * (0.6 + 0.4 * d.p);
    const { ctx } = s;
    ctx.fillStyle = s.color;
    // how full the cells get: the pen's pressure, fading to the edge of the tip
    const x0 = Math.floor((d.x - r) / c);
    const x1 = Math.ceil((d.x + r) / c);
    const y0 = Math.floor((d.y - r) / c);
    const y1 = Math.ceil((d.y + r) / c);
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const cx = (gx + 0.5) * c;
        const cy = (gy + 0.5) * c;
        const dist = Math.hypot(cx - d.x, cy - d.y) / r;
        if (dist > 1) continue;
        const level = d.p * (1 - dist * dist * 0.6) * (s.knobs.fill / 100);
        const t = BAYER[(((gy % 8) + 8) % 8) * 8 + (((gx % 8) + 8) % 8)];
        if (level > t) ctx.fillRect(gx * c, gy * c, c, c);
      }
    }
  },
};

// ─── stamps: the star, the dagger ───────────────────────────────────

/** the site's four-point star (index.css --star), in a 24 box */
const STAR = new Path2D("M12 0C12.6 7.2 16.8 11.4 24 12 16.8 12.6 12.6 16.8 12 24 11.4 16.8 7.2 12.6 0 12 7.2 11.4 11.4 7.2 12 0Z");

/** how far apart a stamp's marks go, how much each is turned, and how far off the line */
const stampKnobs = (spacing: number): Knob[] => [
  { id: "spacing", label: "spacing", min: 40, max: 400, step: 5, start: spacing, show: (v) => `${v}%` },
  { id: "tilt", label: "tilt", min: 0, max: 180, step: 5, start: 15, show: (v) => `${v}°` },
  { id: "scatter", label: "scatter", min: 0, max: 100, step: 5, start: 0, show: (v) => `${v}%` },
];

/** stamps a shape every so far along the stroke, sized by pressure */
function stamp(draw: (ctx: CanvasRenderingContext2D, size: number) => void): Pick<Brush, "dab"> {
  return {
    dab(s, d) {
      const { ctx } = s;
      const size = s.size * (0.55 + 0.45 * d.p);
      // knocked off the line a little, and turned a little either way: stamped by hand
      const off = (s.knobs.scatter / 100) * s.size;
      const a = s.rand() * Math.PI * 2;
      const r = Math.sqrt(s.rand()) * off;
      ctx.translate(d.x + Math.cos(a) * r, d.y + Math.sin(a) * r);
      ctx.rotate((s.rand() - 0.5) * ((s.knobs.tilt * Math.PI) / 180));
      ctx.fillStyle = s.color;
      draw(ctx, size);
    },
  };
}

export const star: Brush = {
  id: "star",
  label: "star stamp",
  key: "t",
  kind: "dabs",
  spacing: 1.25,
  smoothing: 0.4,
  size: { min: 10, max: 240, start: 48 },
  opacity: 1,
  composite: "source-over",
  live: 1,
  reach: 1.8,
  mirrors: true,
  knobs: stampKnobs(125),
  ...stamp((ctx, size) => {
    ctx.scale(size / 24, size / 24);
    ctx.translate(-12, -12);
    ctx.fill(STAR);
  }),
};

// the font's dagger needs the font: ask for it as soon as this is loaded
if (typeof document !== "undefined") document.fonts?.load('64px "Fomt"', "†").catch(() => {});

export const dagger: Brush = {
  id: "dagger",
  label: "dagger stamp",
  key: "x",
  kind: "dabs",
  spacing: 1.1,
  smoothing: 0.4,
  size: { min: 14, max: 260, start: 64 },
  opacity: 1,
  composite: "source-over",
  live: 1,
  reach: 1.9,
  mirrors: true,
  knobs: stampKnobs(110),
  ...stamp((ctx, size) => {
    ctx.font = `${Math.round(size)}px "Fomt", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("†", 0, size * 0.05);
  }),
};

// ─── RGB split: the colours pulled apart under the pen ──────────────

const scratch = (() => {
  const make = () => {
    const c = document.createElement("canvas");
    return { c, x: c.getContext("2d")! };
  };
  let made: ReturnType<typeof make>[] | null = null;
  return () => (made ??= [make(), make(), make()]);
})();

/**
 * Takes what's under the tip, splits it into red, green and blue, and puts
 * them back a little apart across the stroke: red one way, blue the other.
 * All in canvas operations (on the graphics card): nothing is read back.
 */
export const rgbsplit: Brush = {
  id: "rgbsplit",
  label: "RGB split",
  key: "r",
  kind: "dabs",
  spacing: 0.25,
  smoothing: 0.3,
  size: { min: 10, max: 200, start: 50 },
  opacity: 1,
  composite: "source-over",
  live: 1,
  reach: 2,
  direct: true,
  mirrors: false,
  knobs: [
    { id: "split", label: "split", min: 2, max: 60, step: 1, start: 12, show: (v) => `${v}%` },
    { id: "angle", label: "direction", min: 0, max: 180, step: 5, start: 0, show: (v) => (v === 0 ? "with the line" : `${v}°`) },
  ],
  dab(s, d) {
    const r = Math.max(4, Math.round((s.size / 2) * (0.6 + 0.4 * d.p)));
    const k = Math.max(1, Math.round(s.size * (s.knobs.split / 100) * (0.5 + d.p)));
    const w = r * 2 + k * 2;
    const [src, chan, out] = scratch();
    for (const b of [src, chan, out]) {
      if (b.c.width !== w || b.c.height !== w) b.c.width = b.c.height = w;
    }
    // what's under the tip, with a margin for the shift
    src.x.globalCompositeOperation = "copy";
    src.x.drawImage(s.paint, d.x - r - k, d.y - r - k, w, w, 0, 0, w, w);
    // across the stroke (or at a set angle): red goes one way, blue the other
    const toward = s.knobs.angle === 0 ? d.angle + Math.PI / 2 : (s.knobs.angle * Math.PI) / 180;
    const nx = Math.cos(toward) * k;
    const ny = Math.sin(toward) * k;
    out.x.globalCompositeOperation = "copy";
    out.x.clearRect(0, 0, w, w);
    out.x.globalCompositeOperation = "lighter";
    for (const [colour, dx, dy] of [
      ["#ff0000", nx, ny],
      ["#00ff00", 0, 0],
      ["#0000ff", -nx, -ny],
    ] as const) {
      // one channel of it, kept where the paint is
      chan.x.globalCompositeOperation = "copy";
      chan.x.drawImage(src.c, 0, 0);
      chan.x.globalCompositeOperation = "multiply";
      chan.x.fillStyle = colour;
      chan.x.fillRect(0, 0, w, w);
      chan.x.globalCompositeOperation = "destination-in";
      chan.x.drawImage(src.c, 0, 0);
      out.x.drawImage(chan.c, dx, dy);
    }
    // only under the tip, soft at its edge
    out.x.globalCompositeOperation = "destination-in";
    out.x.drawImage(softTip("#000000", 0.55), k, k, r * 2, r * 2);
    s.ctx.globalAlpha = s.opacity;
    s.ctx.globalCompositeOperation = "destination-out";
    s.ctx.drawImage(softTip("#000000", 0.55), d.x - r, d.y - r, r * 2, r * 2);
    s.ctx.globalCompositeOperation = "source-over";
    s.ctx.drawImage(out.c, d.x - r - k, d.y - r - k);
  },
};

// ─── pixel sorter ──────────────────────────────────────────────────

const light = (d: Uint8ClampedArray, i: number) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

/**
 * Sorts the pixels under the tip by brightness, in runs along the way the
 * pen is going: the glitch look. Only the middling ones move (the darkest and
 * brightest stay where they are), which is what keeps the shapes in it.
 */
export const pixelsort: Brush = {
  id: "pixelsort",
  label: "pixel sorter",
  key: "o",
  kind: "dabs",
  spacing: 0.5,
  smoothing: 0.4,
  size: { min: 10, max: 200, start: 60 },
  opacity: 1,
  composite: "source-over",
  live: 1,
  reach: 1,
  direct: true,
  mirrors: false,
  knobs: [
    { id: "from", label: "from", min: 0, max: 255, step: 1, start: 30, show: (v) => `${Math.round((v / 255) * 100)}%` },
    { id: "to", label: "to", min: 0, max: 255, step: 1, start: 235, show: (v) => `${Math.round((v / 255) * 100)}%` },
    { id: "across", label: "sorts", min: 0, max: 1, step: 1, start: 0, show: (v) => (v ? "across the line" : "along the line") },
  ],
  dab(s, d) {
    const r = Math.max(4, Math.round((s.size / 2) * (0.6 + 0.4 * d.p)));
    const x0 = Math.max(0, Math.round(d.x - r));
    const y0 = Math.max(0, Math.round(d.y - r));
    const w = Math.min(s.paint.width - x0, r * 2);
    const h = Math.min(s.paint.height - y0, r * 2);
    if (w < 2 || h < 2) return;
    const img = s.ctx.getImageData(x0, y0, w, h);
    const px = img.data;
    // the way the pen goes, or (across) the other way
    const flat = Math.abs(Math.cos(d.angle)) >= Math.abs(Math.sin(d.angle));
    const along = s.knobs.across ? !flat : flat;
    const lo = Math.min(s.knobs.from, s.knobs.to);
    const hi = Math.max(s.knobs.from, s.knobs.to);
    const forward = along ? Math.cos(d.angle) >= 0 : Math.sin(d.angle) >= 0;
    const lines = along ? h : w;
    const length = along ? w : h;
    const at = (line: number, i: number) => (along ? line * w + i : i * w + line) * 4;
    const inside = (line: number, i: number) => {
      const x = along ? i : line;
      const y = along ? line : i;
      return Math.hypot(x - r, y - r) <= r;
    };
    const run: number[][] = [];
    const flush = (line: number, from: number) => {
      if (run.length > 1) {
        run.sort((a, b) => (forward ? a[4] - b[4] : b[4] - a[4]));
        run.forEach((p, j) => px.set(p.slice(0, 4), at(line, from + j)));
      }
      run.length = 0;
    };
    for (let line = 0; line < lines; line++) {
      let start = 0;
      for (let i = 0; i < length; i++) {
        const o = at(line, i);
        const l = light(px, o);
        // a run is the middling, painted pixels inside the tip
        if (inside(line, i) && px[o + 3] > 20 && l >= lo && l <= hi) {
          if (!run.length) start = i;
          run.push([px[o], px[o + 1], px[o + 2], px[o + 3], l]);
        } else flush(line, start);
      }
      flush(line, start);
    }
    s.ctx.putImageData(img, x0, y0);
  },
};

export const FUN: Brush[] = [dither, star, dagger, rgbsplit, pixelsort];
