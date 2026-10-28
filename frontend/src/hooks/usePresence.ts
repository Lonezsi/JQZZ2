import { useEffect, useRef, useState } from "react";

export type PresenceState = "open" | "closed";

/**
 * Keeps something mounted long enough to animate out. Mounts in the
 * "closed" state and flips to "open" two frames later, so CSS transitions
 * run both ways: style `[data-state="closed"]` as the hidden look.
 */
export function usePresence(show: boolean, exitMs = 240) {
  // mounted the moment it's shown (not a render later), kept while it animates out
  const [leaving, setLeaving] = useState(false);
  const [state, setState] = useState<PresenceState>(show ? "open" : "closed");
  const mounted = show || leaving;
  const wasShown = useRef(show);

  useEffect(() => {
    if (show) {
      wasShown.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLeaving(false);
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
    if (!wasShown.current) return;
    wasShown.current = false;
    setLeaving(true);
    const t = window.setTimeout(() => setLeaving(false), exitMs);
    return () => window.clearTimeout(t);
  }, [show, exitMs]);

  return { mounted, state };
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
