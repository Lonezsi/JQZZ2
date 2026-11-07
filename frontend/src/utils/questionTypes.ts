/*
 * What a question can be, in one place. A question is two choices (Script
 * v3, docs/script.md): what players do, its `ask`, and how that scores, its
 * `score`. Any pair an ask allows works. The handful of pairs people reach
 * for most have names, the presets; they're what older scripts and the
 * server's stored `type` call them. The parser, the writer, the editor and
 * the play screens all read it from here.
 */

/** what players do */
export type Ask = "pick" | "pick-many" | "type-in" | "order" | "number" | "match" | "rank" | "write" | "draw" | "chain" | "person";
/** how it scores */
export type Score = "right" | "crowd" | "votes" | "authors" | "secret" | "knockout" | "none";

export interface Mode {
  ask: Ask;
  score: Score;
}

/** Extra fields a question can carry, besides prompt and answers. */
export type QuestionField = "unit" | "min" | "max" | "rounds";
/** fields that link questions or shape a vote; the editor draws these itself */
export type LinkField = "from" | "picks" | "overflow" | "ref";
/** every key a question's extras can have */
export type OptionKey = QuestionField | LinkField;

/** what a question's answers are, for the editor's columns; null: it has none */
export type AnswerShape = null | {
  /** the text column */
  text: string;
  /** the points column; null when points don't come from the answers */
  value: string | null;
  /** the second text column, for pairs */
  match?: string;
  /** points a new answer starts with */
  starts: number;
};

export interface AskInfo {
  id: Ask;
  label: string;
  /** a Glyph name */
  icon: string;
  /** one line on what players do */
  blurb: string;
  fields: QuestionField[];
  /** the scores it can take; the first is what it gets when none is said */
  scores: Score[];
}

export interface ScoreInfo {
  id: Score;
  label: string;
  icon: string;
  blurb: string;
  /** players vote, guess or battle during the reveal */
  judged: boolean;
}

export const ASKS: AskInfo[] = [
  { id: "pick", label: "pick one", icon: "PREWRITTEN_SINGLE", blurb: "pick one of the options", fields: [], scores: ["right", "crowd", "none", "votes"] },
  { id: "pick-many", label: "pick any", icon: "PREWRITTEN_MULTIPLE", blurb: "pick any number of the options", fields: [], scores: ["right", "none"] },
  { id: "type-in", label: "type it", icon: "TYPED", blurb: "type the answer: spelling is forgiven a little", fields: [], scores: ["right"] },
  { id: "order", label: "put in order", icon: "ORDER", blurb: "put the items in the right order", fields: [], scores: ["right"] },
  { id: "number", label: "guess a number", icon: "NUMBER", blurb: "guess the number: the closer, the more", fields: ["unit", "min", "max"], scores: ["right", "crowd"] },
  { id: "match", label: "match pairs", icon: "MATCH", blurb: "pair each one with its other half", fields: [], scores: ["right"] },
  { id: "rank", label: "rank them", icon: "TIERLIST", blurb: "rank everything from S to D", fields: [], scores: ["crowd", "none"] },
  { id: "write", label: "write", icon: "USER_GENERATED", blurb: "everyone writes something", fields: [], scores: ["votes", "authors", "secret", "knockout", "none"] },
  { id: "draw", label: "draw", icon: "DRAW", blurb: "everyone draws something", fields: [], scores: ["votes", "authors", "secret", "knockout", "none"] },
  { id: "chain", label: "telephone chain", icon: "TELEPHONE", blurb: "write, draw what you're handed, describe that, and on", fields: ["rounds"], scores: ["none"] },
  { id: "person", label: "pick a person", icon: "FRIENDS", blurb: "pick someone in the game", fields: [], scores: ["right", "none"] },
];

