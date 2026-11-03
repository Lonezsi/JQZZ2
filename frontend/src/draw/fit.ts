import { useLayoutEffect, type RefObject } from "react";

/*
 * On a phone the frame is as tall as the room it has: from where it starts
 * down to the bottom of the screen, less whatever floats over the screen's
 * edges (the game's bar, the quit button). If that's too little it takes a
 * fair share anyway and the page scrolls once so all of it is in view.
 */

const NARROW = "(max-width: 720px), (max-height: 520px)";

/** the nearest ancestor that scrolls, or null for the page itself */
function scrollerOf(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if (o === "auto" || o === "scroll") return p;
  }
  return null;
}

function pinnedOf(el: Element | null): Element | null {
  for (; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    const pos = getComputedStyle(el).position;
    if (pos === "fixed" || pos === "sticky") return el;
  }
  return null;
}

/** how far down things pinned to the top reach, and how far up things pinned to the bottom do */
function covered(frame: HTMLElement, top: number, bottom: number) {
  let over = top;
  let under = bottom;
  const mid = (top + bottom) / 2;
  const w = window.innerWidth;
  // a few depths in from each edge: floating buttons sit a little way off it
  for (const y of [top + 4, top + 28, bottom - 4, bottom - 28, bottom - 52]) {
    for (const x of [8, w * 0.25, w * 0.5, w * 0.75, w - 8]) {
      for (const hit of document.elementsFromPoint(x, y)) {
        if (frame.contains(hit)) continue;
        const pin = pinnedOf(hit);
        if (!pin || frame.contains(pin)) continue;
        const r = pin.getBoundingClientRect();
        if (r.bottom <= mid) over = Math.max(over, r.bottom);
        else if (r.top >= mid) under = Math.min(under, r.top);
      }
    }
  }
  return { over, under };
}

export function useFitHeight(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const narrow = window.matchMedia(NARROW);
    const scroller = scrollerOf(el);
    let placed = false;
    let last = "";

    const fit = () => {
      if (!narrow.matches) {
        el.style.removeProperty("--draw-h");
        last = "";
        return;
      }
      const sr = scroller?.getBoundingClientRect();
      const top = Math.max(0, sr?.top ?? 0);
      const bottom = Math.min(window.innerHeight, sr?.bottom ?? window.innerHeight);
      const { over, under } = covered(el, top, bottom);
      const band = Math.max(200, under - over);
      const scrolled = scroller ? scroller.scrollTop : window.scrollY;
      // where the frame starts with the page scrolled all the way up
      const at = el.getBoundingClientRect().top + scrolled;
      const least = Math.min(band, Math.max(Math.min(360, band * 0.9), band * 0.72));
      const h = Math.round(Math.max(least, Math.min(band, under - at)));
      const v = `${h}px`;
      if (v !== last) {
        el.style.setProperty("--draw-h", v);
        last = v;
      }
      if (!placed) {
        placed = true;
        // doesn't fit as it is: scroll once so its bottom sits at the bottom of the clear part
        const need = at + h - under;
        if (need > 1) (scroller ?? window).scrollTo({ top: need });
      }
    };

    fit();
    const raf = requestAnimationFrame(fit);
    const ro = new ResizeObserver(() => fit());
    ro.observe(scroller?.firstElementChild ?? document.body);
    window.addEventListener("resize", fit);
    narrow.addEventListener("change", fit);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", fit);
      narrow.removeEventListener("change", fit);
    };
  }, [ref]);
}
