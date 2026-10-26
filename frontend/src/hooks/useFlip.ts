import { useLayoutEffect, useRef } from "react";
import { prefersReducedMotion } from "./usePresence";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * FLIP for a list: children marked `data-flip="<key>"` glide to their new
 * spot when the list reorders, and fade in when they're new. Positions are
 * measured relative to the container, so scrolling doesn't count as moving.
 * Only transform and opacity are animated.
 */
export function useFlip<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const last = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const top = root.getBoundingClientRect().top;
    const nodes = root.querySelectorAll<HTMLElement>("[data-flip]");
    const next = new Map<string, number>();
    nodes.forEach((n) => next.set(n.dataset.flip!, n.getBoundingClientRect().top - top));

    const prev = last.current;
    last.current = next;
    if (prefersReducedMotion()) return;

    let known = 0;
    next.forEach((_, key) => prev.has(key) && known++);
    // a different quiz (or the first paint): cascade the whole list in
    const replaced = known < next.size / 2;

    let entering = 0;
    nodes.forEach((n) => {
      const key = n.dataset.flip!;
      const now = next.get(key)!;
      const before = prev.get(key);
      if (before === undefined || replaced) {
        n.animate(
          [
            { opacity: 0, transform: "translateY(6px)" },
            { opacity: 1, transform: "none" },
          ],
          {
            duration: 360,
            easing: EASE,
            delay: replaced ? Math.min(entering++, 14) * 22 : 0,
            fill: "backwards",
          },
        );
      } else if (Math.abs(before - now) > 0.5) {
        n.animate(
          [{ transform: `translateY(${before - now}px)` }, { transform: "none" }],
          { duration: 380, easing: EASE },
        );
      }
    });
  });

  return ref;
}