export const SCORES: ScoreInfo[] = [
  { id: "right", label: "right answers", icon: "ANSWER", blurb: "whoever gets it right scores", judged: false },
  { id: "crowd", label: "the crowd", icon: "POLL", blurb: "whoever sides with the most scores", judged: false },
  { id: "votes", label: "votes", icon: "USER_GENERATED_VOTE", blurb: "everyone votes for the best one", judged: true },
  { id: "authors", label: "who made it", icon: "USER_GENERATED_IDENTIFY", blurb: "everyone guesses who made what", judged: true },
  { id: "secret", label: "secret words", icon: "SECRET", blurb: "everyone gets a secret word; the others guess it", judged: true },
  { id: "knockout", label: "knockout", icon: "KNOCKOUT_BATTLE", blurb: "they battle two at a time until one is left", judged: true },
  { id: "none", label: "no points", icon: "UNSCORED", blurb: "nobody scores: it's for the show", judged: false },
];

/**
 * A named pair. `type` is the server's stored name for it, where it has
 * one: questions keep it so older screens and records still say what they are.
 */
export interface Preset {
  /** its name in the script */
  script: string;
  /** names older scripts used, still read */
  aliases: string[];
  type?: string;
  mode: Mode;
  label: string;
  icon: string;
  blurb: string;
}

const m = (ask: Ask, score: Score): Mode => ({ ask, score });

export const PRESETS: Preset[] = [
  { script: "single", aliases: ["prewritten-single"], type: "PREWRITTEN_SINGLE", mode: m("pick", "right"), label: "single choice", icon: "PREWRITTEN_SINGLE", blurb: "pick one" },
  { script: "multiple", aliases: ["prewritten-multiple"], type: "PREWRITTEN_MULTIPLE", mode: m("pick-many", "right"), label: "multiple choice", icon: "PREWRITTEN_MULTIPLE", blurb: "pick any that are right" },
  { script: "typed", aliases: ["type-answer", "type-it"], type: "TYPED", mode: m("type-in", "right"), label: "type it", icon: "TYPED", blurb: "type the answer: spelling is forgiven a little" },
  { script: "order", aliases: ["puzzle", "sort"], type: "ORDER", mode: m("order", "right"), label: "put in order", icon: "ORDER", blurb: "put the items in the right order" },
  { script: "number", aliases: ["estimate", "slider"], type: "NUMBER", mode: m("number", "right"), label: "estimate", icon: "NUMBER", blurb: "guess the number: the closer, the more" },
  { script: "match", aliases: ["pairs"], type: "MATCH", mode: m("match", "right"), label: "match pairs", icon: "MATCH", blurb: "pair each one with its other half" },
  { script: "poll", aliases: ["hive-mind", "crowd"], type: "POLL", mode: m("pick", "crowd"), label: "poll", icon: "POLL", blurb: "everyone votes: points for siding with the most" },
  { script: "show-of-hands", aliases: [], mode: m("pick", "none"), label: "show of hands", icon: "POLL", blurb: "everyone picks, nobody scores: just to see the room" },
  { script: "tierlist", aliases: ["tier-list"], type: "TIERLIST", mode: m("rank", "crowd"), label: "tier list", icon: "TIERLIST", blurb: "rank everything from S to D" },
  { script: "crowd-guess", aliases: ["wisdom-of-the-crowd"], mode: m("number", "crowd"), label: "guess the crowd", icon: "NUMBER", blurb: "guess a number: closest to the room's average wins" },
  { script: "write", aliases: ["user-generated"], type: "USER_GENERATED", mode: m("write", "none"), label: "players write", icon: "USER_GENERATED", blurb: "everyone writes; it all goes on a wall" },
  { script: "write-vote", aliases: ["user-generated-vote", "quip"], type: "USER_GENERATED_VOTE", mode: m("write", "votes"), label: "write + vote", icon: "USER_GENERATED_VOTE", blurb: "write the best answer, then vote for someone else's" },
  { script: "who-wrote", aliases: ["user-generated-identify"], type: "USER_GENERATED_IDENTIFY", mode: m("write", "authors"), label: "who wrote it", icon: "USER_GENERATED_IDENTIFY", blurb: "write something, then guess who wrote what" },
  { script: "taboo", aliases: ["say-it-without-saying-it"], mode: m("write", "secret"), label: "say it without saying it", icon: "SECRET", blurb: "describe your secret word without saying it; the others guess" },
  { script: "knockout", aliases: ["knockout-battle"], type: "KNOCKOUT_BATTLE", mode: m("write", "knockout"), label: "knockout", icon: "KNOCKOUT_BATTLE", blurb: "write, then the answers battle it out" },
  { script: "draw", aliases: ["drawing"], type: "DRAW", mode: m("draw", "none"), label: "draw it", icon: "DRAW", blurb: "everyone draws; it all goes on a wall" },
  { script: "draw-vote", aliases: [], type: "DRAW_VOTE", mode: m("draw", "votes"), label: "draw + vote", icon: "DRAW_VOTE", blurb: "draw the prompt, then vote for the best drawing" },
  { script: "who-drew", aliases: [], mode: m("draw", "authors"), label: "who drew it", icon: "USER_GENERATED_IDENTIFY", blurb: "everyone draws, then guesses who drew what" },
  { script: "draw-guess", aliases: ["pictionary"], type: "DRAW_GUESS", mode: m("draw", "secret"), label: "draw + guess", icon: "DRAW_GUESS", blurb: "everyone draws a secret word, then guesses the others'" },
  { script: "draw-knockout", aliases: ["draw-battle"], type: "DRAW_BATTLE", mode: m("draw", "knockout"), label: "draw knockout", icon: "DRAW_BATTLE", blurb: "draw, then the drawings battle it out" },
  { script: "telephone", aliases: ["gartic"], type: "TELEPHONE", mode: m("chain", "none"), label: "telephone", icon: "TELEPHONE", blurb: "write, then draw what you're handed, then describe the drawing, and on" },
  // the two that use an earlier question (from: "Q1"); no stored type, the server plays them by their mode
  { script: "vote", aliases: ["vote-on", "funniest"], mode: m("pick", "votes"), label: "vote on answers", icon: "USER_GENERATED_VOTE", blurb: "vote for the best of an earlier question's answers" },
  { script: "who-was-it", aliases: ["guess-who"], mode: m("person", "right"), label: "who was it", icon: "USER_GENERATED_IDENTIFY", blurb: "guess who made an earlier question's winner" },
];

