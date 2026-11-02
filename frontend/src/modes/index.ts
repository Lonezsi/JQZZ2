/*
 * Game modes: ready-made quizzes that show off a way of playing. Each is a
 * plain script (docs/script.md), the same as one written in the editor, so
 * everything about it comes from the script: its name from the first line,
 * what it's about and who it's for from its comments, the rest from parsing it.
 */
import { parseScript } from "../utils/scriptParser";
import { modeKey, modeOf, type Mode } from "../utils/questionTypes";
import classic from "./classic.txt?raw";
import flashcards from "./flashcards.txt?raw";
import estimation from "./estimation.txt?raw";
import hiveMind from "./hive-mind.txt?raw";
import quipNight from "./quip-night.txt?raw";
import knowYourFriends from "./know-your-friends.txt?raw";
import sketchAndGuess from "./sketch-and-guess.txt?raw";
import artBattle from "./art-battle.txt?raw";
import telephone from "./telephone.txt?raw";
import partyMix from "./party-mix.txt?raw";

export interface GameMode {
  id: string;
  name: string;
  about: string;
  players: string;
  script: string;
  /** what its questions are (ask and score), first seen first */
  modes: Mode[];
  questions: number;
  /** how long it runs if nobody hurries it */
  minutes: number;
}

/** "# about: ..." from the script's comments */
const comment = (lines: string[], key: string) =>
  lines.find((l) => new RegExp(`^#\\s*${key}:`, "i").test(l))?.replace(new RegExp(`^#\\s*${key}:\\s*`, "i"), "").trim() ?? "";

export function readMode(id: string, script: string): GameMode {
  const lines = script.split(/\r?\n/);
  const name = (lines[0] ?? "").replace(/^#\s*/, "").split("·")[0].trim() || id;
  const { questions, actions } = parseScript(script, []);
  const seconds = actions.reduce((sum, a) => sum + (a.question ? a.time : 0), 0);
  return {
    id,
    name,
    about: comment(lines, "about"),
    players: comment(lines, "players"),
    script,
    modes: [...new Map(questions.map((q) => modeOf(q)).map((m) => [modeKey(m), m])).values()],
    questions: questions.length,
    minutes: Math.max(1, Math.round(seconds / 60)),
  };
}

export const GAME_MODES: GameMode[] = [
  readMode("classic", classic),
  readMode("flashcards", flashcards),
  readMode("estimation", estimation),
  readMode("hive-mind", hiveMind),
  readMode("quip-night", quipNight),
  readMode("know-your-friends", knowYourFriends),
  readMode("sketch-and-guess", sketchAndGuess),
  readMode("art-battle", artBattle),
  readMode("telephone", telephone),
  readMode("party-mix", partyMix),
];
