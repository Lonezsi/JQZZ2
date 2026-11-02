/*
 * Every question type, in one place: its name in the script, the names older
 * scripts used, what it's called on screen, and what its answers and extra
 * fields mean. The parser, the writer, the editor and the play screens all
 * read it from here. The language itself is described in docs/script.md.
 */

/** How a type is played: what the phone shows while answering. */
export type Family =
  | "choice" // pick one option
  | "multi" // pick any number of options
  | "typed" // type the answer
  | "order" // put the items in order
  | "number" // pick a number
  | "match" // pair the items up
  | "poll" // pick one, scored by the crowd
  | "tier" // rank items into tiers
  | "write" // write something
  | "draw" // draw something
  | "telephone"; // write, draw, describe, in turns

/** Extra fields a question of a type can carry, besides prompt and answers. */
export type QuestionField = "unit" | "min" | "max" | "rounds";

export interface QuestionTypeInfo {
  /** what the server stores */
  id: string;
  /** its name in the script */
  script: string;
  /** names older scripts used, still read */
  aliases: string[];
  /** what people call it */
  label: string;
  /** a Glyph name */
  icon: string;
  family: Family;
  /** one line on how it plays */
  blurb: string;
  /** what its answers are, for the editor's columns; null: it has none */
  answers: null | {
    /** the text column */
    text: string;
    /** the points column */
    value: string;
    /** the second text column, for pairs */
    match?: string;
    /** points a new answer starts with */
    starts: number;
  };
  /** extra fields it reads */
  fields: QuestionField[];
  /** players vote, guess or battle during the reveal */
  judged: boolean;
  /** the "speed" setting counts for it */
  speed: boolean;
}

