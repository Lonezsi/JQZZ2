import React, { useEffect } from "react";
import { DitherBlobs } from "./DitherBlobs";

const PHASES = ["IDLE", "WAITING", "QUESTION", "ANSWER", "ELABORATION", "RESULT"];

/**
 * Everything behind the UI, back to front: paper/ink, phase light,
 * dithered blobs, the blended lens textures, then grain.
 */
export const Atmosphere: React.FC = () => {
  useLeanTowardPointer();
  return (
  <div className="jqzz-aura" aria-hidden="true">
    <span className="shadow" />
    <span className="warm" />
    {PHASES.map((p) => (
      <span key={p} className={`phase phase-${p}`} />
    ))}
    <DitherBlobs />
    <span className="tex tex-floor" />
    <span className="tex tex-lens-a" />
    <span className="tex tex-lens-b" />
  </div>
  );
};

/**
 * The lights behind every page lean toward the pointer: --mx and --my run
 * -1..1, and each light follows at its own depth (motion.css). On a phone
 * there's no pointer to follow, so the lights follow how the phone is
 * tilted instead. One listener for the whole page, however many backgrounds
 * are mounted.
 */
let leaners = 0;
let raf = 0;
let stopListening: (() => void) | null = null;

const lean = (x: number, y: number) => {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    const root = document.documentElement;
    root.style.setProperty("--mx", Math.max(-1, Math.min(1, x)).toFixed(3));
    root.style.setProperty("--my", Math.max(-1, Math.min(1, y)).toFixed(3));
  });
};

const onMove = (e: PointerEvent) => {
  if (e.pointerType !== "mouse") return; // a finger dragging isn't a pointer to follow
  lean((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
};

// gamma: tilting left and right; beta: tilting toward you, held at about 45°
const onTilt = (e: DeviceOrientationEvent) => {
  if (e.gamma == null || e.beta == null) return;
  lean(e.gamma / 30, (e.beta - 45) / 30);
};

type AskingOrientation = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };

function listen(): () => void {
  window.addEventListener("pointermove", onMove);
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

function useLeanTowardPointer() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (leaners++ === 0) stopListening = listen();
    return () => {
      if (--leaners === 0) {
        stopListening?.();
        stopListening = null;
        cancelAnimationFrame(raf);
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
