import React, { useId } from "react";

/* The aura's own colours, so a generated face looks like it came from here. */
const PALETTE = ["#a48cff", "#f2a989", "#7fb2ff", "#f08cb0", "#8fa3c7", "#b9a6ff", "#9fe0b8"];
const INK = "#0b0912";
const PAPER = "#f8f5fd";
/** the chromatic split the blackletter titles use */
const SPLIT_A = "#ff5c8c";
const SPLIT_B = "#5aaaff";

/** FNV-1a: a string into a 32 bit seed */
function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: small, fast, and the same numbers for the same seed everywhere */
function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** a four-point star like the app's own --star, centred on 0,0, radius 1 */
const STAR = "M0-1C.05-.4.4-.05 1 0 .4.05.05.4 0 1-.05.4-.4.05-1 0-.4-.05-.05-.4 0-1Z";

interface GenAvatarProps {
  /** anything; the same seed always draws the same face */
  seed: string;
  /** its first letter becomes the blackletter initial */
  name?: string;
}

/**
 * A generated profile picture, in five layers, back to front:
 * an aura of two colours, a dithered halftone blob, an orbit line,
 * a blackletter initial with the chromatic split, and grain over all of it.
 * Drawn as SVG from the seed, so nothing is stored but the seed.
 */
export const GenAvatar: React.FC<GenAvatarProps> = ({ seed, name }) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const r = random(hash(seed));
  const pick = <T,>(from: T[]) => from[Math.floor(r() * from.length)];

  const colours = [...PALETTE];
  const take = () => colours.splice(Math.floor(r() * colours.length), 1)[0];
  const glow = take();
  const warm = take();
  const dots = take();

  const glowAt = { x: 0.15 + r() * 0.5, y: 0.1 + r() * 0.45 };
  const warmAt = { x: 0.45 + r() * 0.5, y: 0.5 + r() * 0.45 };
  const blob = { x: 10 + r() * 44, y: 10 + r() * 44, r: 14 + r() * 12 };
  const orbit = { rx: 22 + r() * 9, ry: 6 + r() * 8, tilt: -45 + r() * 90, dy: -4 + r() * 10 };
  const spark = { x: pick([12, 50]), y: pick([12, 50]), s: 3.5 + r() * 3, c: pick(PALETTE) };
  const grainSeed = Math.floor(r() * 1000);

  const letter = (name?.match(/[a-z0-9]/i)?.[0] ?? "J").toUpperCase();
  const id = (part: string) => `ga${uid}${part}`;

  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true" className="jqzz-genav">
      <defs>
        <radialGradient id={id("g")} cx={glowAt.x} cy={glowAt.y} r="0.8">
          <stop offset="0" stopColor={glow} stopOpacity="0.95" />
          <stop offset="1" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("w")} cx={warmAt.x} cy={warmAt.y} r="0.6">
          <stop offset="0" stopColor={warm} stopOpacity="0.85" />
          <stop offset="1" stopColor={warm} stopOpacity="0" />
        </radialGradient>
        <pattern id={id("d")} width="3" height="3" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.7" fill={dots} />
        </pattern>
        <radialGradient id={id("f")}>
          <stop offset="0.2" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </radialGradient>
        <mask id={id("m")}>
          <circle cx={blob.x} cy={blob.y} r={blob.r} fill={`url(#${id("f")})`} />
        </mask>
        <filter id={id("n")} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" seed={grainSeed} />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </defs>

      {/* ink, then the aura */}
      <rect width="64" height="64" fill={INK} />
      <rect width="64" height="64" fill={`url(#${id("g")})`} />
      <rect width="64" height="64" fill={`url(#${id("w")})`} />

      {/* the halftone blob, like the dither behind the app */}
      <rect width="64" height="64" fill={`url(#${id("d")})`} mask={`url(#${id("m")})`} opacity="0.85" />

      {/* an orbit, like the one around the welcome logo */}
      <ellipse
        cx="32"
        cy={32 + orbit.dy}
        rx={orbit.rx}
        ry={orbit.ry}
        fill="none"
        stroke={PAPER}
        strokeOpacity="0.4"
        strokeWidth="0.8"
        transform={`rotate(${orbit.tilt} 32 ${32 + orbit.dy})`}
      />

      {/* the initial, with the same chromatic split as the titles */}
      <g
        fontFamily='"Old English Five", "UnifrakturMaguntia", serif'
        fontSize="40"
        textAnchor="middle"
        dominantBaseline="central"
      >
        <text x="30.4" y="33" fill={SPLIT_A} opacity="0.6">
          {letter}
        </text>
        <text x="33.6" y="33" fill={SPLIT_B} opacity="0.6">
          {letter}
        </text>
        <text x="32" y="33" fill={PAPER}>
          {letter}
        </text>
      </g>

      {/* a spark in one corner */}
      <path
        d={STAR}
        fill={spark.c}
        transform={`translate(${spark.x} ${spark.y}) scale(${spark.s})`}
      />

      {/* grain over everything */}
      <rect
        width="64"
        height="64"
        filter={`url(#${id("n")})`}
        opacity="0.45"
        style={{ mixBlendMode: "overlay" }}
      />
    </svg>
  );
};
