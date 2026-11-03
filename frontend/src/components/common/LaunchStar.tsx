import React, { useEffect, useRef, useState } from "react";
import { camera, inMotion, PLACES, shownSpace, sinceLaunch } from "../../hooks/useSpace";
import { paintStar } from "../Dashboard/Welcome/starPaint";

const clamp = (x: number) => Math.min(1, Math.max(0, x));

/**
 * The front page's star, seen from the loading planet: while the site loads
 * it's a small line of light at the top of the sky. When the camera climbs,
 * it comes down toward where it lives on the poster and grows as we near it,
 * the line opening into the whole star; on arrival it hands over to the
 * poster's own (Welcome, .launching) and goes. Drawn only while it changes.
 */
export const LaunchStar: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [gone, setGone] = useState(false);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const from = PLACES.loading.alt;
    let raf = 0;
    let drawn = "";
    let landed = false;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const { place } = shownSpace();
      const to = PLACES[place === "loading" ? "front" : place].alt;
      // how far up we are: none while loading; with the camera still, there at once
      const near = place === "loading" ? 0 : inMotion() ? clamp((camera.x - from) / (to - from)) : 1;
      if (!landed && place !== "loading" && (near > 0.985 || sinceLaunch() > 6000)) {
        landed = true;
        document.documentElement.dataset.star = "landed";
        setGone(true);
        window.setTimeout(() => setOver(true), 450);
      }

      // where it lives: the poster's star, once the poster is there
      const W = window.innerWidth;
      const Hs = window.innerHeight;
      let tx = W / 2;
      let ty = Hs * 0.7;
      let H = W * 0.55;
      let V = Hs * 0.4;
      const star = document.querySelector(".jqzz-poster.launching .p-star");
      const core = document.querySelector(".jqzz-poster.launching .p-star-core");
      if (star && core) {
        const at = star.getBoundingClientRect();
        const size = core.getBoundingClientRect();
        tx = at.left;
        ty = at.top;
        H = size.width / 2;
        V = size.height / 2;
      }

      // far off it's small and high; it comes down and grows the nearer we get
      const zoom = 0.1 + 0.9 * near ** 1.6;
      const y = Hs * 0.1 + (ty - Hs * 0.1) * near ** 1.3;
      const k = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.round(W * k);
      const h = Math.round(Hs * k);
      const key = `${w}:${h}:${near.toFixed(3)}:${tx.toFixed(0)}:${y.toFixed(0)}`;
      if (key === drawn) return;
      drawn = key;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);
      // the line keeps some length even far off, or it would be a dot
      paintStar(ctx, tx * k, y * k, H * zoom * k, V * Math.max(zoom, 0.22) * k, ((V * 2) / 760) * zoom * k, k, near, false);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (over) return null;
  return <canvas ref={ref} className={`jqzz-launch-star${gone ? " gone" : ""}`} aria-hidden="true" />;
};
