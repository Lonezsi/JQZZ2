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
