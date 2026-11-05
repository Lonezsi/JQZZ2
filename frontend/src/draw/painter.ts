/*
 * The drawing surface: pointer in, strokes out.
 *
 * A stroke goes through the same steps a real one does. The pen's raw
 * positions are steadied (a string pulled behind the pen, so shaky hands draw
 * calm lines), joined by curves, and walked along in steps the size of the
 * brush's spacing; every step is a dab. Pens report pressure; a mouse or a
 * finger doesn't, so for them pressure comes from speed, the way a brush pen
 * thins out when it's swept quickly.
 *
 * Layers: the paper, the drawing, and the wet stroke on top of it until the
 * pen lifts. Undo keeps what a change covered, before and after.
 */
import { brushOf, knobsOf, type Area, type Brush, type Dab, type Stroke, type ToolId } from "./brushes";
import { oraOf } from "./ora";
import { CELL } from "../components/common/dither";
import { grainTile, hexOf, paperSheet, rng } from "./paper";

export interface Sample {
  x: number;
  y: number;
  /** 0..1, or -1 when the device doesn't know */
  pressure: number;
  tilt: number;
  tiltAngle: number;
  t: number;
}

/**
 * One layer of the drawing. Layers stack bottom first; each joins the ones
 * under it through its own blend mode, at its own opacity.
 */
export interface Layer {
  id: number;
  name: string;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  visible: boolean;
  opacity: number;
  blend: GlobalCompositeOperation;
  /** paint only lands where the layer already has paint */
  lockAlpha: boolean;
}

/** what a change covered on a layer, or how the stack of layers was before and after */
type Change =
  | { kind: "pixels"; layer: Layer; x: number; y: number; before: ImageData; after: ImageData | null }
  | { kind: "layers"; before: Stack; after: Stack; bytes: number };

interface Stack {
  list: Layer[];
  active: number;
}

/** how layers can join the ones under them, as the layer menu offers them */
export const BLENDS: { id: GlobalCompositeOperation; label: string }[] = [
  { id: "source-over", label: "normal" },
  { id: "multiply", label: "multiply" },
  { id: "screen", label: "screen" },
  { id: "overlay", label: "overlay" },
  { id: "darken", label: "darken" },
  { id: "lighten", label: "lighten" },
  { id: "color-dodge", label: "colour dodge" },
  { id: "color-burn", label: "colour burn" },
  { id: "hard-light", label: "hard light" },
  { id: "soft-light", label: "soft light" },
  { id: "difference", label: "difference" },
  { id: "exclusion", label: "exclusion" },
  { id: "hue", label: "hue" },
  { id: "saturation", label: "saturation" },
  { id: "color", label: "colour" },
  { id: "luminosity", label: "luminosity" },
];

/** more than this and a phone runs short of memory */
export const MAX_LAYERS = 8;

const bytesOf = (c: Change) =>
  c.kind === "pixels" ? c.before.data.length + (c.after?.data.length ?? 0) : c.bytes;

interface Live {
  brush: Brush;
  s: Stroke;
  /** steadied points, before they're joined into curves */
  pts: { x: number; y: number; p: number; t: number; tilt: number; tiltAngle: number }[];
  /** path brushes keep every dab, to draw the stroke whole each time */
  dabs: Dab[];
  /** where the steadied pen is */
  sx: number;
  sy: number;
  /** the pen itself */
  rx: number;
  ry: number;
  rp: number;
  /** pressure worked out from speed, for devices without it */
  sim: number;
  started: number;
  lastT: number;
  /** distance walked since the last dab */
  carry: number;
  last: Dab | null;
  box: [number, number, number, number];
  idleTimer: number;
  lastMove: number;
  /** for direct tools: the drawing as it was, so the stroke can be undone */
  backup?: HTMLCanvasElement;
}

/** undo keeps changes up to this many bytes, dropping the oldest */
const UNDO_BYTES = 90 * 1024 * 1024;

/** where two parts of the sheet overlap, if they do */
const meet = (a: Area | null, b: Area): Area | null => {
  if (!a) return null;
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  return x1 > x && y1 > y ? { x, y, w: x1 - x, h: y1 - y } : null;
};

const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

export interface PainterOptions {
  width: number;
  height: number;
  paper: string;
}

export class Painter {
  readonly width: number;
  readonly height: number;
  tool: ToolId = "pencil";
  color = "#1d1a24";
  size = 4;
  opacity = 0.9;
  symmetry = false;
  /** screen pixels per sheet pixel, as the sheet's shown (the frame keeps it up to date): the dither pen prints on the screen's grid */
  screenScale = 1;
  /** the current brush's own settings, as set (Brush.knobs) */
  knobs: Record<string, number> = {};
  /** told when the drawing or what can be undone changes */
  onChange: () => void = () => {};
  /** told when the colour picker tool picks */
  onPick: (hex: string) => void = () => {};

