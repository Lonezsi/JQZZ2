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
import { brushOf, type Brush, type Dab, type Stroke, type ToolId } from "./brushes";
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

interface Change {
  x: number;
  y: number;
  before: ImageData;
  after: ImageData | null;
}

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
  /** told when the drawing or what can be undone changes */
  onChange: () => void = () => {};
  /** told when the colour picker tool picks */
  onPick: (hex: string) => void = () => {};

  private readonly vctx: CanvasRenderingContext2D;
  readonly paint: HTMLCanvasElement;
  private readonly pctx: CanvasRenderingContext2D;
  private readonly wet: HTMLCanvasElement;
  private readonly wctx: CanvasRenderingContext2D;
  private readonly scratch: HTMLCanvasElement;
  private readonly sctx: CanvasRenderingContext2D;
  private sheet: HTMLCanvasElement;
  paper: string;

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
    this.vctx = view.getContext("2d")!;
    this.paint = canvas(this.width, this.height);
    this.pctx = this.paint.getContext("2d")!;
    this.wet = canvas(this.width, this.height);
    this.wctx = this.wet.getContext("2d")!;
    this.scratch = canvas(this.width, this.height);
    this.sctx = this.scratch.getContext("2d")!;
    this.paper = opts.paper;
    this.sheet = paperSheet(opts.paper, this.width, this.height);
    this.redraw();
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
        this.schedule();
      }, 30);
    }
    this.schedule();
  }

  move(samples: Sample[]) {
    if (!this.live) return;
    for (const at of samples) this.push(at, false);
    this.live.lastMove = performance.now();
    this.schedule();
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
    const spacing = Math.max(0.6, this.size * l.brush.spacing);
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
      this.remember({ x: area.x, y: area.y, before, after: null });
    } else {
      const before = this.pctx.getImageData(area.x, area.y, area.w, area.h);
      this.pctx.save();
      this.pctx.globalCompositeOperation = brush.composite;
      if (brush.dry) {
        const dried = brush.dry(s, this.wet, area);
        this.pctx.globalAlpha = 1;
        this.pctx.drawImage(dried, area.x, area.y);
      } else {
        this.pctx.globalAlpha = brush.id === "eraser" || brush.composite === "multiply" || brush.kind === "path" ? s.opacity : 1;
        this.pctx.drawImage(this.capped(l), area.x, area.y, area.w, area.h, area.x, area.y, area.w, area.h);
      }
      this.pctx.restore();
      this.remember({ x: area.x, y: area.y, before, after: null });
    }
    this.wctx.clearRect(0, 0, this.width, this.height);
    this.marks++;
    this.schedule();
    this.onChange();
  }

  /** the wet stroke held to the paper's grain (dry media), or the wet stroke as it is */
  private capped(l: Live): HTMLCanvasElement {
    const cap = l.brush.grainCap;
    if (!cap) return this.wet;
    const area = this.clampBox(l.box);
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
    this.undoBytes += c.before.data.length;
    for (const r of this.redos) this.undoBytes -= r.before.data.length + (r.after?.data.length ?? 0);
    this.redos = [];
    while (this.undoBytes > UNDO_BYTES && this.undos.length > 1) {
      const old = this.undos.shift()!;
      this.undoBytes -= old.before.data.length + (old.after?.data.length ?? 0);
    }
  }

  undo() {
    if (this.live) this.cancel();
    const c = this.undos.pop();
    if (!c) return;
    if (!c.after) {
      c.after = this.pctx.getImageData(c.x, c.y, c.before.width, c.before.height);
      this.undoBytes += c.after.data.length;
    }
    this.pctx.putImageData(c.before, c.x, c.y);
    this.redos.push(c);
    this.marks++;
    this.schedule();
    this.onChange();
  }

  redo() {
    const c = this.redos.pop();
    if (!c || !c.after) return;
    this.pctx.putImageData(c.after, c.x, c.y);
    this.undos.push(c);
    this.marks++;
    this.schedule();
    this.onChange();
  }

  clear() {
    if (this.live) this.cancel();
    const before = this.pctx.getImageData(0, 0, this.width, this.height);
    this.pctx.clearRect(0, 0, this.width, this.height);
    this.remember({ x: 0, y: 0, before, after: null });
    this.marks++;
    this.schedule();
    this.onChange();
  }

  /** a blank sheet with nothing to undo, for a fresh start */
  wipe() {
    if (this.live) this.cancel();
    this.pctx.clearRect(0, 0, this.width, this.height);
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
    this.remember({ x: x0, y: y0, before, after: null });
    this.marks++;
    this.schedule();
    this.onChange();
  }

  /** the colour on the sheet at a point, paper included */
  pick(x: number, y: number): string {
    const c = this.sctx;
    c.globalCompositeOperation = "copy";
    c.drawImage(this.sheet, 0, 0);
    c.globalCompositeOperation = "source-over";
    c.drawImage(this.paint, 0, 0);
    const d = c.getImageData(Math.max(0, Math.min(this.width - 1, Math.floor(x))), Math.max(0, Math.min(this.height - 1, Math.floor(y))), 1, 1).data;
    return hexOf(d[0], d[1], d[2]);
  }

  // ─── showing it ──────────────────────────────────────────────────

  private schedule() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (this.live?.brush.kind === "path") this.drawPath(false);
      this.redraw();
    });
  }

  private redraw() {
    const v = this.vctx;
    v.globalCompositeOperation = "source-over";
    v.globalAlpha = 1;
    v.drawImage(this.sheet, 0, 0);
    const l = this.live;
    if (l && !l.brush.direct && l.brush.composite === "destination-out") {
      // erasing: show the drawing with the wet stroke taken out of it
      const c = this.sctx;
      c.globalCompositeOperation = "copy";
      c.globalAlpha = 1;
      c.drawImage(this.paint, 0, 0);
      c.globalCompositeOperation = "destination-out";
      c.globalAlpha = l.s.opacity;
      c.drawImage(this.wet, 0, 0);
      c.globalCompositeOperation = "source-over";
      c.globalAlpha = 1;
      v.drawImage(this.scratch, 0, 0);
      return;
    }
    v.drawImage(this.paint, 0, 0);
    if (l && !l.brush.direct) {
      v.globalCompositeOperation = l.brush.composite;
      const whole = l.brush.composite === "multiply" || l.brush.kind === "path";
      v.globalAlpha = l.brush.live * (whole ? l.s.opacity : 1);
      const area = this.clampBox(l.box);
      if (area) v.drawImage(this.capped(l), area.x, area.y, area.w, area.h, area.x, area.y, area.w, area.h);
      v.globalCompositeOperation = "source-over";
      v.globalAlpha = 1;
    }
  }

  // ─── in and out ──────────────────────────────────────────────────

  /** the sheet with the drawing on it */
  flatten(): HTMLCanvasElement {
    const out = canvas(this.width, this.height);
    const c = out.getContext("2d")!;
    c.drawImage(this.sheet, 0, 0);
    c.drawImage(this.paint, 0, 0);
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

  /** the drawing alone (no paper), to keep for a reload */
  snapshot(): string {
    return this.paint.toDataURL("image/webp", 0.92);
  }

  /** puts a picture back: a snapshot of our own, or a drawing already sent */
  async load(src: string): Promise<void> {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    await img.decode();
    this.cancel();
    this.pctx.clearRect(0, 0, this.width, this.height);
    this.pctx.drawImage(img, 0, 0, this.width, this.height);
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
