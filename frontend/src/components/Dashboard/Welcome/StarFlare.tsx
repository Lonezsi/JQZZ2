import React, { useEffect, useRef } from "react";
import { paintStar } from "./starPaint";

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

function paint(ctx: CanvasRenderingContext2D, w: number, h: number, k: number) {
  ctx.clearRect(0, 0, w, h);
  paintStar(ctx, w / 2, h / 2, w / 2, h / 2, h / 760, k, 1, true);
}