  private readonly vctx: CanvasRenderingContext2D;
  /** bottom first */
  layers: Layer[] = [];
  /** the layer strokes go on */
  active = 0;
  private layerCount = 0;
  private readonly wet: HTMLCanvasElement;
  private readonly wctx: CanvasRenderingContext2D;
  private readonly scratch: HTMLCanvasElement;
  private readonly sctx: CanvasRenderingContext2D;
  /** the active layer with the wet stroke on it, before it's blended in */
  private readonly comp: HTMLCanvasElement;
  private readonly cctx: CanvasRenderingContext2D;
  /** the wet stroke held to the active layer's paint (lock alpha) */
  private readonly locked: HTMLCanvasElement;
  private readonly lctx: CanvasRenderingContext2D;
  private sheet: HTMLCanvasElement;
  paper: string;

  /** what of the view needs drawing again: all of it, or (while a stroke goes on) just this box */
  private dirtyAll = true;
  private dirty: [number, number, number, number] | null = null;

  private undos: Change[] = [];
  private redos: Change[] = [];
  private undoBytes = 0;
  private live: Live | null = null;
  private strokeCount = 0;
  private frame = 0;
  private marks = 0;
  private caps = new Map<string, CanvasPattern>();

  constructor(view: HTMLCanvasElement, opts: PainterOptions) {
    this.width = opts.width;
    this.height = opts.height;
    view.width = this.width;
    view.height = this.height;
    // opaque, since the paper is always under it, and drawn without waiting
    // on the page's own frames: the line keeps up with the pen
    this.vctx = (view.getContext("2d", { alpha: false, desynchronized: true }) ?? view.getContext("2d"))!;
    this.layers = [this.newLayer()];
    this.wet = canvas(this.width, this.height);
    this.wctx = this.wet.getContext("2d")!;
    this.scratch = canvas(this.width, this.height);
    this.sctx = this.scratch.getContext("2d")!;
    this.comp = canvas(this.width, this.height);
    this.cctx = this.comp.getContext("2d")!;
    this.locked = canvas(this.width, this.height);
    this.lctx = this.locked.getContext("2d")!;
    this.paper = opts.paper;
    this.sheet = paperSheet(opts.paper, this.width, this.height);
    this.redraw();
  }

  // ─── layers ──────────────────────────────────────────────────────

  private newLayer(name?: string): Layer {
    const c = canvas(this.width, this.height);
    const id = ++this.layerCount;
    return {
      id,
      name: name ?? `layer ${id}`,
      canvas: c,
      ctx: c.getContext("2d")!,
      visible: true,
      opacity: 1,
      blend: "source-over",
      lockAlpha: false,
    };
  }

  /** the layer strokes go on */
  get layer(): Layer {
    return this.layers[this.active];
  }

  /** its canvas: what the brushes see as the drawing */
  get paint(): HTMLCanvasElement {
    return this.layer.canvas;
  }

  private get pctx(): CanvasRenderingContext2D {
    return this.layer.ctx;
  }

  private stack(): Stack {
    return { list: [...this.layers], active: this.active };
  }

  /** a change to the stack: kept for undo, then shown */
  private restack(next: Stack, bytes = 0) {
    if (this.live) this.cancel();
    const before = this.stack();
    this.layers = next.list;
    this.active = Math.max(0, Math.min(next.active, next.list.length - 1));
    this.remember({ kind: "layers", before, after: this.stack(), bytes });
    this.marks++;
    this.schedule();
    this.onChange();
  }

  selectLayer(i: number) {
    if (i < 0 || i >= this.layers.length || i === this.active) return;
    if (this.live) this.cancel();
    this.active = i;
    this.onChange();
  }

  /** a new empty layer, above the one in use */
  addLayer() {
    if (this.layers.length >= MAX_LAYERS) return;
    const list = [...this.layers];
    list.splice(this.active + 1, 0, this.newLayer());
    this.restack({ list, active: this.active + 1 });
  }

  duplicateLayer() {
    if (this.layers.length >= MAX_LAYERS) return;
    const from = this.layer;
    const copy = this.newLayer(`${from.name} copy`);
    copy.ctx.drawImage(from.canvas, 0, 0);
    Object.assign(copy, { visible: from.visible, opacity: from.opacity, blend: from.blend, lockAlpha: from.lockAlpha });
    const list = [...this.layers];
    list.splice(this.active + 1, 0, copy);
    this.restack({ list, active: this.active + 1 }, this.width * this.height * 4);
  }

  deleteLayer() {
    if (this.layers.length <= 1) return;
    const list = this.layers.filter((_, i) => i !== this.active);
    this.restack({ list, active: Math.min(this.active, list.length - 1) });
  }

  /** up (+1) or down (-1) the stack */
  moveLayer(by: 1 | -1) {
    const to = this.active + by;
    if (to < 0 || to >= this.layers.length) return;
    const list = [...this.layers];
    [list[this.active], list[to]] = [list[to], list[this.active]];
    this.restack({ list, active: to });
  }

