import type { Command } from "../types";

// sub is the shortcut; "Mod" becomes ⌘ or Ctrl when drawn
export const COMMANDS: Command[] = [
  { icon: "+", label: "New quiz", sub: "Mod N" },
  { icon: "↑", label: "Import a .txt", sub: "Mod I" },
  { icon: "↓", label: "Export this quiz", sub: "Mod E" },
  { icon: "~", label: "Switch visual / text", sub: "Mod `" },
  { icon: "▷", label: "Start", sub: "Mod ↵" },
  { icon: "⌁", label: "Join a game", sub: "Mod J" },
  { icon: "◇", label: "Stash this quiz", sub: "" },
  { icon: "▷", label: "Practice this quiz", sub: "" },
  { icon: "▤", label: "Open stash", sub: "Mod B" },
  { icon: "↺", label: "Game history", sub: "Mod H" },
];