/**
 * Every kind of question, sorted by the one thing a new person can answer
 * without reading about all of them: what kind of question is it. The add
 * tray opens on these four and shows the kinds only inside the one picked.
 */
export type FamilyId = "quiz" | "opinion" | "write" | "draw";
export interface Family {
  id: FamilyId;
  label: string;
  blurb: string;
  icon: string;
}
export const FAMILIES: Family[] = [
  { id: "quiz", label: "has a right answer", blurb: "a quiz question: whoever gets it right scores", icon: "ANSWER" },
  { id: "opinion", label: "asks what people think", blurb: "polls, rankings, guessing the room", icon: "POLL" },
  { id: "write", label: "everyone writes", blurb: "they write, then vote, guess who or battle", icon: "USER_GENERATED" },
  { id: "draw", label: "everyone draws", blurb: "they draw, then vote, guess or pass it on", icon: "DRAW" },
];
export function familyOf(mode: Mode): FamilyId {
  if (mode.ask === "draw" || mode.ask === "chain") return "draw";
  if (mode.ask === "write") return "write";
  return mode.score === "right" ? "quiz" : "opinion";
}

const ASK = new Map(ASKS.map((a) => [a.id, a]));
const SCORE = new Map(SCORES.map((s) => [s.id, s]));
export const askInfo = (id: string | null | undefined): AskInfo => ASK.get(id as Ask) ?? ASKS[0];
export const scoreInfo = (id: string | null | undefined): ScoreInfo => SCORE.get(id as Score) ?? SCORES[0];