  /** the layer in use and the one under it become one, blended as they look */
  mergeDown() {
    if (this.active === 0) return;
    const upper = this.layer;
    const lower = this.layers[this.active - 1];
    const merged = this.newLayer(lower.name);
    Object.assign(merged, { visible: lower.visible, opacity: lower.opacity, blend: lower.blend, lockAlpha: lower.lockAlpha });
    merged.ctx.drawImage(lower.canvas, 0, 0);
    if (upper.visible) {
      merged.ctx.globalAlpha = upper.opacity;
      merged.ctx.globalCompositeOperation = upper.blend;
      merged.ctx.drawImage(upper.canvas, 0, 0);
      merged.ctx.globalAlpha = 1;
      merged.ctx.globalCompositeOperation = "source-over";
    }
    const list = [...this.layers];
    list.splice(this.active - 1, 2, merged);
    this.restack({ list, active: this.active - 1 }, this.width * this.height * 4);
  }

  /** name, visibility, opacity, blend, lock: shown at once, not kept for undo */
  setLayer(patch: Partial<Pick<Layer, "name" | "visible" | "opacity" | "blend" | "lockAlpha">>, i = this.active) {
    const l = this.layers[i];
    if (!l) return;
    Object.assign(l, patch);
    this.marks++;
    this.schedule();
    this.onChange();
  }

  // ─── settings ────────────────────────────────────────────────────

  setPaper(id: string) {
    if (id === this.paper) return;
    this.paper = id;
    this.sheet = paperSheet(id, this.width, this.height);
    this.redraw();
    this.onChange();
  }

  get canUndo() {
    return this.undos.length > 0;
  }

  get canRedo() {
    return this.redos.length > 0;
  }

  /** anything drawn at all */
  get isEmpty() {
    return this.marks === 0;
  }

  /** goes up with every change, for knowing whether what was sent is still current */
  get revision() {
    return this.marks;
  }

  // ─── strokes ─────────────────────────────────────────────────────

  begin(at: Sample) {
    const brush = brushOf(this.tool);
    if (brush.kind === "tool") {
      if (brush.id === "fill") this.fill(at.x, at.y);
      else this.onPick(this.pick(at.x, at.y));
      return;
    }
    this.cancel();
    const pen = at.pressure >= 0;
    const s: Stroke = {
      ctx: brush.direct ? this.pctx : this.wctx,
      color: this.color,
      size: this.size,
      opacity: this.opacity,
      rand: rng(++this.strokeCount * 7919 + 17),
      state: {},
      paint: this.paint,
      mirrored: false,
      width: this.width,
      cell: CELL / this.screenScale,
      knobs: knobsOf(brush, this.knobs),
    };
    const live: Live = {
      brush,
      s,
      pts: [],
      dabs: [],
      sx: at.x,
      sy: at.y,
      rx: at.x,
      ry: at.y,
      rp: pen ? at.pressure : 0.55,
      sim: 0.55,
      started: at.t,
      lastT: at.t,
      carry: 0,
      last: null,
      box: [at.x, at.y, at.x, at.y],
      idleTimer: 0,
      lastMove: at.t,
    };
    if (brush.direct) {
      live.backup = canvas(this.width, this.height);
      live.backup.getContext("2d")!.drawImage(this.paint, 0, 0);
    }
    this.live = live;
    this.wctx.clearRect(0, 0, this.width, this.height);
    this.push(at, true);
    if (brush.idle) {
      // an airbrush keeps spraying where it's held
      live.idleTimer = window.setInterval(() => {
        const l = this.live;
        if (!l || performance.now() - l.lastMove < 40 || !l.last) return;
        this.dab({ ...l.last, step: 0, speed: 0 });
        this.schedule(true);
      }, 30);
    }
    this.schedule();
  }

  move(samples: Sample[]) {
    if (!this.live) return;
    for (const at of samples) this.push(at, false);
    this.live.lastMove = performance.now();
    this.schedule(true);
  }

