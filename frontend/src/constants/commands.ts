import type { Command } from "../types";

/*
 * Every command, with its key. Plain letters, each the first letter of what
 * it does (or what it's for), pressed on their own while you're not typing:
 *   N new quiz · I import · A make a quiz with AI · E export
 *   V view: visual or text · P practice
 *   J join · S stash · Shift S stash this quiz · H history · B the bell
 *   Y you (your profile) · , settings (as in most apps) · F the front page
 * The ones that matter more keep the Ctrl (⌘ on a Mac): Ctrl K for these
 * commands and Ctrl Enter to start a game. Esc closes, then goes back.
 *
 * sub is the key; "Mod" is drawn as ⌘ or Ctrl. to: where it takes you, the
 * same from anywhere; the rest act on the quiz you have open (Dashboard).
 */
export const COMMANDS: (Command & { to?: string })[] = [
  { icon: "+", label: "New quiz", sub: "N" },
  { icon: "↑", label: "Import a .txt", sub: "I" },
  { icon: "✦", label: "Make a quiz with AI", sub: "A" },
  { icon: "↓", label: "Export this quiz", sub: "E" },
  { icon: "~", label: "Switch visual / text", sub: "V" },
  { icon: "▷", label: "Start", sub: "Mod ↵" },
  { icon: "▷", label: "Practice this quiz", sub: "P" },
  { icon: "◇", label: "Stash this quiz", sub: "Shift S" },
  { icon: "⌁", label: "Join a game", sub: "J", to: "/join" },
  { icon: "▤", label: "Open stash", sub: "S", to: "/me/stash" },
  { icon: "↺", label: "Game history", sub: "H", to: "/me/history" },
  { icon: "◔", label: "Notifications", sub: "B", to: "/me/notifications" },
  { icon: "☺", label: "Your profile", sub: "Y", to: "/me/you" },
  { icon: "⚙", label: "Settings", sub: ",", to: "/me/settings" },
  { icon: "⌂", label: "Front page", sub: "F", to: "/" },
];

/** the key a command goes by, wherever else it's shown (sidebar, toolbar) */
export const keyOf = (label: string) => COMMANDS.find((c) => c.label === label)?.sub ?? "";
