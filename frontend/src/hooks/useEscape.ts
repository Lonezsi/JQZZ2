import { useEffect, useRef } from "react";
import { go } from "./useHashRoute";

/*
 * Esc closes whatever is on top, one thing per press, and with nothing left
 * open it goes back. Anything that can be closed says so with useEscape while
 * it's open; the one opened last is asked first. A handler returns false when
 * it had nothing to close after all, and the press goes on down.
 *
 * Something that handles Esc itself (a search box clearing, a menu of its own)
 * calls preventDefault, and this leaves the press alone. A game's own screen
 * is never left by Esc: a stray key mustn't drop the host out of a game.
 */
type Closer = () => boolean | void;
const stack: { close: React.MutableRefObject<Closer> }[] = [];

/** while `open`, Esc calls `close` before anything opened earlier */
export function useEscape(open: boolean, close: Closer) {
  const ref = useRef(close);
  useEffect(() => {
    ref.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const layer = { close: ref };
    stack.push(layer);
    return () => {
      const i = stack.indexOf(layer);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [open]);
}

/* how many pages deep you've gone in this tab, so back never leaves the site */
let depth = 0;
let lastHash = window.location.hash;
window.addEventListener("hashchange", () => {
  const was = lastHash;
  lastHash = window.location.hash;
  if (backing) {
    backing = false;
    depth = Math.max(0, depth - 1);
  } else if (was !== lastHash) depth++;
});
let backing = false;

/** one level up from where you are: a profile's tab to the front page, a past game to your history */
function upFrom(route: string): string | null {
  const [, where, a] = route.split("/");
  if (!where) return null;
  if (where === "history" && a) return "/me/history";
  return "/";
}

function back() {
  const route = window.location.hash.replace(/^#/, "");
  const [, where] = route.split("/");
  if (where === "host" || where === "play") return;
  if (depth > 0) {
    backing = true;
    window.history.back();
    return;
  }
  const up = upFrom(route);
  if (up !== null) go(up);
}

window.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || e.defaultPrevented || e.repeat) return;
  const t = e.target as HTMLElement | null;
  // in a field, Esc first just leaves the field
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) {
    t.blur();
    return;
  }
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].close.current() !== false) {
      e.preventDefault();
      return;
    }
  }
  back();
});