  end() {
    const l = this.live;
    if (!l) return;
    // finish where the pen actually lifted, not where the steadied line had got to
    const gap = Math.hypot(l.rx - l.sx, l.ry - l.sy);
    const steps = Math.min(12, Math.ceil(gap / 3));
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      this.addPoint(l.sx + (l.rx - l.sx) * k, l.sy + (l.ry - l.sy) * k, l.rp, l.lastT);
    }
    this.flushCurve(true);
    if (l.brush.kind === "path") this.drawPath(true);
    this.commit();
  }

  /** a stroke stopped without keeping it (a second finger landed: it was a gesture) */
  cancel() {
    const l = this.live;
    if (!l) return;
    window.clearInterval(l.idleTimer);
    if (l.backup) {
      this.pctx.globalCompositeOperation = "copy";
      this.pctx.globalAlpha = 1;
      this.pctx.drawImage(l.backup, 0, 0);
      this.pctx.globalCompositeOperation = "source-over";
    }
    this.wctx.clearRect(0, 0, this.width, this.height);
    this.live = null;
    this.schedule();
  }

  get drawing() {
    return this.live !== null;
  }

  /** a raw pen position: steadied, then added to the curve */
  private push(at: Sample, first: boolean) {
    const l = this.live!;
    const dt = Math.max(1, at.t - l.lastT);
    const moved = Math.hypot(at.x - l.rx, at.y - l.ry);
    let p: number;
    if (at.pressure >= 0) {
      // a pen: its own pressure, eased so the light end is usable
      p = Math.pow(Math.max(0.02, at.pressure), 0.8);
    } else {
      // no pressure: slow is heavy, fast is light, and every stroke eases in
      const speed = moved / dt;
      const target = Math.max(0.3, Math.min(1, 1.08 - speed * 0.22));
      l.sim += (target - l.sim) * (first ? 1 : 0.18);
      const age = at.t - l.started;
      p = l.sim * (age < 80 ? 0.45 + 0.55 * (age / 80) : 1);
    }
    l.rx = at.x;
    l.ry = at.y;
    l.rp = p;
    l.lastT = at.t;
    const k = 1 - l.brush.smoothing * 0.82;
    if (first) {
      l.sx = at.x;
      l.sy = at.y;
    } else {
      l.sx += (at.x - l.sx) * k;
      l.sy += (at.y - l.sy) * k;
    }
    const prev = l.pts[l.pts.length - 1];
    if (!first && prev && Math.hypot(l.sx - prev.x, l.sy - prev.y) < 0.75) return;
    this.addPoint(l.sx, l.sy, p, at.t, at.tilt, at.tiltAngle);
  }

  private addPoint(x: number, y: number, p: number, t: number, tilt = 0, tiltAngle = 0) {
    const l = this.live!;
    l.pts.push({ x, y, p, t, tilt, tiltAngle });
    this.flushCurve(false);
  }

  /**
   * Joins the steadied points with curves through their midpoints, each
   * point pulling the line toward it, and walks the new part.
   */
  private flushCurve(final: boolean) {
    const l = this.live!;
    const n = l.pts.length;
    if (n === 1 && !l.last) {
      const a = l.pts[0];
      this.dab({ x: a.x, y: a.y, p: a.p, angle: 0, speed: 0, tilt: a.tilt, tiltAngle: a.tiltAngle, step: 0 });
      return;
    }
    if (n < 2) return;
    const a = l.pts[n - 2];
    const b = l.pts[n - 1];
    const mid = (u: typeof a, v: typeof a) => ({ x: (u.x + v.x) / 2, y: (u.y + v.y) / 2, p: (u.p + v.p) / 2, t: (u.t + v.t) / 2 });
    if (final) {
      this.walk(mid(a, b), b, b, b);
      return;
    }
    if (n === 2) {
      this.walk(a, mid(a, b), mid(a, b), b);
      return;
    }
    const z = l.pts[n - 3];
    this.walk(mid(z, a), a, mid(a, b), b);
  }

  /** along a quadratic curve from `from` to `to`, bending toward `via`, a dab every spacing */
  private walk(
    from: { x: number; y: number; p: number; t: number },
    via: { x: number; y: number },
    to: { x: number; y: number; p: number; t: number },
    tilted: { tilt: number; tiltAngle: number },
  ) {
    const l = this.live!;
    const spacing = Math.max(0.6, this.size * (l.s.knobs.spacing !== undefined ? l.s.knobs.spacing / 100 : l.brush.spacing));
    const rough = Math.hypot(via.x - from.x, via.y - from.y) + Math.hypot(to.x - via.x, to.y - via.y);
    const steps = Math.max(1, Math.ceil(rough / 0.75));
    const dt = Math.max(1, to.t - from.t);
    const speed = rough / dt;
    let px = from.x;
    let py = from.y;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      const x = u * u * from.x + 2 * u * t * via.x + t * t * to.x;
      const y = u * u * from.y + 2 * u * t * via.y + t * t * to.y;
      const seg = Math.hypot(x - px, y - py);
      l.carry += seg;
      if (l.carry >= spacing) {
        const angle = Math.atan2(y - py, x - px);
        const step = l.carry;
        l.carry = 0;
        this.dab({
          x,
          y,
          p: from.p + (to.p - from.p) * t,
          angle,
          speed,
          tilt: tilted.tilt,
          tiltAngle: tilted.tiltAngle,
          step,
        });
      }
      px = x;
      py = y;
    }
  }

  /** one mark, and its mirror image when the sheet is mirrored */
  private dab(d: Dab) {
    const l = this.live!;
    const { brush, s } = l;
    if (!l.last && brush.begin) brush.begin(s, d);
    l.last = d;
    const reach = this.size * brush.reach + 4;
    const grow = (x: number, y: number) => {
      l.box[0] = Math.min(l.box[0], x - reach);
      l.box[1] = Math.min(l.box[1], y - reach);
      l.box[2] = Math.max(l.box[2], x + reach);
      l.box[3] = Math.max(l.box[3], y + reach);
      this.touch(x - reach, y - reach, x + reach, y + reach);
    };
    grow(d.x, d.y);
    if (brush.kind === "path") {
      l.dabs.push(d);
      return;
    }
    const mirror = this.symmetry && brush.mirrors;
    if (mirror) {
      s.mirrored = true;
      s.ctx.save();
      s.ctx.setTransform(-1, 0, 0, 1, this.width, 0);
      brush.dab?.(s, { ...d, angle: Math.PI - d.angle, tiltAngle: Math.PI - d.tiltAngle });
      s.ctx.restore();
      s.mirrored = false;
      grow(this.width - d.x, d.y);
    }
    s.ctx.save();
    brush.dab?.(s, d);
    s.ctx.restore();
  }

  private drawPath(done: boolean) {
    const l = this.live!;
    const { brush, s } = l;
    this.wctx.clearRect(0, 0, this.width, this.height);
    s.ctx.save();
    brush.path?.(s, l.dabs, done);
    s.ctx.restore();
    if (this.symmetry && brush.mirrors) {
      s.ctx.save();
      s.ctx.setTransform(-1, 0, 0, 1, this.width, 0);
      brush.path?.(s, l.dabs, done);
      s.ctx.restore();
      const [x0, y0, x1, y1] = l.box;
      l.box[0] = Math.min(x0, this.width - x1);
      l.box[2] = Math.max(x1, this.width - x0);
      l.box[1] = y0;
      l.box[3] = y1;
    }
  }

  /** the pen lifted: the wet stroke joins the drawing */
  private commit() {
    const l = this.live!;
    window.clearInterval(l.idleTimer);
    this.live = null;
    const area = this.clampBox(l.box);
    if (!area) {
      this.wctx.clearRect(0, 0, this.width, this.height);
      this.schedule();
      return;
    }
    const { brush, s } = l;
    if (brush.direct) {
      // already on the drawing: what it covered comes from the copy made at the start
      const before = l.backup!.getContext("2d")!.getImageData(area.x, area.y, area.w, area.h);
      this.remember({ kind: "pixels", layer: this.layer, x: area.x, y: area.y, before, after: null });
    } else {
      const before = this.pctx.getImageData(area.x, area.y, area.w, area.h);
      this.pctx.save();
      this.pctx.globalCompositeOperation = brush.composite;
      if (brush.dry) {
        const dried = brush.dry(s, this.wet, area);
        if (this.layer.lockAlpha) {
          const dc = dried.getContext("2d")!;
          dc.globalCompositeOperation = "destination-in";
          dc.drawImage(this.paint, area.x, area.y, area.w, area.h, 0, 0, area.w, area.h);
        }
        this.pctx.globalAlpha = 1;
        this.pctx.drawImage(dried, area.x, area.y);
      } else {
        this.pctx.globalAlpha = brush.id === "eraser" || brush.composite === "multiply" || brush.kind === "path" ? s.opacity : 1;
        this.pctx.drawImage(this.strokeImage(l), area.x, area.y, area.w, area.h, area.x, area.y, area.w, area.h);
      }
      this.pctx.restore();
      this.remember({ kind: "pixels", layer: this.layer, x: area.x, y: area.y, before, after: null });
    }
    this.wctx.clearRect(0, 0, this.width, this.height);
    this.marks++;
    this.schedule();
    this.onChange();
  }

  /** the wet stroke as it joins the layer: held to the grain, and to the layer's paint when its alpha is locked */
  private strokeImage(l: Live, part?: Area): HTMLCanvasElement {
    const src = this.capped(l, part);
    if (!this.layer.lockAlpha || l.brush.composite === "destination-out") return src;
    const area = part ?? this.clampBox(l.box);
    if (!area) return src;
    const c = this.lctx;
    c.save();
    c.beginPath();
    c.rect(area.x, area.y, area.w, area.h);
    c.clip();
    c.globalCompositeOperation = "copy";
    c.drawImage(src, 0, 0);
    c.globalCompositeOperation = "destination-in";
    c.drawImage(this.paint, 0, 0);
    c.restore();
    return this.locked;
  }

  /** the wet stroke held to the paper's grain (dry media), or the wet stroke as it is */
  private capped(l: Live, part?: Area): HTMLCanvasElement {
    const cap = l.brush.grainCap;
    if (!cap) return this.wet;
    const area = part ?? this.clampBox(l.box);
    if (!area) return this.wet;
    const key = `${cap.grain}|${cap.bite}`;
    let pattern = this.caps.get(key);
    if (!pattern) {
      pattern = this.sctx.createPattern(grainTile(cap.grain, "#000000", cap.bite), "repeat")!;
      this.caps.set(key, pattern);
    }
    const c = this.sctx;
    c.save();
    c.globalAlpha = 1;
    c.globalCompositeOperation = "copy";
    c.beginPath();
    c.rect(area.x, area.y, area.w, area.h);
    c.clip();
    c.drawImage(this.wet, 0, 0);
    c.globalCompositeOperation = "destination-in";
    c.fillStyle = pattern;
    c.fillRect(area.x, area.y, area.w, area.h);
    c.restore();
    return this.scratch;
  }

  private clampBox(box: [number, number, number, number]) {
    const x = Math.max(0, Math.floor(box[0]));
    const y = Math.max(0, Math.floor(box[1]));
    const x1 = Math.min(this.width, Math.ceil(box[2]));
    const y1 = Math.min(this.height, Math.ceil(box[3]));
    if (x1 <= x || y1 <= y) return null;
    return { x, y, w: x1 - x, h: y1 - y };
  }

  // ─── undo ────────────────────────────────────────────────────────

  private remember(c: Change) {
    this.undos.push(c);
    this.undoBytes += bytesOf(c);
    for (const r of this.redos) this.undoBytes -= bytesOf(r);
    this.redos = [];
    while (this.undoBytes > UNDO_BYTES && this.undos.length > 1) {
      this.undoBytes -= bytesOf(this.undos.shift()!);
    }
  }

  undo() {
    if (this.live) this.cancel();
    const c = this.undos.pop();
    if (!c) return;
    if (c.kind === "layers") {
      this.layers = [...c.before.list];
      this.active = c.before.active;
    } else {
      if (!c.after) {
        c.after = c.layer.ctx.getImageData(c.x, c.y, c.before.width, c.before.height);
        this.undoBytes += c.after.data.length;
      }
      c.layer.ctx.putImageData(c.before, c.x, c.y);
    }
    this.redos.push(c);
    this.marks++;
    this.schedule();
    this.onChange();
  }

  redo() {
    const c = this.redos.pop();
    if (!c) return;
    if (c.kind === "layers") {
      this.layers = [...c.after.list];
      this.active = c.after.active;
    } else {
      if (!c.after) return;
      c.layer.ctx.putImageData(c.after, c.x, c.y);
    }
    this.undos.push(c);
    this.marks++;
    this.schedule();
    this.onChange();
  }

  /** the layer in use, emptied */
  clear() {
    if (this.live) this.cancel();
    const before = this.pctx.getImageData(0, 0, this.width, this.height);
    this.pctx.clearRect(0, 0, this.width, this.height);
    this.remember({ kind: "pixels", layer: this.layer, x: 0, y: 0, before, after: null });
    this.marks++;
    this.schedule();
    this.onChange();
  }

  /** a blank sheet, one layer, with nothing to undo, for a fresh start */
  wipe() {
    if (this.live) this.cancel();
    this.layers = [this.newLayer()];
    this.active = 0;
    this.undos = [];
    this.redos = [];
    this.undoBytes = 0;
    this.schedule();
  }

  // ─── fill and pick ───────────────────────────────────────────────

  /**
   * Fills the patch that was clicked. On empty paper the colour goes under
   * the lines, the way a colouring book is coloured, so they stay crisp; on
   * a patch that's already coloured, it goes over.
   */
  fill(x: number, y: number) {
    const W = this.width;
    const H = this.height;
    const sx = Math.floor(x);
    const sy = Math.floor(y);
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) return;
    const img = this.pctx.getImageData(0, 0, W, H);
    const px = img.data;
    const at = (sy * W + sx) * 4;
    const seed = [px[at], px[at + 1], px[at + 2], px[at + 3]];
    const empty = seed[3] < 110;
    const close = (i: number) => {
      const a = px[i + 3];
      if (empty) return a < 110;
      return Math.abs(a - seed[3]) < 60 && Math.abs(px[i] - seed[0]) < 40 && Math.abs(px[i + 1] - seed[1]) < 40 && Math.abs(px[i + 2] - seed[2]) < 40;
    };
    const mask = new Uint8Array(W * H);
    const stack = [sx, sy];
    let x0 = sx;
    let x1 = sx;
    let y0 = sy;
    let y1 = sy;
    while (stack.length) {
      const yy = stack.pop()!;
      let xx = stack.pop()!;
      while (xx > 0 && !mask[yy * W + xx - 1] && close((yy * W + xx - 1) * 4)) xx--;
      let up = false;
      let down = false;
      for (; xx < W && !mask[yy * W + xx] && close((yy * W + xx) * 4); xx++) {
        mask[yy * W + xx] = 1;
        if (xx < x0) x0 = xx;
        if (xx > x1) x1 = xx;
        if (yy > 0) {
          const ok = !mask[(yy - 1) * W + xx] && close(((yy - 1) * W + xx) * 4);
          if (ok && !up) stack.push(xx, yy - 1);
          up = ok;
        }
        if (yy < H - 1) {
          const ok = !mask[(yy + 1) * W + xx] && close(((yy + 1) * W + xx) * 4);
          if (ok && !down) stack.push(xx, yy + 1);
          down = ok;
        }
      }
      if (yy < y0) y0 = yy;
      if (yy > y1) y1 = yy;
    }
    // reach two pixels past the edge, tucking the colour under soft line edges
    const grow = 2;
    x0 = Math.max(0, x0 - grow);
    y0 = Math.max(0, y0 - grow);
    x1 = Math.min(W - 1, x1 + grow);
    y1 = Math.min(H - 1, y1 + grow);
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    const layer = new ImageData(w, h);
    const [r, g, b] = [parseInt(this.color.slice(1, 3), 16), parseInt(this.color.slice(3, 5), 16), parseInt(this.color.slice(5, 7), 16)];
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        let hit = mask[yy * W + xx] === 1;
        for (let dy = -grow; !hit && dy <= grow; dy++) {
          for (let dx = -grow; !hit && dx <= grow; dx++) {
            const nx = xx + dx;
            const ny = yy + dy;
            if (nx >= 0 && ny >= 0 && nx < W && ny < H && mask[ny * W + nx]) hit = true;
          }
        }
        if (!hit) continue;
        const o = ((yy - y0) * w + (xx - x0)) * 4;
        layer.data[o] = r;
        layer.data[o + 1] = g;
        layer.data[o + 2] = b;
        layer.data[o + 3] = Math.round(255 * this.opacity);
      }
    }
    const before = new ImageData(w, h);
    for (let yy = 0; yy < h; yy++) {
      const from = ((yy + y0) * W + x0) * 4;
      before.data.set(px.subarray(from, from + w * 4), yy * w * 4);
    }
    const tmp = canvas(w, h);
    tmp.getContext("2d")!.putImageData(layer, 0, 0);
    this.pctx.save();
    this.pctx.globalCompositeOperation = empty ? "destination-over" : "source-over";
    this.pctx.drawImage(tmp, x0, y0);
    this.pctx.restore();
    this.remember({ kind: "pixels", layer: this.layer, x: x0, y: y0, before, after: null });
    this.marks++;
    this.schedule();
    this.onChange();
  }

  /** the colour on the sheet at a point, as it looks: paper and every layer */
  pick(x: number, y: number): string {
    const c = this.sctx;
    c.globalCompositeOperation = "copy";
    c.drawImage(this.sheet, 0, 0);
    this.drawLayers(c);
    const d = c.getImageData(Math.max(0, Math.min(this.width - 1, Math.floor(x))), Math.max(0, Math.min(this.height - 1, Math.floor(y))), 1, 1).data;
    return hexOf(d[0], d[1], d[2]);
  }

  // ─── showing it ──────────────────────────────────────────────────

  /** the view gets this part of the sheet drawn again on the next frame */
  private touch(x0: number, y0: number, x1: number, y1: number) {
    const d = this.dirty;
    this.dirty = d
      ? [Math.min(d[0], x0), Math.min(d[1], y0), Math.max(d[2], x1), Math.max(d[3], y1)]
      : [x0, y0, x1, y1];
  }

  /**
   * Draws the view again on the next frame: all of it, or with `part`, only
   * what's been touched since the last one. A stroke going on touches a few
   * dabs' worth, so each frame of it costs that much, not the whole sheet.
   */
  private schedule(part = false) {
    if (!part) this.dirtyAll = true;
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const l = this.live;
      if (l?.brush.kind === "path") {
        // a path brush draws its stroke whole each time: all of it may have moved
        this.drawPath(false);
        this.touch(l.box[0], l.box[1], l.box[2], l.box[3]);
      }
      const all = this.dirtyAll;
      const area = !all && this.dirty ? this.clampBox(this.dirty) : null;
      this.dirtyAll = false;
      this.dirty = null;
      if (all) this.redraw();
      else if (area) this.redraw(area);
    });
  }

  private redraw(area?: Area) {
    const v = this.vctx;
    v.globalCompositeOperation = "source-over";
    v.globalAlpha = 1;
    if (area) {
      v.save();
      v.beginPath();
      v.rect(area.x, area.y, area.w, area.h);
      v.clip();
      v.drawImage(this.sheet, area.x, area.y, area.w, area.h, area.x, area.y, area.w, area.h);
    } else {
      v.drawImage(this.sheet, 0, 0);
    }
    this.drawLayers(v, true, area);
    if (area) v.restore();
  }

  /**
   * Every visible layer onto `to`, bottom first, each through its blend mode
   * at its opacity. While a stroke is wet it's put on its own layer first, so
   * the layer's blend applies to the stroke the way it will once it's dry.
   */
  private drawLayers(to: CanvasRenderingContext2D, withWet = false, area?: Area) {
    const l = withWet ? this.live : null;
    this.layers.forEach((layer, i) => {
      if (!layer.visible) return;
      let img: HTMLCanvasElement = layer.canvas;
      if (l && i === this.active && !l.brush.direct) img = this.withWet(l, area);
      to.globalAlpha = layer.opacity;
      to.globalCompositeOperation = layer.blend;
      if (area) to.drawImage(img, area.x, area.y, area.w, area.h, area.x, area.y, area.w, area.h);
      else to.drawImage(img, 0, 0);
    });
    to.globalAlpha = 1;
    to.globalCompositeOperation = "source-over";
  }

  /** the active layer with the wet stroke on it (only within `part`, when given: the rest isn't looked at) */
  private withWet(l: Live, part?: Area): HTMLCanvasElement {
    const c = this.cctx;
    const r = part ?? { x: 0, y: 0, w: this.width, h: this.height };
    c.save();
    c.beginPath();
    c.rect(r.x, r.y, r.w, r.h);
    c.clip();
    c.globalCompositeOperation = "copy";
    c.globalAlpha = 1;
    c.drawImage(this.paint, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    const area = meet(this.clampBox(l.box), r);
    if (area) {
      c.globalCompositeOperation = l.brush.composite;
      const whole = l.brush.composite === "multiply" || l.brush.kind === "path" || l.brush.composite === "destination-out";
      c.globalAlpha = (l.brush.composite === "destination-out" ? 1 : l.brush.live) * (whole ? l.s.opacity : 1);
      c.drawImage(this.strokeImage(l, area), area.x, area.y, area.w, area.h, area.x, area.y, area.w, area.h);
    }
    c.restore();
    return this.comp;
  }

  // ─── in and out ──────────────────────────────────────────────────

  /** the sheet with the drawing on it */
  flatten(): HTMLCanvasElement {
    const out = canvas(this.width, this.height);
    const c = out.getContext("2d")!;
    c.drawImage(this.sheet, 0, 0);
    this.drawLayers(c);
    return out;
  }

  /** the finished picture as a file: WebP where the browser can make one, else JPEG */
  async export(): Promise<Blob> {
    const flat = this.flatten();
    const blob = (type: string, q: number) =>
      new Promise<Blob | null>((resolve) => flat.toBlob(resolve, type, q));
    let out = await blob("image/webp", 0.86);
    if (!out || out.type !== "image/webp") out = await blob("image/jpeg", 0.9);
    if (out && out.size > 1_300_000) out = await blob("image/jpeg", 0.78);
    if (!out) throw new Error("This browser couldn't save the drawing");
    return out;
  }

  /** the picture as a PNG, full size, nothing lost: to download */
  async png(): Promise<Blob> {
    const flat = this.flatten();
    const out = await new Promise<Blob | null>((resolve) => flat.toBlob(resolve, "image/png"));
    if (!out) throw new Error("This browser couldn't make the picture");
    return out;
  }

  /** every layer as an OpenRaster file, for Krita, GIMP or MyPaint */
  ora(): Promise<Blob> {
    return oraOf(this.width, this.height, this.layers, this.sheet, this.flatten());
  }

  /** every layer and which paper it's on, to keep for a reload or in the stash (a drawing) */
  snapshot(): string {
    return JSON.stringify({
      paper: this.paper,
      active: this.active,
      layers: this.layers.map((l) => ({
        name: l.name,
        visible: l.visible,
        opacity: l.opacity,
        blend: l.blend,
        lockAlpha: l.lockAlpha,
        image: l.canvas.toDataURL("image/webp", 0.92),
      })),
    });
  }

  /** puts a picture back: a snapshot of our own, or a drawing already sent */
  async load(src: string): Promise<void> {
    const picture = async (url: string) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      await img.decode();
      return img;
    };
    let layers: Layer[];
    let active = 0;
    if (src.trimStart().startsWith("{")) {
      // a snapshot of our own: every layer as it was
      const saved = JSON.parse(src) as {
        paper?: string;
        active?: number;
        layers?: { name?: string; visible?: boolean; opacity?: number; blend?: GlobalCompositeOperation; lockAlpha?: boolean; image: string }[];
      };
      layers = [];
      for (const s of (saved.layers ?? []).slice(0, MAX_LAYERS)) {
        const layer = this.newLayer(s.name);
        Object.assign(layer, {
          visible: s.visible ?? true,
          opacity: s.opacity ?? 1,
          blend: BLENDS.some((b) => b.id === s.blend) ? s.blend : "source-over",
          lockAlpha: !!s.lockAlpha,
        });
        layer.ctx.drawImage(await picture(s.image), 0, 0, this.width, this.height);
        layers.push(layer);
      }
      if (!layers.length) layers = [this.newLayer()];
      active = Math.max(0, Math.min(saved.active ?? 0, layers.length - 1));
      if (saved.paper) this.setPaper(saved.paper);
    } else {
      // a picture: one layer of it
      const layer = this.newLayer();
      layer.ctx.drawImage(await picture(src), 0, 0, this.width, this.height);
      layers = [layer];
    }
    this.cancel();
    this.layers = layers;
    this.active = active;
    this.undos = [];
    this.redos = [];
    this.undoBytes = 0;
    this.marks++;
    this.schedule();
    this.onChange();
  }

  destroy() {
    this.cancel();
    if (this.frame) cancelAnimationFrame(this.frame);
  }
}
