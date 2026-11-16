import { useState } from "react";

/** the script reference's width, kept per browser; null is the default (CSS: min(480px, 42%)) */
const KEY = "jqzz.docsWidth";

export function useDocsWidth(): [number | null, (w: number | null) => void] {
  const [width, setWidth] = useState<number | null>(() => {
    try {
      const n = Number(localStorage.getItem(KEY));
      return n > 0 ? n : null;
    } catch {
      return null;
    }
  });
  const set = (w: number | null) => {
    setWidth(w);
    try {
      if (w === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, String(Math.round(w)));
    } catch {
      /* it just won't be remembered */
    }
  };
  return [width, set];
}

const OPEN_KEY = "jqzz.docsOpen";
/** D, or the palette: open or close the reference (TextMode/ScriptEditor.tsx listens) */
export const DOCS_EVENT = "jqzz:docs";

/** whether the reference was open last time; on a first visit, open when there's room for it */
export function docsWereOpen(): boolean {
  try {
    const v = localStorage.getItem(OPEN_KEY);
    if (v !== null) return v === "open";
  } catch {
    /* no storage: decide by width */
  }
  return window.innerWidth >= 1100;
}

export function rememberDocsOpen(open: boolean) {
  try {
    localStorage.setItem(OPEN_KEY, open ? "open" : "closed");
  } catch {
    /* it just won't be remembered */
  }
}

/** open or close the reference, remembered for next time */
export function useDocsOpen(): [boolean, (open: boolean | ((o: boolean) => boolean)) => void] {
  const [open, setOpen] = useState(docsWereOpen);
  const set = (next: boolean | ((o: boolean) => boolean)) =>
    setOpen((o) => {
      const v = typeof next === "function" ? next(o) : next;
      rememberDocsOpen(v);
      return v;
    });
  return [open, set];
}