export const QUESTION_TYPES_INFO: QuestionTypeInfo[] = [
  {
    id: "PREWRITTEN_SINGLE",
    script: "single",
    aliases: ["prewritten-single"],
    label: "single choice",
    icon: "PREWRITTEN_SINGLE",
    family: "choice",
    blurb: "pick one",
    answers: { text: "option", value: "points", starts: 0 },
    fields: [],
    judged: false,
    speed: true,
  },
  {
    id: "PREWRITTEN_MULTIPLE",
    script: "multiple",
    aliases: ["prewritten-multiple"],
    label: "multiple choice",
    icon: "PREWRITTEN_MULTIPLE",
    family: "multi",
    blurb: "pick any that are right",
    answers: { text: "option", value: "points", starts: 0 },
    fields: [],
    judged: false,
    speed: true,
  },
  {
    id: "TYPED",
    script: "typed",
    aliases: ["type-answer", "type-it"],
    label: "type it",
    icon: "TYPED",
    family: "typed",
    blurb: "type the answer: spelling is forgiven a little",
    answers: { text: "accepted answer", value: "points", starts: 100 },
    fields: [],
    judged: false,
    speed: true,
  },
  {
    id: "ORDER",
    script: "order",
    aliases: ["puzzle", "sort"],
    label: "put in order",
    icon: "ORDER",
    family: "order",
    blurb: "drag the items into the right order",
    answers: { text: "item, in the right order", value: "points", starts: 50 },
    fields: [],
    judged: false,
    speed: true,
  },
  {
    id: "NUMBER",
    script: "number",
    aliases: ["estimate", "slider"],
    label: "estimate",
    icon: "NUMBER",
    family: "number",
    blurb: "guess the number: the closer, the more",
    answers: { text: "the right number", value: "points if spot on", starts: 1000 },
    fields: ["unit", "min", "max"],
    judged: false,
    speed: true,
  },
  {
    id: "MATCH",
    script: "match",
    aliases: ["pairs"],
    label: "match pairs",
    icon: "MATCH",
    family: "match",
    blurb: "pair each one with its other half",
    answers: { text: "left", match: "right", value: "points", starts: 100 },
    fields: [],
    judged: false,
    speed: true,
  },
  {
    id: "POLL",
    script: "poll",
    aliases: ["hive-mind", "crowd"],
    label: "poll",
    icon: "POLL",
    family: "poll",
    blurb: "everyone votes: points for siding with the most",
    answers: { text: "option", value: "points if most picked", starts: 100 },
    fields: [],
    judged: false,
    speed: false,
  },
  {
    id: "TIERLIST",
    script: "tierlist",
    aliases: ["tier-list"],
    label: "tier list",
    icon: "TIERLIST",
    family: "tier",
    blurb: "rank everything from S to D",
    answers: { text: "item", value: "points", starts: 0 },
    fields: [],
    judged: false,
    speed: false,
  },
  {
    id: "USER_GENERATED",
    script: "write",
    aliases: ["user-generated"],
    label: "players write",
    icon: "USER_GENERATED",
    family: "write",
    blurb: "everyone writes; it all goes on a wall",
    answers: null,
    fields: [],
    judged: false,
    speed: false,
  },
  {
    id: "USER_GENERATED_VOTE",
    script: "write-vote",
    aliases: ["user-generated-vote"],
    label: "write + vote",
    icon: "USER_GENERATED_VOTE",
    family: "write",
    blurb: "write the best answer, then vote for someone else's",
    answers: null,
    fields: [],
    judged: true,
    speed: false,
  },
  {
    id: "USER_GENERATED_IDENTIFY",
    script: "who-wrote",
    aliases: ["user-generated-identify"],
    label: "who wrote it",
    icon: "USER_GENERATED_IDENTIFY",
    family: "write",
    blurb: "write something, then guess who wrote what",
    answers: null,
    fields: [],
    judged: true,
    speed: false,
  },
  {
    id: "KNOCKOUT_BATTLE",
    script: "knockout",
    aliases: ["knockout-battle"],
    label: "knockout",
    icon: "KNOCKOUT_BATTLE",
    family: "write",
    blurb: "write, then the answers battle it out",
    answers: null,
    fields: [],
    judged: true,
    speed: false,
  },
  {
    id: "DRAW",
    script: "draw",
    aliases: ["drawing"],
    label: "draw it",
    icon: "DRAW",
    family: "draw",
    blurb: "everyone draws; it all goes on a wall",
    answers: null,
    fields: [],
    judged: false,
    speed: false,
  },
  {
    id: "DRAW_VOTE",
    script: "draw-vote",
    aliases: [],
    label: "draw + vote",
    icon: "DRAW_VOTE",
    family: "draw",
    blurb: "draw the prompt, then vote for the best drawing",
    answers: null,
    fields: [],
    judged: true,
    speed: false,
  },
  {
    id: "DRAW_GUESS",
    script: "draw-guess",
    aliases: ["pictionary"],
    label: "draw + guess",
    icon: "DRAW_GUESS",
    family: "draw",
    blurb: "everyone draws a secret word, then guesses the others'",
    answers: { text: "secret word", value: "points per right guess", starts: 100 },
    fields: [],
    judged: true,
    speed: false,
  },
  {
    id: "DRAW_BATTLE",
    script: "draw-knockout",
    aliases: ["draw-battle"],
    label: "draw knockout",
    icon: "DRAW_BATTLE",
    family: "draw",
    blurb: "draw, then the drawings battle it out",
    answers: null,
    fields: [],
    judged: true,
    speed: false,
  },
  {
    id: "TELEPHONE",
    script: "telephone",
    aliases: ["gartic"],
    label: "telephone",
    icon: "TELEPHONE",
    family: "telephone",
    blurb: "write, then draw what you're handed, then describe the drawing, and on",
    answers: null,
    fields: ["rounds"],
    judged: false,
    speed: false,
  },
];

const BY_ID = new Map(QUESTION_TYPES_INFO.map((t) => [t.id, t]));
const BY_NAME = new Map<string, QuestionTypeInfo>();
for (const t of QUESTION_TYPES_INFO) {
  for (const n of [t.script, ...t.aliases, t.id.toLowerCase().replace(/_/g, "-")]) BY_NAME.set(n, t);
}

