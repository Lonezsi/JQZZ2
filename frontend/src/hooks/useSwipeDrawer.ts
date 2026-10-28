import { useEffect, useRef } from "react";

/** the same width the phone layout in mobile.css switches at */
const PHONE = "(max-width: 760px)";

/** a touch that starts in one of these is doing something else: typing, or
    picking something up to drag (the stash's rows and pictures, a step's handle) */
const IGNORE =
  "input, textarea, select, [draggable='true'], .jqzz-stash-drawer, .jqzz-editor-wrap, .jqzz-inspector, .jqzz-palette-overlay, .jqzz-modal-overlay, .jqzz-popover";

/** px the finger has to travel before the gesture picks an axis */
const SLOP = 10;
/** px per ms that counts as a flick, whatever the distance */
const FLICK = 0.4;

/**
 * Phone only: swipe right to pull the sidebar out, swipe left to put it back.
 *
 * The drawer follows the finger: while a drag is on, the sidebar and its scrim
 * carry data-drag and a --drawer-p between 0 (shut) and 1 (open), which
 * mobile.css turns into a position and a dim. On release it settles open or
 * shut by distance, or by the direction of a flick.
 *
 * Opening can start anywhere in the left half of the screen, not just the
 * edge, because iOS keeps the edge itself for its own back gesture. Nothing
 * on the page scrolls sideways except the script editor, which is ignored.
 */
export function useSwipeDrawer(open: boolean, setOpen: (open: boolean) => void) {
  // the listeners are attached once; they read the latest values from here
  const openRef = useRef(open);
  const setOpenRef = useRef(setOpen);
  useEffect(() => {
    openRef.current = open;
    setOpenRef.current = setOpen;
  });

  useEffect(() => {
    const phone = window.matchMedia(PHONE);
    let start: { x: number; y: number } | null = null;
    let axis: "x" | "y" | null = null;
    let width = 300;
    let lastX = 0;
    let lastT = 0;
    let vx = 0;
    let p = 0;

    const drawer = () => document.querySelector<HTMLElement>(".jqzz-sidebar");
    const scrim = () => document.querySelector<HTMLElement>(".jqzz-nav-scrim");

    const progress = (x: number) => {
      const dx = x - (start?.x ?? x);
      const raw = openRef.current ? 1 + dx / width : dx / width;
      return Math.min(1, Math.max(0, raw));
    };

    const paint = (value: number) => {
      for (const el of [drawer(), scrim()]) {
        if (!el) continue;
        el.dataset.drag = "1";
        el.style.setProperty("--drawer-p", String(value));
      }
    };

    const release = () => {
      for (const el of [drawer(), scrim()]) {
        if (!el) continue;
        delete el.dataset.drag;
        el.style.removeProperty("--drawer-p");
      }
    };

    const onStart = (e: TouchEvent) => {
      if (!phone.matches || e.touches.length !== 1) return;
      const t = e.touches[0];
      const target = e.target as Element | null;
      if (target?.closest?.(IGNORE)) return;
      if (!openRef.current && t.clientX > window.innerWidth * 0.5) return;
      start = { x: t.clientX, y: t.clientY };
      axis = null;
      width = drawer()?.offsetWidth || 300;
      lastX = t.clientX;
      lastT = e.timeStamp;
      vx = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const t = e.touches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (axis === null) {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        axis = Math.abs(dx) > Math.abs(dy) * 1.3 ? "x" : "y";
        // a scroll, or a leftward swipe with nothing to close
        if (axis === "y" || (!openRef.current && dx < 0)) {
          start = null;
          return;
        }
      }
      const dt = e.timeStamp - lastT;
      if (dt > 0) vx = (t.clientX - lastX) / dt;
      lastX = t.clientX;
      lastT = e.timeStamp;
      p = progress(t.clientX);
      paint(p);
    };

    const onEnd = () => {
      if (!start || axis !== "x") {
        start = null;
        return;
      }
      start = null;
      const shouldOpen = vx > FLICK ? true : vx < -FLICK ? false : p > 0.5;
      release();
      setOpenRef.current(shouldOpen);
    };

    // a real drag took over: whatever the finger started here is no longer a swipe
    const onDrag = () => {
      if (!start) return;
      start = null;
      release();
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("dragstart", onDrag);
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("dragstart", onDrag);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
      release();
    };
  }, []);
}
