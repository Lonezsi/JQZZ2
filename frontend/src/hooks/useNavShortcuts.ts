import { useEffect } from "react";
import { go } from "./useHashRoute";
import { COMMANDS } from "../constants/commands";
import { lettersBusy, pressed } from "../utils/shortcuts";

/** The keys that take you somewhere, the same anywhere in the app (constants/commands.ts). */
export function useNavShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (lettersBusy(e)) return;
      const hit = COMMANDS.find((c) => c.to && pressed(e, c.sub));
      if (!hit?.to) return;
      e.preventDefault();
      go(hit.to);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