/** "draw/votes": how a mode is stored and sent */
export const modeKey = (mode: Mode) => `${mode.ask}/${mode.score}`;
const sameMode = (a: Mode, b: Mode) => a.ask === b.ask && a.score === b.score;

/** a pair the ask allows; a score it doesn't take becomes the one it takes first */
export function fixMode(ask: string | null | undefined, score?: string | null): Mode {
  const a = askInfo(ask);
  return { ask: a.id, score: a.scores.includes(score as Score) ? (score as Score) : a.scores[0] };
}

export function parseMode(text: string | null | undefined): Mode | null {
  if (!text) return null;
  const [ask, score] = text.split("/");
  if (!ASK.has(ask as Ask)) return null;
  return fixMode(ask, score);
}

const BY_TYPE = new Map(PRESETS.filter((p) => p.type).map((p) => [p.type!, p]));

/**
 * The mode of a question as the editor, the server or a game view has it:
 * its ask and score when it says them, else what its stored type stands for.
 */
export function modeOf(q: { type?: string | null; mode?: string | null; ask?: string | null; score?: string | null } | null | undefined): Mode {
  if (!q) return m("pick", "right");
  if (q.ask) return fixMode(q.ask, q.score);
  return parseMode(q.mode) ?? BY_TYPE.get(q.type ?? "")?.mode ?? m("pick", "right");
}

/** the preset that is exactly this pair, if any */
export const presetOf = (mode: Mode): Preset | undefined => PRESETS.find((p) => sameMode(p.mode, mode));

/**
 * The server's stored type for a mode: its preset's, or for a pair without
 * one, the type nearest it (same ask). The server plays the mode either way.
 */
export function typeIdOf(mode: Mode): string {
  return (
    presetOf(mode)?.type ??
    PRESETS.find((p) => p.type && p.mode.ask === mode.ask)?.type ??
    "PREWRITTEN_SINGLE"
  );
}

/** what a question of a mode has for answers */
export function answerShape(mode: Mode): AnswerShape {
  const { ask, score } = mode;
  switch (ask) {
    case "pick":
    case "pick-many":
      // a pick scored by votes has no options of its own: they're an earlier question's answers
      if (ask === "pick" && score === "votes") return null;
      return {
        text: "option",
        value: score === "none" ? null : score === "crowd" ? "points if most picked" : "points",
        starts: score === "crowd" ? 100 : 0,
      };
    case "type-in":
      return { text: "accepted answer", value: "points", starts: 100 };
    case "order":
      return { text: "item, in the right order", value: "points", starts: 50 };
    case "number":
      return score === "right" ? { text: "the right number", value: "points if spot on", starts: 1000 } : null;
    case "match":
      return { text: "left", match: "right", value: "points", starts: 100 };
    case "rank":
      return { text: "item", value: null, starts: 0 };
    case "write":
    case "draw":
      return score === "secret" ? { text: "secret word", value: "points per right guess", starts: 100 } : null;
    case "person":
      // the options are the players
      return null;
    default:
      return null;
  }
}

export interface Described {
  mode: Mode;
  ask: AskInfo;
  score: ScoreInfo;
  /** its preset, when it is one */
  preset?: Preset;
  label: string;
  icon: string;
  blurb: string;
  answers: AnswerShape;
  fields: QuestionField[];
  /** players vote, guess or battle during the reveal */
  judged: boolean;
  /** the "speed" setting counts for it */
  speed: boolean;
}

const SPEEDY: Ask[] = ["pick", "pick-many", "type-in", "order", "number", "match"];

