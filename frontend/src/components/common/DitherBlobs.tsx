import React, { useEffect, useRef } from "react";

// 8x8 Bayer matrix, normalised to 0..1: ordered dithering, like print halftone
const BAYER = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28,
  52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39,
  13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
].map((v) => (v + 0.5) / 64);

/** chunk size of one dither cell, in CSS pixels */
const CELL = 4;

// blob centres and radii in viewport fractions; colour picks a CSS token
const BLOBS = [
  { x: 0.82, y: 0.16, r: 0.34, k: 0.95, color: "--phase-QUESTION" },
  { x: 0.96, y: 0.88, r: 0.3, k: 0.9, color: "--warm" },
  { x: 0.08, y: 0.94, r: 0.28, k: 0.8, color: "--phase-ANSWER" },
  { x: 0.5, y: 0.62, r: 0.16, k: 0.45, color: "--phase-RESULT" },
];

function hexToRgb(value: string): [number, number, number] {
  const hex = value.trim().replace("#", "");
  const full = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex;
  const n = parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Dithered colour blobs behind the app. Drawn once at a quarter resolution
 * and scaled up with hard pixel edges, so it costs nothing per frame; it
 * only redraws on resize or when the appearance switches.
 */
export const DitherBlobs: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const draw = () => {
      // a window with no size yet (a background tab, a hidden pane) still gets
      // a pixel: createImageData throws on zero and would take the app with it
      const w = Math.max(1, Math.ceil(window.innerWidth / CELL));
      const h = Math.max(1, Math.ceil(window.innerHeight / CELL));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const css = getComputedStyle(document.documentElement);
      const colors = BLOBS.map((b) => hexToRgb(css.getPropertyValue(b.color) || "#8b6cff"));
      const unit = Math.min(w, h);
      const img = ctx.createImageData(w, h);
      const data = img.data;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let best = 0;
          let bestIdx = 0;
          let sum = 0;
          for (let i = 0; i < BLOBS.length; i++) {
            const b = BLOBS[i];
            const dx = (x - b.x * w) / (b.r * unit);
            const dy = (y - b.y * h) / (b.r * unit);
            const f = b.k * Math.exp(-(dx * dx + dy * dy));
            sum += f;
            if (f > best) {
              best = f;
              bestIdx = i;
            }
          }
          if (Math.min(sum, 1) <= BAYER[(y & 7) * 8 + (x & 7)]) continue;
          const o = (y * w + x) * 4;
          const c = colors[bestIdx];
          data[o] = c[0];
          data[o + 1] = c[1];
          data[o + 2] = c[2];
          data[o + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    };

    draw();
    let t = 0;
    let drawnW = window.innerWidth;
    let drawnH = window.innerHeight;
    const onResize = () => {
      // a phone's address bar sliding in and out is a resize too, on every
      // scroll; the blobs only need redrawing when the window really changed
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w === drawnW && Math.abs(h - drawnH) < 160) return;
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        drawnW = window.innerWidth;
        drawnH = window.innerHeight;
        draw();
      }, 150);
    };
    const scheme = window.matchMedia("(prefers-color-scheme: light)");
    window.addEventListener("resize", onResize);
    scheme.addEventListener("change", draw);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", onResize);
      scheme.removeEventListener("change", draw);
    };
  }, []);

  return <canvas ref={ref} className="jqzz-dither" aria-hidden="true" />;
};
