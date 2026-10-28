import React, { useEffect, useRef, useState } from "react";
import { DitherBlobs } from "./DitherBlobs";

const PHASES = ["IDLE", "WAITING", "QUESTION", "ANSWER", "ELABORATION", "RESULT"];
const BASE = import.meta.env.BASE_URL;

/**
 * Everything behind the UI, back to front: paper/ink, phase light,
 * dithered blobs, the blended lens textures, then grain.
 */
export const Atmosphere: React.FC = () => {
  useMovingLights();
  return (
    <div className="jqzz-aura" aria-hidden="true">
      <span className="shadow" />
      <span className="warm" />
      {PHASES.map((p) => (
        <span key={p} className={`phase phase-${p}`} />
      ))}
      <DitherBlobs />
      <Texture className="tex-floor" src={`${BASE}bg.jpg`} filter={() => "contrast(0.5)"} />
      <Texture
        className="tex-lens-a"
        src="https://texturelabs.org/wp-content/uploads/Texturelabs_LensFX_171S.jpg"
        filter={() => "hue-rotate(-20deg) brightness(3) saturate(0.5)"}
      />
      <Texture
        className="tex-lens-b"
        src="https://texturelabs.org/wp-content/uploads/Texturelabs_LensFX_130S.jpg"
        filter={(k) => `blur(${2 * k}px) hue-rotate(-80deg)`}
      />
    </div>
  );
};

/** can a canvas apply CSS filters as it draws? (Safari only learned late) */
const canBake = (() => {
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx || !("filter" in ctx)) return false;
    ctx.filter = "blur(1px)";
    return ctx.filter === "blur(1px)";
  } catch {
    return false;
  }
})();

/**
 * One of the blended textures. Its filter used to be live CSS, which the
 * browser reapplied to the whole screen on every frame the lights moved
 * beneath it. Here it's applied once, while drawing the picture into a
 * canvas the size of the window (cover-fit, like the background it was), and
 * again only when the window really changes size. Where a canvas can't
 * filter, it stays the plain CSS layer it was.
 */
const Texture: React.FC<{ className: string; src: string; filter: (scale: number) => string }> = ({
  className,
  src,
  filter,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const filterRef = useRef(filter);
  const [baked, setBaked] = useState(canBake);

  useEffect(() => {
    filterRef.current = filter;
  });

  useEffect(() => {
    if (!baked) return;
    const canvas = ref.current;
    if (!canvas) return;
    const img = new Image();
    let drawnW = 0;
    let drawnH = 0;
    const draw = () => {
      const k = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.round(window.innerWidth * k));
      const h = Math.max(1, Math.round(window.innerHeight * k));
      drawnW = window.innerWidth;
      drawnH = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx || !img.naturalWidth) return;
      // cover, centred
      const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * s;
      const dh = img.naturalHeight * s;
      ctx.filter = filterRef.current(k);
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    };
    let t = 0;
    const onResize = () => {
      // a phone's address bar sliding is a resize on every scroll: skip small ones
      if (window.innerWidth === drawnW && Math.abs(window.innerHeight - drawnH) < 160) return;
      window.clearTimeout(t);
      t = window.setTimeout(draw, 200);
    };
    img.onload = draw;
    img.onerror = () => setBaked(false);
    img.src = src;
    window.addEventListener("resize", onResize);
    return () => {
      img.onload = null;
      img.onerror = null;
      window.clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, [baked, src]);

  return baked ? (
    <canvas ref={ref} className={`tex ${className} baked`} />
  ) : (
    <span className={`tex ${className}`} />
  );
};

/* ─── the lights move ────────────────────────────────────────────────
   Each light drifts slowly on its own (to and fro, eased), and the lot lean
   toward the pointer, each at its own depth, so it reads as space rather
   than a slide. On a phone they follow how it's tilted instead.

   This runs as one small loop writing transforms straight onto the three
   lights, rather than CSS animations plus a variable on the root: a root
   variable made the browser recheck every element's style on every frame,
   and a 60fps drift made it re-mix the whole blended background just as
   often. Drifting a few pixels a second needs 15 frames a second; catching
   up with the pointer gets 30. Nothing else on the page is touched. */

interface Light {
  /** px it leans at full tilt, x and y */
  lean: [number, number];
  /** drift from / to: translate in % of its own size, then scale */
  from: [number, number, number];
  to: [number, number, number];
  /** seconds for one way */
  period: number;
}

const LIGHTS: Record<string, Light> = {
  phase: { lean: [70, 50], from: [-4, 2, 1], to: [5, -3, 1.12], period: 26 },
  warm: { lean: [-90, -60], from: [3, 0, 1.05], to: [-6, -5, 0.95], period: 31 },
  shadow: { lean: [40, -30], from: [0, -2, 0.96], to: [6, 4, 1.08], period: 37 },
};
const BURST_LEAN: [number, number] = [24, 18];

let users = 0;
let stopLights: (() => void) | null = null;
const target = { x: 0, y: 0 };

/** ease-in-out, like the cubic-bezier(0.65, 0, 0.35, 1) the drift used */
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function startLights(): () => void {
  const lean = { x: 0, y: 0 };
  let raf = 0;
  let last = 0;
  const started = performance.now();

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const settling = Math.abs(target.x - lean.x) + Math.abs(target.y - lean.y) > 0.002;
    const gap = now - last;
    if (gap < (settling ? 33 : 66)) return;
    last = now;
    // the lean eases toward where the pointer is, about as quick as the old 1.4s transition
    const k = 1 - Math.exp(-Math.min(gap, 100) / 380);
    lean.x += (target.x - lean.x) * k;
    lean.y += (target.y - lean.y) * k;

    const secs = (now - started) / 1000;
    document.querySelectorAll<HTMLElement>(".jqzz-aura > .phase, .jqzz-aura > .warm, .jqzz-aura > .shadow").forEach((el) => {
      const light = LIGHTS[el.classList[0]];
      if (!light) return;
      const cycle = (secs / light.period) % 2;
      const p = easeInOut(cycle < 1 ? cycle : 2 - cycle);
      const tx = light.from[0] + (light.to[0] - light.from[0]) * p;
      const ty = light.from[1] + (light.to[1] - light.from[1]) * p;
      const s = light.from[2] + (light.to[2] - light.from[2]) * p;
      el.style.transform =
        `translate3d(${(lean.x * light.lean[0]).toFixed(1)}px, ${(lean.y * light.lean[1]).toFixed(1)}px, 0) ` +
        `translate(${tx.toFixed(2)}%, ${ty.toFixed(2)}%) scale(${s.toFixed(4)})`;
    });
    document.querySelectorAll<HTMLElement>(".jqzz-welcome-burst").forEach((el) => {
      el.style.translate = `${(lean.x * BURST_LEAN[0]).toFixed(1)}px ${(lean.y * BURST_LEAN[1]).toFixed(1)}px`;
    });
  };
  raf = requestAnimationFrame(frame);
  const stopListening = listen();
  return () => {
    cancelAnimationFrame(raf);
    stopListening();
  };
}

