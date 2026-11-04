const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** "Mod K" -> ⌘ K on a Mac, Ctrl K elsewhere. */
export const modLabel = (combo: string) =>
  combo.replace(/\bMod\b/g, isMac ? "⌘" : "Ctrl");

/** For aria-keyshortcuts: "Mod K" -> "Control+K" / "Meta+K". */
export const ariaShortcut = (combo: string) =>
  combo
    .split(" ")
    .map((k) => (k === "Mod" ? (isMac ? "Meta" : "Control") : k === "↵" ? "Enter" : k))
    .join("+");

/** Whether a key press is the combo, e.g. "N", "Shift S", "Mod ↵", ",". */
export function pressed(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.split(" ");
  const key = parts[parts.length - 1];
  const mod = parts.includes("Mod");
  if (mod !== (e.ctrlKey || e.metaKey) || e.altKey) return false;
  const want = key === "↵" ? "Enter" : key;
  // a letter cares about Shift; a sign is wherever the keyboard puts it
  if (/^[a-z]$/i.test(want)) return e.shiftKey === parts.includes("Shift") && e.key.toLowerCase() === want.toLowerCase();
  return e.key === want;
}

/**
 * Whether plain-letter shortcuts should stand aside: you're typing, a dialog
 * is open, a drawing (whose brushes have letters of their own) is on screen,
 * or you're in a game, where keys are the game's.
 */
export function lettersBusy(e: KeyboardEvent): boolean {
  if (e.defaultPrevented || e.repeat) return true;
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return true;
  if (document.querySelector('[aria-modal="true"], .jqzz-modal-overlay, .jqzz-draw-bar')) return true;
  const [, where] = window.location.hash.replace(/^#/, "").split("/");
  return where === "host" || where === "play";
}
