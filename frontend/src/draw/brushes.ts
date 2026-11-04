/*
 * The brushes. Each one is a way of putting marks down, modelled on the real
 * thing: what its tip is shaped like, how pressure and speed change it, and
 * how its marks sit on the paper and on each other.
 *
 * Every stroke is drawn into its own buffer first (the "wet" layer) and
 * joins the drawing when the pen lifts, in the brush's own way: a marker
 * multiplies, so overlapping strokes darken but one stroke never darkens
 * itself; watercolour pools at its edges as it dries; an eraser takes away.
 * The smudge stick is the one tool that works on the drawing directly.
 */
import { grainTile, hexOf, rgbOf, shade, type GrainId } from "./paper";
import { FUN } from "./funBrushes";
import { mix } from "./oklab";

export type ToolId =
  | "pencil"
  | "ink"
  | "marker"
  | "crayon"
  | "charcoal"
  | "paint"
  | "watercolor"
  | "airbrush"
  | "smudge"
  | "eraser"
  | "fill"
  | "pick"
  | "dither"
  | "star"
  | "dagger"
  | "rgbsplit"
  | "pixelsort";

/** one point along a stroke, after smoothing */
export interface Dab {
  x: number;
  y: number;
  /** pressure, real or worked out from speed, 0..1 */
  p: number;
  /** direction of travel, radians */
  angle: number;
  /** px per ms */
  speed: number;
  /** how far the pen leans, 0 upright .. 1 flat */
  tilt: number;
  /** which way it leans, radians */
  tiltAngle: number;
  /** distance from the previous dab */
  step: number;
}

export interface Stroke {
  /** the wet layer, or the drawing itself for direct tools */
  ctx: CanvasRenderingContext2D;
  color: string;
  size: number;
  opacity: number;
  /** this stroke's own random numbers, so it can be drawn again the same */
  rand: () => number;
  /** whatever the brush keeps between dabs (bristles, the smudge's last spot) */
  state: Record<string, unknown>;
  /** the drawing so far, for tools that pick up what's already there */
  paint: HTMLCanvasElement;
  /** drawing the mirrored half: don't move the brush's own state along */
  mirrored: boolean;
  /** the sheet's width, to keep the grain on the mirrored half where the sheet has it */
  width: number;
  /** the background's dither cell, in sheet pixels at the zoom the stroke started at (the dither pen) */
  cell: number;
}

export interface Brush {
  id: ToolId;
  label: string;
  /** keyboard shortcut */
  key: string;
  /** dabs: one mark per step; path: the whole stroke redrawn as one shape; tool: fill or pick */
  kind: "dabs" | "path" | "tool";
  /** gap between dabs, as a share of the size */
  spacing: number;
  /** how much the line is steadied, 0..1 */
  smoothing: number;
  size: { min: number; max: number; start: number };
  opacity: number;
  /** how the finished stroke joins the drawing */
  composite: GlobalCompositeOperation;
  /** how the wet stroke looks while it's still being drawn, as a share of its opacity */
  live: number;
  /** how far marks reach past the size, for knowing what changed */
  reach: number;
  /** keeps spraying while held still */
  idle?: boolean;
  /**
   * dry media: however often the stroke goes over a spot, the paper's
   * valleys never fill more than this grain lets them
   */
  grainCap?: { grain: GrainId; bite: number };
  /** works on the drawing itself, not the wet layer */
  direct?: boolean;
  /** a stroke can be mirrored */
  mirrors: boolean;
  begin?(s: Stroke, d: Dab): void;
  dab?(s: Stroke, d: Dab): void;
  /** path brushes: draw the whole stroke so far */
  path?(s: Stroke, dabs: Dab[], done: boolean): void;
  /** after the pen lifts: what joins the drawing, made from the wet layer's area */
  dry?(s: Stroke, wet: HTMLCanvasElement, area: Area): HTMLCanvasElement;
}

export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

const TAU = Math.PI * 2;

/** what's on a sheet at a point: red, green, blue, alpha (0..255), or null off it */
type Sampler = (x: number, y: number) => Uint8ClampedArray | null;

/**
 * A sheet read once, at 1/scale its size, to look up colours on it as often
 * as wanted: reading the real thing back pixel by pixel would stall the
 * graphics card on every dab. Null when it can't be read.
 */
