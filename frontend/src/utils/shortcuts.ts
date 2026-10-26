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
