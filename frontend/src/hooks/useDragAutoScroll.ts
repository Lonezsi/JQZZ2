import { useEffect } from "react";
import type { RefObject } from "react";

const EDGE = 90; // px from the top or bottom where scrolling starts
const MAX_SPEED = 18; // px a frame, right at the edge

/**
 * While anything is being dragged, holding it near the top or bottom of the
 * editor scrolls it, faster the closer to the edge. Browsers barely do this on
 * their own, and phones not at all.
 */
export function useDragAutoScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    let y: number | null = null;
    let raf = 0;
    const scroller = () => {
      const el = ref.current;
      if (el && el.scrollHeight > el.clientHeight) return el;
      return (document.scrollingElement as HTMLElement | null) ?? null;
    };
    const tick = () => {
      const el = scroller();
      if (el && y != null) {
        const box = el === document.scrollingElement ? { top: 0, bottom: window.innerHeight } : el.getBoundingClientRect();
        const top = box.top + EDGE - y;
        const bottom = y - (box.bottom - EDGE);
        if (top > 0) el.scrollTop -= Math.ceil((Math.min(top, EDGE) / EDGE) * MAX_SPEED);
        else if (bottom > 0) el.scrollTop += Math.ceil((Math.min(bottom, EDGE) / EDGE) * MAX_SPEED);
      }
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };
    const over = (e: DragEvent) => {
      // some browsers report 0,0 on the last event of a drag
      if (e.clientX || e.clientY) y = e.clientY;
    };
    const stop = () => {
      y = null;
      cancelAnimationFrame(raf);
    };
    window.addEventListener("dragstart", start);
    window.addEventListener("dragover", over);
    window.addEventListener("dragend", stop);
    window.addEventListener("drop", stop);
    return () => {
      stop();
      window.removeEventListener("dragstart", start);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragend", stop);
      window.removeEventListener("drop", stop);
    };
  }, [ref]);
}
