import React, { useEffect, useRef } from "react";

/**
 * The poster's star, the way a camera sees a point of light too bright for
 * it: a blown-out core, a bloom round it, and the long thin + of the
 * aperture's diffraction, fringed with colour where the lens splits it.
 * Drawn once into a canvas (additively, like light), again only on resize.
 */
export const StarFlare: React.FC<{ className?: string }> = ({ className }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const k = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * k));
      const h = Math.max(1, Math.round(canvas.clientHeight * k));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      paint(ctx, w, h, k);
    };
    draw();
    if (typeof ResizeObserver === "undefined") return;
    let t = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(t);
      t = window.setTimeout(draw, 120);
    });
    ro.observe(canvas);
    return () => {
      window.clearTimeout(t);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
};

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, stops: [number, string][]) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  stops.forEach(([at, c]) => g.addColorStop(at, c));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/**
 * One arm pair of the +: a needle through the centre, widest there and
 * thinning to nothing at the tips, its light falling off along the way.
 */
function spike(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  length: number,
  width: number,
  vertical: boolean,
  colour: [number, number, number],
  alpha: number,
) {
  ctx.save();
  ctx.translate(cx, cy);
  if (vertical) ctx.rotate(Math.PI / 2);
  const g = ctx.createLinearGradient(-length, 0, length, 0);
  const [r, gg, b] = colour;
  const at = (a: number) => `rgba(${r}, ${gg}, ${b}, ${a * alpha})`;
  // light along a diffraction spike falls off slowly, then all at once
  const stops: [number, number][] = [
    [0, 0],
    [0.06, 0.06],
    [0.18, 0.18],
    [0.3, 0.36],
    [0.4, 0.58],
    [0.46, 0.85],
    [0.5, 1],
  ];
  stops.forEach(([p, v]) => g.addColorStop(p, at(v)));
  stops
    .slice(0, -1)
    .reverse()
    .forEach(([p, v]) => g.addColorStop(1 - p, at(v)));
  ctx.fillStyle = g;
  ctx.beginPath();
  // a long, thin lens shape: curved sides so it thins smoothly, not like a kite
  ctx.moveTo(-length, 0);
  ctx.quadraticCurveTo(-length * 0.08, -width, 0, -width);
  ctx.quadraticCurveTo(length * 0.08, -width, length, 0);
  ctx.quadraticCurveTo(length * 0.08, width, 0, width);
  ctx.quadraticCurveTo(-length * 0.08, width, -length, 0);
  ctx.fill();
  ctx.restore();
}

function paint(ctx: CanvasRenderingContext2D, w: number, h: number, k: number) {
  const cx = w / 2;
  const cy = h / 2;
  const s = h / 760; // the size the canvas is drawn for
  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = "lighter";

  // the wide haze the light throws into the lens, warm and violet
  glow(ctx, cx, cy, 340 * s, [
    [0, "rgba(255, 170, 205, 0.20)"],
    [0.35, "rgba(190, 140, 255, 0.08)"],
    [1, "rgba(120, 90, 255, 0)"],
  ]);

  // the + : soft wide passes first, then the sharp needles, with a red and a
  // blue copy a little longer and shorter for the lens's colour split
  const H = w / 2; // horizontal arms reach the edges
  const V = h / 2;
  ctx.filter = `blur(${6 * k}px)`;
  spike(ctx, cx, cy, H * 0.9, 9 * s, false, [255, 150, 200], 0.45);
  spike(ctx, cx, cy, V * 0.9, 8 * s, true, [255, 150, 200], 0.4);
  ctx.filter = `blur(${1.5 * k}px)`;
  spike(ctx, cx, cy, H, 3 * s, false, [255, 120, 150], 0.7);
  spike(ctx, cx, cy, H * 0.85, 3 * s, false, [140, 170, 255], 0.6);
  spike(ctx, cx, cy, V, 2.8 * s, true, [255, 120, 150], 0.65);
  spike(ctx, cx, cy, V * 0.82, 2.8 * s, true, [140, 170, 255], 0.55);
  ctx.filter = "none";
  spike(ctx, cx, cy, H * 0.96, 1.3 * s, false, [255, 245, 250], 1);
  spike(ctx, cx, cy, V * 0.9, 1.3 * s, true, [255, 245, 250], 1);
  // a faint second set at 45°, much shorter: the aperture's other blades
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.translate(-cx, -cy);
  ctx.filter = `blur(${1 * k}px)`;
  spike(ctx, cx, cy, 70 * s, 1.4 * s, false, [255, 220, 240], 0.35);
  spike(ctx, cx, cy, 70 * s, 1.4 * s, true, [255, 220, 240], 0.35);
  ctx.filter = "none";
  ctx.restore();

  // bloom, and the core where the sensor simply gives up
  glow(ctx, cx, cy, 70 * s, [
    [0, "rgba(255, 236, 246, 0.95)"],
    [0.25, "rgba(255, 196, 225, 0.55)"],
    [0.6, "rgba(220, 150, 255, 0.12)"],
    [1, "rgba(200, 140, 255, 0)"],
  ]);
  glow(ctx, cx, cy, 16 * s, [
    [0, "rgba(255, 255, 255, 1)"],
    [0.45, "rgba(255, 255, 255, 1)"],
    [1, "rgba(255, 240, 248, 0)"],
  ]);
  ctx.globalCompositeOperation = "source-over";
}
