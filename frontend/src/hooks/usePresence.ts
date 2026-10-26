import { useEffect, useState } from "react";

export type PresenceState = "open" | "closed";

/**
 * Keeps something mounted long enough to animate out. Mounts in the
 * "closed" state and flips to "open" two frames later, so CSS transitions
 * run both ways: style `[data-state="closed"]` as the hidden look.
 */
export function usePresence(show: boolean, exitMs = 240) {
  const [mounted, setMounted] = useState(show);
  const [state, setState] = useState<PresenceState>(show ? "open" : "closed");

  useEffect(() => {
    if (show) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setState("open"));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setState("closed");
    const t = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(t);
  }, [show, exitMs]);

  return { mounted, state };
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
