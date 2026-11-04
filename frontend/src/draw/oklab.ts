/*
 * Colour the way eyes see it: OKLab (Björn Ottosson, 2020) and its polar
 * form OKLCH, lightness, chroma and hue. Equal steps in it look like equal
 * steps, so a picker laid out in it has no dead corners, and two paints mixed
 * in it go through the colours real paint would, not the muddy grey that
 * averaging sRGB numbers gives. Everything still lands in sRGB, what a
 * canvas and a screen take; a colour past what sRGB can show is brought in by
 * lowering its chroma, keeping its lightness and hue.
 */
import { hexOf, rgbOf } from "./paper";

export interface Lab {
  L: number;
  a: number;
  b: number;
}
export interface Lch {
  /** 0 black .. 1 white */
  L: number;
  /** 0 grey .. about 0.37 at sRGB's most vivid */
  C: number;
  /** degrees */
  H: number;
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** sRGB 0..255 to OKLab */
export function labOf(r: number, g: number, b: number): Lab {
  const R = toLinear(r / 255);
  const G = toLinear(g / 255);
  const B = toLinear(b / 255);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** OKLab to linear sRGB, 0..1 and maybe beyond (out of gamut) */
function linearOf({ L, a, b }: Lab): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const EPS = 0.0005;
/** whether a screen in sRGB can show it */
export const inGamut = (lab: Lab) => linearOf(lab).every((v) => v >= -EPS && v <= 1 + EPS);

/** OKLab to sRGB 0..255, clipped */
export function rgbOfLab(lab: Lab): [number, number, number] {
  return linearOf(lab).map((v) => Math.round(255 * toGamma(Math.min(1, Math.max(0, v))))) as [number, number, number];
}

export const lchOf = ({ L, a, b }: Lab): Lch => {
  const C = Math.hypot(a, b);
  const H = C < 1e-4 ? 0 : ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { L, C, H };
};
export const labOfLch = ({ L, C, H }: Lch): Lab => ({
  L,
  a: C * Math.cos((H * Math.PI) / 180),
  b: C * Math.sin((H * Math.PI) / 180),
});

/** brought into sRGB by giving up chroma only: the same lightness and hue, as vivid as it can be */
export function fit(lch: Lch): Lch {
  if (inGamut(labOfLch(lch))) return lch;
  let lo = 0;
  let hi = lch.C;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(labOfLch({ ...lch, C: mid }))) lo = mid;
    else hi = mid;
  }
  return { ...lch, C: lo };
}

export const hexOfLch = (lch: Lch) => {
  const [r, g, b] = rgbOfLab(labOfLch(fit(lch)));
  return hexOf(r, g, b);
};
export const lchOfHex = (hex: string) => {
  const [r, g, b] = rgbOf(hex);
  return lchOf(labOf(r, g, b));
};

/** two colours mixed the way paint mixes, t of the way from a to b */
export function mix(a: string, b: string, t: number): string {
  const A = labOf(...rgbOf(a));
  const B = labOf(...rgbOf(b));
  const [r, g, bl] = rgbOfLab({ L: A.L + (B.L - A.L) * t, a: A.a + (B.a - A.a) * t, b: A.b + (B.b - A.b) * t });
  return hexOf(r, g, bl);
}
