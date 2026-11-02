/*
 * Paper: the surface every drawing sits on, and the grain the dry media
 * catch on. A grain is a tileable height map (0 valley, 1 peak); pencil,
 * charcoal and crayon deposit pigment through it, so their marks break up
 * the way they do on real paper, and the breakup stays put on the sheet
 * instead of moving with the brush.
 */

/** seeded random, so every sheet and every stroke can be made again exactly */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** value noise on a lattice that wraps, so the tile repeats without a seam */
function tiledNoise(size: number, cells: [number, number], seed: number): Float32Array {
  const [cx, cy] = cells;
  const r = rng(seed);
  const lattice = new Float32Array(cx * cy);
  for (let i = 0; i < lattice.length; i++) lattice[i] = r();
  const out = new Float32Array(size * size);
  const fade = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    const gy = (y / size) * cy;
    const y0 = Math.floor(gy);
    const ty = fade(gy - y0);
    const y1 = (y0 + 1) % cy;
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * cx;
      const x0 = Math.floor(gx);
      const tx = fade(gx - x0);
      const x1 = (x0 + 1) % cx;
      const a = lattice[y0 * cx + x0];
      const b = lattice[y0 * cx + x1];
      const c = lattice[y1 * cx + x0];
      const d = lattice[y1 * cx + x1];
      out[y * size + x] = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    }
  }
  return out;
}

/** octaves of noise added up, then stretched to fill 0..1 */
function fbm(size: number, octaves: { cells: [number, number]; weight: number }[], seed: number): Float32Array {
  const out = new Float32Array(size * size);
  octaves.forEach((o, i) => {
    const n = tiledNoise(size, o.cells, seed + i * 101);
    for (let k = 0; k < out.length; k++) out[k] += n[k] * o.weight;
  });
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of out) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const span = hi - lo || 1;
  for (let k = 0; k < out.length; k++) out[k] = (out[k] - lo) / span;
  return out;
}

export type GrainId = "fine" | "tooth" | "wax" | "cold";

export interface Grain {
  size: number;
  height: Float32Array;
}

const grains = new Map<GrainId, Grain>();

/** fine: drawing paper for pencil; tooth: pastel paper for charcoal; wax: streaks; cold: watercolor paper */
export function grain(id: GrainId): Grain {
  const have = grains.get(id);
  if (have) return have;
  let g: Grain;
  if (id === "fine") {
    g = {
      size: 256,
      height: fbm(256, [
        { cells: [128, 128], weight: 0.55 },
        { cells: [64, 64], weight: 0.3 },
        { cells: [16, 16], weight: 0.15 },
      ], 11),
    };
  } else if (id === "tooth") {
    g = {
      size: 256,
      height: fbm(256, [
        { cells: [48, 48], weight: 0.5 },
        { cells: [96, 96], weight: 0.3 },
        { cells: [12, 12], weight: 0.2 },
      ], 23),
    };
  } else if (id === "wax") {
    // stretched one way: crayon drags across the ridges of the sheet
    g = {
      size: 256,
      height: fbm(256, [
        { cells: [16, 128], weight: 0.5 },
        { cells: [32, 256], weight: 0.3 },
        { cells: [64, 64], weight: 0.2 },
      ], 37),
    };
  } else {
    g = {
      size: 512,
      height: fbm(512, [
        { cells: [24, 24], weight: 0.45 },
        { cells: [64, 64], weight: 0.35 },
        { cells: [160, 160], weight: 0.2 },
      ], 53),
    };
  }
  grains.set(id, g);
  return g;
}

/** a hex colour as numbers */
export function rgbOf(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hexOf(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** lighter (amount > 0) or darker (< 0), in the colour's own direction */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = rgbOf(hex);
  const to = amount > 0 ? 255 : 0;
  const k = Math.abs(amount);
  return hexOf(r + (to - r) * k, g + (to - g) * k, b + (to - b) * k);
}

const patterns = new Map<string, HTMLCanvasElement>();

/**
 * A tile of the grain in one colour: the colour where the paper stands up,
 * fading out into its valleys. `bite` is how deep the pigment reaches (0: only
 * the very peaks, 1: nearly everything).
 */
export function grainTile(id: GrainId, color: string, bite: number): HTMLCanvasElement {
  const key = `${id}|${color}|${bite.toFixed(2)}`;
  const have = patterns.get(key);
  if (have) return have;
  const g = grain(id);
  const c = document.createElement("canvas");
  c.width = c.height = g.size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(g.size, g.size);
  const [r, gg, b] = rgbOf(color);
  const floor = 1 - bite;
  for (let i = 0; i < g.height.length; i++) {
    const h = g.height[i];
    // smoothstep from the floor upwards: peaks take the pigment first
    const t = Math.max(0, Math.min(1, (h - floor + 0.18) / 0.36));
    const a = t * t * (3 - 2 * t);
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = gg;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = Math.round(a * 255);
  }
  ctx.putImageData(img, 0, 0);
  if (patterns.size > 48) patterns.delete(patterns.keys().next().value!);
  patterns.set(key, c);
  return c;
}

export interface PaperInfo {
  id: string;
  label: string;
  color: string;
  /** how strongly the sheet's own texture shows */
  texture: number;
  grain: GrainId;
}

export const PAPERS: PaperInfo[] = [
  { id: "white", label: "white", color: "#fbfaf7", texture: 0.05, grain: "fine" },
  { id: "cream", label: "cream", color: "#f4ecda", texture: 0.07, grain: "tooth" },
  { id: "cold", label: "watercolor", color: "#f7f5ef", texture: 0.1, grain: "cold" },
  { id: "kraft", label: "kraft", color: "#c9a77c", texture: 0.09, grain: "tooth" },
  { id: "grey", label: "toned grey", color: "#bdbab4", texture: 0.07, grain: "fine" },
];

export const paperInfo = (id: string) => PAPERS.find((p) => p.id === id) ?? PAPERS[0];

/** the whole sheet, its colour with its texture shaded in */
export function paperSheet(id: string, width: number, height: number): HTMLCanvasElement {
  const info = paperInfo(id);
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = info.color;
  ctx.fillRect(0, 0, width, height);
  const g = grain(info.grain);
  const tile = document.createElement("canvas");
  tile.width = tile.height = g.size;
  const tctx = tile.getContext("2d")!;
  const img = tctx.createImageData(g.size, g.size);
  for (let i = 0; i < g.height.length; i++) {
    // valleys sit in shadow, peaks catch the light
    const v = g.height[i];
    const dark = v < 0.5;
    const k = Math.abs(v - 0.5) * 2;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = dark ? 0 : 255;
    img.data[i * 4 + 3] = Math.round(k * info.texture * 255 * (dark ? 1 : 0.6));
  }
  tctx.putImageData(img, 0, 0);
  ctx.fillStyle = ctx.createPattern(tile, "repeat")!;
  ctx.fillRect(0, 0, width, height);
  return c;
}
