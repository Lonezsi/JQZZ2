import { useEffect } from "react";

interface ShortcutHandlers {
  onPalette?: () => void;
  onNewQuiz?: () => void;
  onToggleMode?: () => void;
  onEscape?: () => void;
  onExport?: () => void;
  onSelectAll?: () => void;
}

export const useKeyboardShortcuts = ({
  onPalette,
  onNewQuiz,
  onToggleMode,
  onEscape,
  onExport,
  onSelectAll,
}: ShortcutHandlers) => {
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "k") {
        e.preventDefault();
        onPalette?.();
      }
      if (mod && e.key === "n") {
        e.preventDefault();
        onNewQuiz?.();
      }
      if (mod && e.key === "`") {
        e.preventDefault();
        onToggleMode?.();
      }
      if (mod && e.key === "e") {
        e.preventDefault();
        onExport?.();
      }
      if (mod && e.key === "a") {
        e.preventDefault();
        onSelectAll?.(); // handle Ctrl+A
      }
      if (e.key === "Escape") {
        onEscape?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onPalette, onNewQuiz, onToggleMode, onEscape, onExport, onSelectAll]);
};
