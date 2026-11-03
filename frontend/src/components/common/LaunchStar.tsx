import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { camera, inMotion, PLACES, shownSpace, sinceLaunch } from "../../hooks/useSpace";
import { paintStar } from "../Dashboard/Welcome/starPaint";

const clamp = (x: number) => Math.min(1, Math.max(0, x));

/**
 * The front page's star, seen from the loading planet: while the site loads
 * it's a small line of light at the top of the sky. When the camera climbs,
 * it comes down toward where it lives on the poster and grows as we near it,
 * the line opening into the whole star. On arrival it stays put, right on the
 * poster's own, which grows out of it (welcome.css), so the star only seems
 * to shine harder; then this one fades away under it. Drawn only while it
 * changes. :root[data-star] says how far it's got: "flying", "landed".
 */
export const LaunchStar: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [gone, setGone] = useState(false);
  // the poster's star and the sidebar wait for it (welcome.css, sidebar.css)
  useLayoutEffect(() => {
    document.documentElement.dataset.star = "flying";
    return () => void delete document.documentElement.dataset.star;
  }, []);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const from = PLACES.loading.alt;
    let raf = 0;
    let drawn = "";
    let landed = false;
    let finished = false;
    const land = () => {
      if (landed) return;
      landed = true;
      document.documentElement.dataset.star = "landed";
      window.setTimeout(() => setGone(true), 1500);
      // done, once everything waiting on it has arrived (welcome.css): nothing is drawn any more
      window.setTimeout(() => {
        finished = true;
        cancelAnimationFrame(raf);
        window.clearInterval(backstop);
        delete document.documentElement.dataset.star;
        setOver(true);
      }, 5000);
    };
    // in a tab nobody's looking at there are no frames: the page mustn't wait on them
    const backstop = window.setInterval(() => shownSpace().place !== "loading" && sinceLaunch() > 7000 && land(), 1000);
    const frame = () => {
      if (finished) return;
      raf = requestAnimationFrame(frame);
      const { place } = shownSpace();
      const to = PLACES[place === "loading" ? "front" : place].alt;
      // how far up we are: none while loading; with the camera still, there at once
      let near = place === "loading" ? 0 : inMotion() ? clamp((camera.x - from) / (to - from)) : 1;
      // landed when the camera has all but stopped; from then on it sits exactly on the poster's
      if (place !== "loading" && (near > 0.998 || sinceLaunch() > 6000)) land();
      if (landed) near = 1;

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
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(backstop);
    };
  }, []);

  if (over) return null;
  return <canvas ref={ref} className={`jqzz-launch-star${gone ? " gone" : ""}`} aria-hidden="true" />;
};
