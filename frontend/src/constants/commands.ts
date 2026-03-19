import type { Command } from "../types";

export const COMMANDS: Command[] = [
  { icon: "+", label: "New Quiz", sub: "Ctrl+N" },
  { icon: "↑", label: "Import Quiz (.txt)", sub: "Ctrl+I" },
  { icon: "↓", label: "Export Current Quiz", sub: "Ctrl+E" },
  { icon: "▶", label: "Start Quiz", sub: "Ctrl+Enter" },
  { icon: "#", label: "Join Lobby by Code", sub: "" },
  { icon: "~", label: "Toggle Text Mode", sub: "Ctrl+`" },
];