const aim = (x: number, y: number) => {
  target.x = Math.max(-1, Math.min(1, x));
  target.y = Math.max(-1, Math.min(1, y));
};

const onMove = (e: PointerEvent) => {
  if (e.pointerType !== "mouse") return; // a finger dragging isn't a pointer to follow
  aim((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
};

// gamma: tilting left and right; beta: tilting toward you, held at about 45°
const onTilt = (e: DeviceOrientationEvent) => {
  if (e.gamma == null || e.beta == null) return;
  aim(e.gamma / 30, (e.beta - 45) / 30);
};

type AskingOrientation = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };

function listen(): () => void {
  window.addEventListener("pointermove", onMove, { passive: true });
  if (!window.matchMedia("(pointer: coarse)").matches || typeof DeviceOrientationEvent === "undefined") {
    return () => window.removeEventListener("pointermove", onMove);
  }
  const orientation = DeviceOrientationEvent as AskingOrientation;
  const startTilt = () => window.addEventListener("deviceorientation", onTilt);
  // most phones send tilt straight away; iPhones only after a tap says yes
  startTilt();
  let ask: (() => void) | null = null;
  if (typeof orientation.requestPermission === "function") {
    ask = () => {
      orientation.requestPermission!()
        .then((answer) => answer === "granted" && startTilt())
        .catch(() => {});
    };
    window.addEventListener("pointerup", ask, { once: true });
  }
  return () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("deviceorientation", onTilt);
    if (ask) window.removeEventListener("pointerup", ask);
  };
}

/** One loop for the whole page, however many backgrounds are mounted. */
function useMovingLights() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (users++ === 0) stopLights = startLights();
    return () => {
      if (--users === 0) {
        stopLights?.();
        stopLights = null;
      }
    };
  }, []);
}

/** Light leaks, huge grain, dust and scratches over everything, like a scanned print. */
export const Imperfections: React.FC = () => (
  <div className="jqzz-imperfections" aria-hidden="true">
    <span className="leaks" />
    <span className="grain-huge" />
    <span className="scratches" />
    <span className="dust" />
  </div>
);