/** The type with this server id, or single choice for anything unknown. */
export const typeInfo = (id: string | undefined | null): QuestionTypeInfo => BY_ID.get(id ?? "") ?? QUESTION_TYPES_INFO[0];

/** The type a script calls this, by its name or an older one; undefined if there's none. */
export function typeFromScript(name: string): QuestionTypeInfo | undefined {
  return BY_NAME.get(name.trim().toLowerCase().replace(/[_\s]+/g, "-"));
}

/** Server ids of every type, in the order the editor offers them. */
export const QUESTION_TYPE_IDS = QUESTION_TYPES_INFO.map((t) => t.id);

type Step = { phase: "WAITING" | "QUESTION" | "ANSWER" | "ELABORATION" | "RESULT"; time: number; preview: string };
const step = (phase: Step["phase"], time: number, preview: string): Step => ({ phase, time, preview });

/** how many answer slots a new question of each family starts with */
const SLOTS: Partial<Record<Family, number>> = { choice: 4, multi: 4, typed: 2, order: 4, number: 1, match: 4, poll: 3, tier: 4 };

/**
 * A new question of a type, as the add tray offers it when your stash has
 * no shape of that type yet: the type's answer slots and steps that suit it.
 */
export function starterShape(t: QuestionTypeInfo) {
  const slots = t.answers ? (t.id === "DRAW_GUESS" ? 4 : (SLOTS[t.family] ?? 0)) : 0;
  const answers = Array.from({ length: slots }, (_, i) => ({
    text: "",
    value: t.family === "choice" || t.family === "multi" ? (i === 0 ? 100 : 0) : t.family === "tier" ? 0 : t.answers!.starts,
    ...(t.answers?.match ? { match: "" } : {}),
  }));
  let steps: Step[];
  switch (t.family) {
    case "poll":
      steps = [step("QUESTION", 20, "Everyone votes"), step("ANSWER", 10, "What the room thinks")];
      break;
    case "tier":
      steps = [step("WAITING", 6, "Get ready"), step("QUESTION", 60, "Drag items into tiers"), step("RESULT", 15, "The group's tiers")];
      break;
    case "write":
      steps = t.judged
        ? [step("WAITING", 6, "Get ready"), step("QUESTION", 45, "Players write"), step("ANSWER", 40, "Judging"), step("RESULT", 10, "Leaderboard")]
        : [step("QUESTION", 45, "Players write"), step("ANSWER", 20, "The wall")];
      break;
    case "draw":
      steps = t.judged
        ? [step("WAITING", 5, "Get ready"), step("QUESTION", 90, "Everyone draws"), step("ANSWER", t.id === "DRAW_BATTLE" ? 60 : 45, "Judging"), step("RESULT", 10, "Leaderboard")]
        : [step("QUESTION", 90, "Everyone draws"), step("ANSWER", 30, "The gallery")];
      break;
    case "telephone":
      steps = [step("QUESTION", 300, "Write, draw, describe, pass it on"), step("ANSWER", 120, "The chains")];
      break;
    default:
      steps = [
        step("WAITING", 5, "Get ready"),
        step("QUESTION", t.family === "order" || t.family === "match" ? 40 : 25, t.blurb),
        step("ANSWER", 12, "The answer"),
      ];
  }
  return { name: t.label, questionType: t.id, answers, steps };
}

// ─── a question's extra fields, stored as "unit=m, min=0, max=100" ─────

export type QuestionOptions = Partial<Record<QuestionField, string>>;

const FIELDS: QuestionField[] = ["unit", "min", "max", "rounds"];

export function parseOptions(text: string | null | undefined): QuestionOptions {
  const out: QuestionOptions = {};
  for (const part of (text ?? "").split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const key = part.slice(0, i).trim().toLowerCase() as QuestionField;
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
export function optionNumber(o: QuestionOptions, key: QuestionField, fallback: number): number {
  const n = Number(o[key]);
  return o[key] !== undefined && o[key] !== "" && Number.isFinite(n) ? n : fallback;
}
