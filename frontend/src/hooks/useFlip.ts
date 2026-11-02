import { useLayoutEffect, useRef } from "react";
import { prefersReducedMotion } from "./usePresence";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/** run once the page is idle; returns a cancel */
function whenIdle(cb: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const h = window.requestIdleCallback(cb, { timeout: 600 });
    return () => window.cancelIdleCallback(h);
  }
  const t = window.setTimeout(cb, 150);
  return () => window.clearTimeout(t);
}

/** where every [data-flip] child sits, relative to the container */
function positions(root: HTMLElement) {
  const top = root.getBoundingClientRect().top;
  const map = new Map<string, number>();
  root
    .querySelectorAll<HTMLElement>("[data-flip]")
    .forEach((n) => map.set(n.dataset.flip!, n.getBoundingClientRect().top - top));
  return map;
}

/**
 * FLIP for a list: children marked `data-flip="<key>"` glide to their new
 * spot when the list reorders, and fade in when they're new. Positions are
 * measured relative to the container, so scrolling doesn't count as moving.
 * Only transform and opacity are animated.
 *
 * `signature` names the list's order (its keys, joined). Measuring every row
 * forces a layout, and the list re-renders on every keystroke in the editor,
 * so the full pass only runs when the order changes; otherwise the remembered
 * positions are refreshed once the page is idle, ready for the next reorder.
 */
export function useFlip<T extends HTMLElement>(
  signature: string,
  /** changes when the list only grew because more of it was drawn (the rest of a
      quiz arriving): that is not news, so nothing animates */
  drawn?: number,
) {
  const ref = useRef<T>(null);
  const last = useRef(new Map<string, number>());
  const lastSignature = useRef<string | null>(null);
  const lastKeys = useRef<string[]>([]);
  const lastDrawn = useRef(drawn);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (signature === lastSignature.current) {
      return whenIdle(() => {
        if (ref.current) last.current = positions(ref.current);
      });
    }
    lastSignature.current = signature;
    const nodes = root.querySelectorAll<HTMLElement>("[data-flip]");
    const before = lastKeys.current;
    lastKeys.current = Array.from(nodes, (n) => n.dataset.flip!);
    const moreDrawn = drawn !== lastDrawn.current;
    lastDrawn.current = drawn;

    // the rest of the list drawn in: nothing moved, so nothing to measure, and
    // nothing to show either. The rows slip in where the placeholders were;
    // animating them read as the quiz loading twice.
    if (moreDrawn && before.length > 0) {
      return whenIdle(() => {
        if (ref.current) last.current = positions(ref.current);
      });
    }

    const next = positions(root);

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
