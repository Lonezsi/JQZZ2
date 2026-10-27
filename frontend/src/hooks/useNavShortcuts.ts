import { useEffect } from "react";
import { go } from "./useHashRoute";

/** The same anywhere in the app: Mod J joins a game, Mod B opens the stash, Mod H your history. */
export const NAV_SHORTCUTS: { key: string; combo: string; to: string }[] = [
  { key: "j", combo: "Mod J", to: "/join" },
  { key: "b", combo: "Mod B", to: "/me/stash" },
  { key: "h", combo: "Mod H", to: "/me/history" },
];

export function useNavShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      const hit = NAV_SHORTCUTS.find((s) => s.key === e.key.toLowerCase());
      if (!hit) return;
      e.preventDefault();
      go(hit.to);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