function sampler(src: HTMLCanvasElement, scale: number): Sampler | null {
  const w = Math.max(1, Math.ceil(src.width / scale));
  const h = Math.max(1, Math.ceil(src.height / scale));
  try {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(src, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    return (x, y) => {
      const cx = Math.floor(x / scale);
      const cy = Math.floor(y / scale);
      if (cx < 0 || cy < 0 || cx >= w || cy >= h) return null;
      const i = (cy * w + cx) * 4;
      return data.subarray(i, i + 4);
    };
  } catch {
    return null;
  }
}

/** a round tip with a soft edge, in one colour; hardness 1 is a crisp disc */
const tips = new Map<string, HTMLCanvasElement>();
export function softTip(color: string, hardness: number): HTMLCanvasElement {
  const key = `${color}|${hardness}`;
  const have = tips.get(key);
  if (have) return have;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const [r, g, b] = rgbOf(color);
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
  grad.addColorStop(Math.min(0.98, hardness), `rgba(${r},${g},${b},${hardness > 0.5 ? 1 : 0.6})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  if (tips.size > 32) tips.delete(tips.keys().next().value!);
  tips.set(key, c);
  return c;
}

/** the grain as a fill, anchored to the sheet so it doesn't travel with the brush */
function grainFill(s: Stroke, id: GrainId, bite: number): CanvasPattern {
  const q = Math.round(Math.max(0.05, Math.min(1, bite)) * 10) / 10;
  const key = `pattern:${id}:${q}`;
  let p = s.state[key] as CanvasPattern | undefined;
  if (!p) {
    p = s.ctx.createPattern(grainTile(id, s.color, q), "repeat")!;
    s.state[key] = p;
  }
  // the mirrored half is drawn through a flipped transform: flip the grain back
  p.setTransform(s.mirrored ? new DOMMatrix([-1, 0, 0, 1, s.width, 0]) : new DOMMatrix());
  return p;
}

/** a ragged blob: charcoal and crayon tips aren't circles */
function ragged(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, turn: number,
  rough: number, rand: () => number, corners = 9) {
  ctx.beginPath();
  for (let i = 0; i < corners; i++) {
    const a = (i / corners) * TAU;
    const k = 1 - rough / 2 + rand() * rough;
    const px = Math.cos(a) * rx * k;
    const py = Math.sin(a) * ry * k;
    const cx = x + px * Math.cos(turn) - py * Math.sin(turn);
    const cy = y + px * Math.sin(turn) + py * Math.cos(turn);
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  }
  ctx.closePath();
}

// ─── pencil: graphite on drawing paper ───────────────────────────────

const pencil: Brush = {
  id: "pencil",
  label: "pencil",
  key: "p",
  kind: "dabs",
  spacing: 0.14,
  smoothing: 0.35,
  size: { min: 1, max: 18, start: 5 },
  opacity: 0.9,
  composite: "source-over",
  live: 1,
  reach: 2,
  mirrors: true,
  grainCap: { grain: "fine", bite: 0.68 },
  dab(s, d) {
    const { ctx } = s;
    // the point wears down as it goes: a long line ends a little wider than it began
    const worn = Math.min(0.18, ((s.state.travel as number) ?? 0) / 9000);
    if (!s.mirrored) s.state.travel = ((s.state.travel as number) ?? 0) + d.step;
    const r = Math.max(0.6, (s.size / 2) * (0.55 + 0.45 * d.p) * (1 + worn));
    // a fast line skims the paper and leaves less behind
    const skim = Math.min(1, Math.max(0.55, 1.15 - d.speed * 0.25));
    // pressing harder pushes graphite down into the paper's valleys
    ctx.fillStyle = grainFill(s, "fine", 0.45 + 0.45 * d.p);
    ctx.globalAlpha = s.opacity * (0.34 + 0.56 * d.p) * skim;
    const jx = (s.rand() - 0.5) * 0.5;
    const jy = (s.rand() - 0.5) * 0.5;
    ctx.beginPath();
    if (d.tilt > 0.25) {
      // a leaning pencil shades with its side: a long, soft mark
      const long = r * (1 + (d.tilt - 0.25) * 4);
      ctx.ellipse(d.x + jx, d.y + jy, long, r, d.tiltAngle, 0, TAU);
    } else {
      ctx.arc(d.x + jx, d.y + jy, r, 0, TAU);
    }
    ctx.fill();
    // graphite goes down in fine scratches along the line, not in round blots
    if (d.step > 0 && r > 1) {
      const ux = Math.cos(d.angle);
      const uy = Math.sin(d.angle);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineCap = "round";
      for (let i = 0; i < 3; i++) {
        const off = (s.rand() - 0.5) * r * 1.6;
        const len = d.step * (0.8 + s.rand() * 0.9);
        const sx = d.x - uy * off;
        const sy = d.y + ux * off;
        ctx.globalAlpha = s.opacity * (0.12 + 0.35 * d.p) * skim * s.rand();
        ctx.lineWidth = 0.35 + s.rand() * 0.5;
        ctx.beginPath();
        ctx.moveTo(sx - ux * len, sy - uy * len);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }
    }
  },
};

// ─── ink: a brush pen, thin when fast, tapering at both ends ─────────

/** the stroke's outline, as one shape: round at every point, joined by quads */
function inkShape(ctx: CanvasRenderingContext2D, dabs: Dab[], widths: number[]) {
  ctx.beginPath();
  for (let i = 0; i < dabs.length; i++) {
    const a = dabs[i];
    const ra = widths[i] / 2;
    ctx.moveTo(a.x + ra, a.y);
    ctx.arc(a.x, a.y, ra, 0, TAU);
    if (i === 0) continue;
    const b = dabs[i - 1];
    const rb = widths[i - 1] / 2;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    // always wound the same way, so overlaps don't punch holes
    ctx.moveTo(b.x + nx * rb, b.y + ny * rb);
    ctx.lineTo(a.x + nx * ra, a.y + ny * ra);
    ctx.lineTo(a.x - nx * ra, a.y - ny * ra);
    ctx.lineTo(b.x - nx * rb, b.y - ny * rb);
    ctx.closePath();
  }
  ctx.fill("nonzero");
}

const ink: Brush = {
  id: "ink",
  label: "ink",
  key: "i",
  kind: "path",
  spacing: 0.08,
  smoothing: 0.55,
  size: { min: 1, max: 48, start: 8 },
  opacity: 1,
  composite: "source-over",
  live: 1,
  reach: 1,
  mirrors: true,
  path(s, dabs, done) {
    if (!dabs.length) return;
    const { ctx } = s;
    let total = 0;
    const along = dabs.map((d) => (total += d.step));
    const taper = Math.min(s.size * 4, total * 0.3);
    const widths = dabs.map((d, i) => {
      // ink lays down a fine line when the pen moves fast
      const thin = 1 / (1 + d.speed * 0.35);
      let w = s.size * (0.16 + 0.84 * Math.pow(d.p, 0.85)) * (0.55 + 0.45 * thin);
      if (taper > 0) {
        const fromStart = along[i] / taper;
        if (fromStart < 1) w *= 0.25 + 0.75 * Math.sin((fromStart * Math.PI) / 2);
        if (done) {
          const fromEnd = (total - along[i]) / taper;
          if (fromEnd < 1) w *= 0.12 + 0.88 * Math.sin((fromEnd * Math.PI) / 2);
        }
      }
      return Math.max(0.5, w);
    });
    ctx.fillStyle = s.color;
    ctx.globalAlpha = 1;
    inkShape(ctx, dabs, widths);
  },
};

// ─── marker: a felt tip; overlapping strokes darken, one stroke doesn't ─

const marker: Brush = {
  id: "marker",
  label: "marker",
  key: "m",
  kind: "dabs",
  spacing: 0.06,
  smoothing: 0.45,
  size: { min: 4, max: 90, start: 24 },
  opacity: 0.7,
  composite: "multiply",
  live: 1,
  reach: 1,
  mirrors: true,
  dab(s, d) {
    const { ctx } = s;
    // a chisel tip held at a slant: broad one way, narrow the other
    const r = (s.size / 2) * (0.85 + 0.15 * d.p);
    ctx.fillStyle = s.color;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.ellipse(d.x, d.y, r, r * 0.42, -0.62, 0, TAU);
    ctx.fill();
  },
};

// ─── crayon: wax dragged over the ridges of the sheet ────────────────

const crayon: Brush = {
  id: "crayon",
  label: "crayon",
  key: "y",
  kind: "dabs",
  spacing: 0.08,
  smoothing: 0.3,
  size: { min: 4, max: 60, start: 18 },
  opacity: 1,
  composite: "source-over",
  live: 1,
  reach: 1.2,
  mirrors: true,
  grainCap: { grain: "wax", bite: 0.58 },
  dab(s, d) {
    const { ctx } = s;
    const r = (s.size / 2) * (0.75 + 0.25 * d.p);
    ctx.fillStyle = grainFill(s, "wax", 0.28 + 0.36 * d.p);
    ctx.globalAlpha = s.opacity * (0.42 + 0.38 * d.p);
    ragged(ctx, d.x, d.y, r, r * 0.8, d.angle, 0.22, s.rand, 8);
    ctx.fill();
  },
};

// ─── charcoal: soft, dusty, catching only the tooth of the paper ─────

const charcoal: Brush = {
  id: "charcoal",
  label: "charcoal",
  key: "c",
  kind: "dabs",
  spacing: 0.1,
  smoothing: 0.3,
  size: { min: 6, max: 120, start: 30 },
  opacity: 0.85,
  composite: "source-over",
  live: 1,
  reach: 1.6,
  mirrors: true,
  grainCap: { grain: "tooth", bite: 0.72 },
  dab(s, d) {
    const { ctx } = s;
    const r = (s.size / 2) * (0.6 + 0.4 * d.p);
    ctx.fillStyle = grainFill(s, "tooth", 0.28 + 0.55 * d.p);
    // a stick dragged on its side: wide across the stroke, with a ragged edge
    ctx.globalAlpha = s.opacity * (0.16 + 0.34 * d.p);
    ragged(ctx, d.x, d.y, r * 0.55, r, d.angle, 0.45, s.rand, 10);
    ctx.fill();
    ctx.globalAlpha = s.opacity * (0.07 + 0.12 * d.p);
    ragged(ctx, d.x, d.y, r * 0.8, r * 1.25, d.angle, 0.6, s.rand, 10);
    ctx.fill();
    // dust falling off the stick
    if (s.rand() < 0.4) {
      const a = s.rand() * TAU;
      const dist = r * (1 + s.rand() * 0.6);
      const dot = 0.6 + s.rand() * 1.4;
      ctx.globalAlpha = s.opacity * 0.35;
      ctx.fillRect(d.x + Math.cos(a) * dist, d.y + Math.sin(a) * dist, dot, dot);
    }
  },
};

// ─── paint: a bristle brush that runs dry ───────────────────────────

interface Bristle {
  off: number;
  width: number;
  color: string;
  /** some bristles carry a light ridge of paint along them */
  ridge: string | null;
  /** how much paint it holds, 1 full .. 0 dry */
  load: number;
  rate: number;
  lx: number | null;
  ly: number | null;
}

const paint: Brush = {
  id: "paint",
  label: "paint",
  key: "b",
  kind: "dabs",
  spacing: 0.05,
  smoothing: 0.4,
  size: { min: 6, max: 120, start: 30 },
  opacity: 1,
  composite: "source-over",
  live: 1,
  reach: 1.2,
  mirrors: true,
  begin(s, d) {
    // the sheet as the stroke finds it, small: what the bristles drag through
    const under = sampler(s.paint, 6);
    s.state.under = under;
    // what's already on the sheet where the brush lands mixes into the paint a little
    let base = s.color;
    const px = under?.(d.x, d.y);
    if (px && px[3] > 90) base = mix(base, hexOf(px[0], px[1], px[2]), 0.22 * (px[3] / 255));
    const n = Math.max(8, Math.min(64, Math.round(s.size / 1.6)));
    const bristles: Bristle[] = [];
    for (let i = 0; i < n; i++) {
      // spread across the brush, a little out of line, the odd stray past the edge
      const off = (i + 0.5) / n - 0.5 + (s.rand() - 0.5) * (1 / n) + (s.rand() < 0.06 ? (s.rand() - 0.5) * 0.3 : 0);
      const color = shade(base, (s.rand() - 0.5) * 0.2);
      bristles.push({
        off,
        width: (s.size / n) * (1.4 + s.rand() * 1.2),
        color,
        ridge: s.rand() < 0.25 ? shade(color, 0.28) : null,
        load: s.rand() < 0.15 ? 0.35 + s.rand() * 0.3 : 0.8 + s.rand() * 0.2,
        rate: (0.55 + s.rand() * 0.9) / (s.size * 26 + 220),
        lx: null,
        ly: null,
      });
    }
    s.state.bristles = bristles;
  },
  dab(s, d) {
    const { ctx } = s;
    const bristles = s.state.bristles as Bristle[];
    const under = s.state.under as Sampler | null;
    // pressing splays the bristles wider
    const spread = s.size * (0.75 + 0.35 * d.p);
    const nx = -Math.sin(d.angle);
    const ny = Math.cos(d.angle);
    ctx.lineCap = "round";
    // a light touch only lands the middle of the brush: dry-brush streaks
    const reach = 0.22 + 0.36 * d.p;
    for (const b of bristles) {
      const x = d.x + nx * b.off * spread;
      const y = d.y + ny * b.off * spread;
      if (b.lx !== null && b.ly !== null && b.load > 0.02 && Math.abs(b.off) <= reach) {
        // a drying bristle skips: that's the streaks at the end of a stroke
        const skip = b.load < 0.4 && s.rand() > b.load * 2.4;
        if (!skip) {
          const width = b.width * (0.55 + 0.45 * d.p);
          ctx.strokeStyle = b.color;
          ctx.globalAlpha = s.opacity * Math.min(1, b.load * 1.4);
          ctx.lineWidth = width;
          ctx.beginPath();
          ctx.moveTo(b.lx, b.ly);
          ctx.lineTo(x, y);
          ctx.stroke();
          if (b.ridge && b.load > 0.3) {
            ctx.strokeStyle = b.ridge;
            ctx.globalAlpha = s.opacity * 0.4 * b.load;
            ctx.lineWidth = Math.max(0.6, width * 0.35);
            ctx.beginPath();
            ctx.moveTo(b.lx - nx * width * 0.2, b.ly - ny * width * 0.2);
            ctx.lineTo(x - nx * width * 0.2, y - ny * width * 0.2);
            ctx.stroke();
          }
        }
      }
      if (!s.mirrored) {
        b.load = Math.max(0, b.load - d.step * b.rate);
        b.lx = x;
        b.ly = y;
        // wet on wet: a bristle takes on the colour it's dragged through, the
        // more so as its own paint runs out, mixed the way eyes see colour
        const u = under?.(x, y);
        if (u && u[3] > 60 && d.step > 0) {
          const k = Math.min(0.5, d.step * 0.012 * (u[3] / 255) * (1.15 - b.load));
          if (k > 0.004) b.color = mix(b.color, hexOf(u[0], u[1], u[2]), k);
        }
      }
    }
  },
};

// ─── watercolour: a wash that dries darker at its edges ──────────────

const watercolor: Brush = {
  id: "watercolor",
  label: "watercolor",
  key: "w",
  kind: "dabs",
  spacing: 0.12,
  smoothing: 0.5,
  size: { min: 8, max: 180, start: 46 },
  opacity: 0.8,
  composite: "multiply",
  live: 0.42,
  reach: 1.3,
  mirrors: true,
  begin(s) {
    // the sheet as the wash finds it: what it runs into
    s.state.under = sampler(s.paint, 6);
    s.state.carried = s.color;
  },
  dab(s, d) {
    const { ctx } = s;
    let r = (s.size / 2) * (0.6 + 0.4 * d.p);
    // running into paint already there: the wash takes some of it up and
    // carries it on, and its edge spreads further into it (a bleed)
    const under = s.state.under as Sampler | null;
    const u = under?.(d.x, d.y);
    let colour = (s.state.carried as string) ?? s.color;
    if (u && u[3] > 50) {
      const k = 0.18 * (u[3] / 255);
      colour = mix(colour, hexOf(u[0], u[1], u[2]), k);
      r *= 1 + 0.35 * (u[3] / 255);
    } else {
      // on clean paper it settles back toward its own colour
      colour = mix(colour, s.color, 0.12);
    }
    if (!s.mirrored) s.state.carried = colour;
    ctx.fillStyle = colour;
    ctx.globalAlpha = 1;
    // the wet edge creeps out unevenly, more so where it's bleeding
    ragged(ctx, d.x, d.y, r, r, s.rand() * TAU, u && u[3] > 50 ? 0.45 : 0.3, s.rand, 14);
    ctx.fill();
  },
  dry(s, wet, area) {
    const { x, y, w, h } = area;
    const make = () => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      return c;
    };
    // the stroke's shape
    const shape = make();
    const sc = shape.getContext("2d")!;
    sc.drawImage(wet, x, y, w, h, 0, 0, w, h);
    // the same shape shrunk in from every side
    const inner = make();
    const ic = inner.getContext("2d")!;
    ic.drawImage(shape, 0, 0);
    ic.globalCompositeOperation = "destination-in";
    const e = Math.max(2, Math.min(7, s.size * 0.08));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ic.drawImage(shape, Math.cos(a) * e, Math.sin(a) * e);
    }
    // what's left between them is where the pigment pools as it dries
    const rim = make();
    const rc = rim.getContext("2d")!;
    rc.drawImage(shape, 0, 0);
    rc.globalCompositeOperation = "destination-out";
    rc.drawImage(inner, 0, 0);

    const out = make();
    const oc = out.getContext("2d")!;
    oc.globalAlpha = 0.36 * s.opacity;
    oc.drawImage(shape, 0, 0);
    oc.globalAlpha = 0.72 * s.opacity;
    if ("filter" in oc) oc.filter = "blur(1.2px)";
    oc.drawImage(rim, 0, 0);
    oc.filter = "none";
    // blooms: here and there, water creeping back into the drying wash pushes
    // the pigment out, leaving a paler middle with a hard, dark rim
    const blooms = Math.min(3, Math.floor((w * h) / 26000));
    for (let i = 0; i < blooms; i++) {
      const bx = w * (0.2 + 0.6 * s.rand());
      const by = h * (0.2 + 0.6 * s.rand());
      const br = Math.max(6, Math.min(w, h) * (0.12 + 0.12 * s.rand()));
      const bloom = make();
      const bc = bloom.getContext("2d")!;
      bc.fillStyle = "#000";
      ragged(bc, bx, by, br, br, s.rand() * TAU, 0.45, s.rand, 18);
      bc.fill();
      // only where the wash is
      bc.globalCompositeOperation = "destination-in";
      bc.drawImage(shape, 0, 0);
      // a paler middle...
      oc.globalCompositeOperation = "destination-out";
      oc.globalAlpha = 0.45;
      oc.drawImage(bloom, 0, 0);
      // ...and the pigment it pushed out, at its edge
      const edge = make();
      const ec = edge.getContext("2d")!;
      ec.drawImage(bloom, 0, 0);
      ec.globalCompositeOperation = "destination-out";
      // the same bloom a little smaller round its own middle: what's between is its rim
      ec.save();
      ec.translate(bx, by);
      ec.scale(0.86, 0.86);
      ec.translate(-bx, -by);
      ec.drawImage(bloom, 0, 0);
      ec.restore();
      ec.globalCompositeOperation = "source-in";
      ec.fillStyle = (s.state.carried as string) ?? s.color;
      ec.fillRect(0, 0, w, h);
      oc.globalCompositeOperation = "source-over";
      oc.globalAlpha = 0.5 * s.opacity;
      oc.drawImage(edge, 0, 0);
    }
    // the paper's tooth lifts some of the wash: granulation
    oc.globalCompositeOperation = "destination-out";
    oc.globalAlpha = 0.38;
    oc.translate(-x, -y);
    oc.fillStyle = oc.createPattern(grainTile("cold", "#000000", 0.45), "repeat")!;
    oc.fillRect(x, y, w, h);
    return out;
  },
};

// ─── airbrush: soft spray that builds up, even held still ────────────

const airbrush: Brush = {
  id: "airbrush",
  label: "airbrush",
  key: "a",
  kind: "dabs",
  spacing: 0.07,
  smoothing: 0.35,
  size: { min: 10, max: 260, start: 80 },
  opacity: 0.8,
  composite: "source-over",
  live: 1,
  reach: 1.4,
  idle: true,
  mirrors: true,
  dab(s, d) {
    const { ctx } = s;
    // held further off (a light press), the cone is wider and its spray thinner
    const r = (s.size / 2) * (1.25 - 0.5 * d.p);
    const thick = 0.35 + 0.65 * d.p;
    // the mist that rides with the droplets
    ctx.globalAlpha = s.opacity * 0.08 * thick;
    ctx.drawImage(softTip(s.color, 0), d.x - r * 1.2, d.y - r * 1.2, r * 2.4, r * 2.4);
    // droplets, most in the middle and fewer out to the edge (a bell curve)
    ctx.fillStyle = s.color;
    const n = Math.round(16 + r * thick * 1.2);
    for (let i = 0; i < n; i++) {
      const g = Math.sqrt(-2 * Math.log(1 - s.rand() * 0.999)) * 0.45;
      const a = s.rand() * TAU;
      const dist = Math.min(1.3, g) * r;
      // a bigger nozzle throws bigger drops
      const dot = (0.5 + s.rand() * s.rand() * 1.8) * Math.max(1, s.size / 45);
      ctx.globalAlpha = s.opacity * (0.25 + 0.5 * s.rand()) * thick;
      ctx.fillRect(d.x + Math.cos(a) * dist - dot / 2, d.y + Math.sin(a) * dist - dot / 2, dot, dot);
    }
    // now and then it spits: a bigger drop
    if (s.rand() < 0.025) {
      const a = s.rand() * TAU;
      const dist = r * s.rand() * 0.9;
      ctx.globalAlpha = s.opacity * 0.85;
      ctx.beginPath();
      ctx.arc(d.x + Math.cos(a) * dist, d.y + Math.sin(a) * dist, 1.2 + s.rand() * 2.2, 0, TAU);
      ctx.fill();
    }
  },
};

// ─── smudge: drags what's there along with it ────────────────────────

const smudge: Brush = {
  id: "smudge",
  label: "smudge",
  key: "s",
  kind: "dabs",
  spacing: 0.15,
  smoothing: 0.3,
  size: { min: 8, max: 140, start: 44 },
  opacity: 0.8,
  composite: "source-over",
  live: 1,
  reach: 1,
  direct: true,
  mirrors: false,
  begin(s, d) {
    s.state.from = { x: d.x, y: d.y };
    s.state.carry = document.createElement("canvas");
  },
  dab(s, d) {
    const from = s.state.from as { x: number; y: number };
    const carry = s.state.carry as HTMLCanvasElement;
    const r = Math.max(4, Math.round((s.size / 2) * (0.6 + 0.4 * d.p)));
    if (carry.width !== r * 2) carry.width = carry.height = r * 2;
    const cc = carry.getContext("2d")!;
    cc.globalCompositeOperation = "copy";
    cc.drawImage(s.paint, from.x - r, from.y - r, r * 2, r * 2, 0, 0, r * 2, r * 2);
    cc.globalCompositeOperation = "destination-in";
    cc.drawImage(softTip("#000000", 0.25), 0, 0, r * 2, r * 2);
    s.ctx.globalAlpha = s.opacity * (0.35 + 0.5 * d.p);
    s.ctx.drawImage(carry, d.x - r, d.y - r);
    // what the finger carries lags a little behind it
    from.x += (d.x - from.x) * 0.75;
    from.y += (d.y - from.y) * 0.75;
  },
};

// ─── eraser ─────────────────────────────────────────────────────────

const eraser: Brush = {
  id: "eraser",
  label: "eraser",
  key: "e",
  kind: "dabs",
  spacing: 0.08,
  smoothing: 0.3,
  size: { min: 4, max: 180, start: 34 },
  opacity: 1,
  composite: "destination-out",
  live: 1,
  reach: 1,
  mirrors: true,
  dab(s, d) {
    const r = (s.size / 2) * (0.75 + 0.25 * d.p);
    s.ctx.globalAlpha = 1;
    s.ctx.drawImage(softTip("#000000", 0.82), d.x - r, d.y - r, r * 2, r * 2);
  },
};

const fill: Brush = {
  id: "fill",
  label: "fill",
  key: "g",
  kind: "tool",
  spacing: 1,
  smoothing: 0,
  size: { min: 1, max: 1, start: 1 },
  opacity: 1,
  composite: "source-over",
  live: 1,
  reach: 0,
  mirrors: false,
};

const pick: Brush = { ...fill, id: "pick", label: "pick a colour", key: "k" };

/** every brush and tool; the fill bucket isn't offered any more, but a fill is still how the picker works */
export const BRUSHES: Brush[] = [pencil, ink, marker, crayon, charcoal, paint, watercolor, airbrush, ...FUN, smudge, eraser, pick];

/**
 * How the toolbar shows them: two groups that pop out (hold, or the > on a
 * computer), each showing the one last picked from it, and the rest loose.
 */
export const GROUPS: { id: "draw" | "fun"; label: string; tools: ToolId[] }[] = [
  { id: "draw", label: "draw", tools: ["pencil", "ink", "marker", "crayon", "charcoal", "paint", "watercolor", "airbrush"] },
  { id: "fun", label: "fun", tools: ["dither", "star", "dagger", "rgbsplit", "pixelsort"] },
];
export const LOOSE: ToolId[] = ["smudge", "eraser", "pick"];

export const brushOf = (id: ToolId) => BRUSHES.find((b) => b.id === id) ?? pencil;