/** Everything about a mode, for the screens: what to call it, what to show, what it needs. */
export function describe(mode: Mode): Described {
  const ask = askInfo(mode.ask);
  const score = scoreInfo(mode.score);
  const preset = presetOf(mode);
  return {
    mode,
    ask,
    score,
    preset,
    label: preset?.label ?? `${ask.label} · ${score.label}`,
    icon: preset?.icon ?? ask.icon,
    blurb: preset?.blurb ?? `${ask.blurb}; ${score.blurb}`,
    answers: answerShape(mode),
    fields: ask.fields,
    // a pick on earlier answers is voted on while it's asked, so its reveal settles at once
    judged: score.judged && mode.ask !== "pick",
    speed: score.id === "right" && SPEEDY.includes(ask.id),
  };
}

/** a question as the screens see it */
export const describeQuestion = (q: Parameters<typeof modeOf>[0]) => describe(modeOf(q));

// ─── names in the script ──────────────────────────────────────────────

const norm = (name: string) => name.trim().toLowerCase().replace(/[_\s]+/g, "-");
const BY_PRESET_NAME = new Map<string, Preset>();
for (const p of PRESETS) {
  for (const n of [p.script, ...p.aliases, ...(p.type ? [p.type.toLowerCase().replace(/_/g, "-")] : [])]) BY_PRESET_NAME.set(n, p);
}

/** names other apps and AIs give an ask, read as it (the parser notes the fix) */
const ASK_ALIASES: Record<string, Ask> = {
  "multiple-choice": "pick",
  mcq: "pick",
  choice: "pick",
  single: "pick",
  "true-false": "pick",
  "free-text": "write",
  text: "write",
  open: "write",
  essay: "write",
  drawing: "draw",
  sketch: "draw",
  player: "person",
  people: "person",
  who: "person",
  "pick-person": "person",
  "pick-player": "person",
  dropdown: "person",
};

/** the same for a score */
const SCORE_ALIASES: Record<string, Score> = {
  correct: "right",
  points: "right",
  poll: "crowd",
  majority: "crowd",
  vote: "votes",
  voting: "votes",
  "who-wrote": "authors",
  "guess-author": "authors",
  "no-points": "none",
  unscored: "none",
  off: "none",
};

/** a `type:` shorthand, by its name or an older one */
export const presetFromScript = (name: string): Preset | undefined => BY_PRESET_NAME.get(norm(name));
/** an ask by its name, or by a name it's often given instead */
export const askFromScript = (name: string): Ask | undefined => {
  const n = norm(name);
  return ASK.has(n as Ask) ? (n as Ask) : ASK_ALIASES[n];
};
/** a score the same way */
export const scoreFromScript = (name: string): Score | undefined => {
  const n = norm(name);
  return SCORE.has(n as Score) ? (n as Score) : SCORE_ALIASES[n];
};

// ─── new questions ────────────────────────────────────────────────────

type Step = { phase: "WAITING" | "QUESTION" | "ANSWER" | "ELABORATION" | "RESULT"; time: number; preview: string };
const step = (phase: Step["phase"], time: number, preview: string): Step => ({ phase, time, preview });

/** how many answer slots a new question of each ask starts with */
const SLOTS: Partial<Record<Ask, number>> = { pick: 4, "pick-many": 4, "type-in": 2, order: 4, number: 1, match: 4, rank: 4, write: 6, draw: 6 };

/**
 * A new question of a preset, as the add tray offers it when your stash has
 * no shape like it yet: its answer slots and steps that suit it.
 */
