import React, { useEffect, useRef } from "react";

const COLOURS = ["#b9a6ff", "#f2a989", "#7fb2ff", "#f08cb0", "#9fe0b8", "#f8f5fd"];

/**
 * A burst of paper in the aura's colours, once, when the scores are final.
 * A canvas over everything that lets clicks through, gone after a few seconds.
 */
export const Confetti: React.FC<{ pieces?: number }> = ({ pieces = 140 }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = (canvas.width = window.innerWidth * dpr);
    const h = (canvas.height = window.innerHeight * dpr);
    const parts = Array.from({ length: pieces }, (_, i) => ({
      x: w * (0.2 + 0.6 * Math.random()),
      y: h * 0.35,
      vx: (Math.random() - 0.5) * 22 * dpr,
      vy: (-8 - Math.random() * 18) * dpr,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      s: (5 + Math.random() * 7) * dpr,
      c: COLOURS[i % COLOURS.length],
    }));
    let frame = 0;
    let raf = 0;
    const tick = () => {
      frame++;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.vy += 0.45 * dpr;
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.globalAlpha = Math.max(0, 1 - frame / 220);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (frame < 220) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pieces]);

  return <canvas ref={ref} className="jqzz-confetti" aria-hidden="true" />;
};
