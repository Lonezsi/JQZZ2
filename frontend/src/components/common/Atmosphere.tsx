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
 * -1..1 across the window, and each light follows at its own depth (motion.css).
 * One listener for the whole page, however many backgrounds are mounted.
 */
let leaners = 0;
let raf = 0;
const onMove = (e: PointerEvent) => {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    const root = document.documentElement;
    root.style.setProperty("--mx", ((e.clientX / window.innerWidth) * 2 - 1).toFixed(3));
    root.style.setProperty("--my", ((e.clientY / window.innerHeight) * 2 - 1).toFixed(3));
  });
};
function useLeanTowardPointer() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (leaners++ === 0) window.addEventListener("pointermove", onMove);
    return () => {
      if (--leaners === 0) {
        window.removeEventListener("pointermove", onMove);
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