export function starterShape(p: Preset) {
  const d = describe(p.mode);
  const { ask, score } = p.mode;
  const slots = d.answers ? (SLOTS[ask] ?? 0) : 0;
  const answers = Array.from({ length: slots }, (_, i) => ({
    text: "",
    value: score === "right" && (ask === "pick" || ask === "pick-many") ? (i === 0 ? 100 : 0) : d.answers?.value ? d.answers.starts : 0,
    ...(d.answers?.match ? { match: "" } : {}),
  }));
  let steps: Step[];
  if (ask === "pick" && score === "votes") {
    steps = [step("QUESTION", 40, "Everyone votes"), step("ANSWER", 15, "The winner")];
  } else if (ask === "person") {
    steps = [step("QUESTION", 20, "Pick a person"), step("ANSWER", 10, "Who it was")];
  } else if (ask === "chain") {
    steps = [step("QUESTION", 300, "Write, draw, describe, pass it on"), step("ANSWER", 120, "The chains")];
  } else if (ask === "write" || ask === "draw") {
    const making = ask === "draw" ? step("QUESTION", 90, "Everyone draws") : step("QUESTION", 45, "Players write");
    steps = d.judged
      ? [step("WAITING", 5, "Get ready"), making, step("ANSWER", score === "knockout" ? 60 : 45, "Judging"), step("RESULT", 10, "Leaderboard")]
      : [making, step("ANSWER", 30, ask === "draw" ? "The gallery" : "The wall")];
  } else if (ask === "rank") {
    steps = [step("WAITING", 6, "Get ready"), step("QUESTION", 60, "Rank them"), step("RESULT", 15, "The group's tiers")];
  } else if (score === "crowd" || score === "none") {
    steps = [step("QUESTION", 20, "Everyone answers"), step("ANSWER", 10, "What the room thinks")];
  } else {
    steps = [step("WAITING", 5, "Get ready"), step("QUESTION", ask === "order" || ask === "match" ? 40 : 25, d.blurb), step("ANSWER", 12, "The answer")];
  }
  return { name: p.label, questionType: typeIdOf(p.mode), mode: modeKey(p.mode), answers, steps };
}

// ─── a question's extra fields, stored as "unit=m, min=0, max=100" ─────

export type QuestionOptions = Partial<Record<OptionKey, string>>;

/** the order they're stored in: "from=q1, overflow=6, ref=q2" */
const FIELDS: OptionKey[] = ["unit", "min", "max", "rounds", "from", "picks", "overflow", "ref"];

/** "overflow: on": the most options one player sees */
export const OVERFLOW_DEFAULT = 6;
/** the most different ones one player can vote for on one question */
export const PICKS_MOST = 10;

export function parseOptions(text: string | null | undefined): QuestionOptions {
  const out: QuestionOptions = {};
  for (const part of (text ?? "").split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const key = part.slice(0, i).trim().toLowerCase() as OptionKey;
    if (!FIELDS.includes(key)) continue;
    out[key] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function formatOptions(o: QuestionOptions): string {
  return FIELDS.filter((k) => o[k] !== undefined && o[k] !== "")
    .map((k) => `${k}=${encodeURIComponent(o[k]!)}`)
    .join(", ");
}

/** A number field, or the fallback when it's missing or isn't a number. */
export function optionNumber(o: QuestionOptions, key: OptionKey, fallback: number): number {
  const n = Number(o[key]);
  return o[key] !== undefined && o[key] !== "" && Number.isFinite(n) ? n : fallback;
}

/** how many different ones each player may vote for: 1 to 10, 1 when unset */
export function picksOf(o: QuestionOptions): number {
  return Math.max(1, Math.min(PICKS_MOST, Math.round(optionNumber(o, "picks", 1))));
}

/** the most options one player sees: 0 when off, "on" is 6, else 2 to 20 */
export function overflowOf(o: QuestionOptions): number {
  const v = o.overflow?.trim().toLowerCase();
  if (!v) return 0;
  if (v === "on" || v === "yes" || v === "true") return OVERFLOW_DEFAULT;
  const n = Number(v);
  return !Number.isFinite(n) || n < 2 ? 0 : Math.min(20, Math.round(n));
}

/** a pick whose options are an earlier question's answers */
export function borrows(mode: Mode, o: QuestionOptions): boolean {
  return mode.ask === "pick" && (mode.score === "votes" || !!o.from);
}
