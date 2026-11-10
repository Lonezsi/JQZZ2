import { useEffect, useRef } from "react";
import { COMMANDS } from "../constants/commands";
import { lettersBusy, pressed } from "../utils/shortcuts";

/**
 * The editor's keys: Ctrl K opens the commands, Ctrl A selects every step,
 * and each command acting on the open quiz runs on its key from
 * constants/commands.ts (by label, through onCommand). Ctrl keys work while
 * typing too; plain letters only when you aren't (utils/shortcuts.ts).
 */
export const useKeyboardShortcuts = ({
  onPalette,
  onSelectAll,
  onCommand,
}: {
  onPalette: () => void;
  onSelectAll: () => void;
  onCommand: (label: string) => void;
}) => {
  const latest = useRef({ onPalette, onSelectAll, onCommand });
  useEffect(() => {
    latest.current = { onPalette, onSelectAll, onCommand };
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // a field that handled the key itself (the roster's Ctrl Enter saves) keeps it
      if (e.defaultPrevented) return;
      const { onPalette, onSelectAll, onCommand } = latest.current;
      const t = e.target as HTMLElement | null;
      const typing = t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || !!t?.isContentEditable;
      if (pressed(e, "Mod K")) {
        e.preventDefault();
        onPalette();
        return;
      }
      if (pressed(e, "Mod A") && !typing) {
        e.preventDefault();
        onSelectAll();
        return;
      }
      const hit = COMMANDS.find(
        (c) => !c.to && c.sub && pressed(e, c.sub) && (c.sub.startsWith("Mod") || !lettersBusy(e)),
      );
      if (!hit) return;
      e.preventDefault();
      onCommand(hit.label);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
};
