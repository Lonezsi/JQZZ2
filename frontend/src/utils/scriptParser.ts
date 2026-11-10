import type { Question, Action, Answer } from "../types";
import { FN_PHASE_MAP } from "../constants/phaseMaps";
import { generateId } from "./idGenerator";
import { DEFAULTS, formatSettings, parseSettings } from "./settings";
import type { QuizSettings } from "./settings";
import {
  ASKS,
  PICKS_MOST,
  SCORES,
  askFromScript,
  askInfo,
  formatOptions,
  modeKey,
  modeOf,
  parseOptions,
  presetFromScript,
  scoreFromScript,
  typeIdOf,
} from "./questionTypes";
import type { Ask, Mode, QuestionField, QuestionOptions, Score } from "./questionTypes";
import { rosterAction, rosterProblem } from "./roster";

/*
 * Reads a JQzz script (utils/scriptDocs.ts) into questions and timeline steps.
 * The script is the source of truth: whatever it can say, the quiz can be.
 *
 * Scripts often come from a chat AI, so the reader forgives the usual slips
 * (utils/scriptDocs.ts, WHAT THE READER FORGIVES) and says which lines it tidied
 * in `fixed`. A repair only ever changes how a line that was an error or a
 * note reads: a script that was valid reads exactly as it did.
 */

export interface ParseResult {
  questions: Question[];
  actions: Action[];
  /** what keeps the script from applying, "Line 7: ..." */
  errors: string[];
  /** lines it read as meant though they weren't written the usual way, "Line 12: read as ShowQuestion(Q1, time: 30)"; never block */
  fixed: string[];
  /** things nobody can score on, or a question that's never shown; they don't block the editor, the AI kit lists them */
  warnings: string[];
}

// ─── strings, comments and the small pieces lines are made of ─────────

/** characters an AI or a word processor leaves in that nobody can see */
const INVISIBLE = /[\u200B-\u200D\uFEFF]/g;
const clean = (s: string) => s.replace(INVISIBLE, "").trim();

/** the quotes that close each kind of opening quote */
const CLOSERS: Record<string, string> = { '"': '"', "'": "'", "“": "”“", "„": "”“" };

/** a quote here opens a string; an apostrophe inside a word doesn't */
const opensString = (s: string, k: number) => !!CLOSERS[s[k]] && (s[k] !== "'" || !/[\p{L}\p{N}]/u.test(s[k - 1] ?? ""));

/** the index just after the string that opens at s[from], or -1 when it never closes */
function stringEnd(s: string, from: number): number {
  const open = s[from];
  const close = CLOSERS[open];
  for (let k = from + 1; k < s.length; k++) {
    if (open === '"' && s[k] === "\\") {
      k++;
      continue;
    }
    if (close.includes(s[k])) return k + 1;
  }
  return -1;
}

/** s with every string (quotes included) turned into x's, so commas, brackets and # inside text don't count */
function maskStrings(s: string): string {
  let out = "";
  let k = 0;
  while (k < s.length) {
    if (opensString(s, k)) {
      let end = stringEnd(s, k);
      if (end < 0) end = s.length;
      out += "x".repeat(end - k);
      k = end;
      continue;
    }
    out += s[k];
    k++;
  }
  return out;
}

/** s without a # or // comment at its end (outside strings) */
function stripComment(s: string): string {
  const at = maskStrings(s).search(/#|\/\//);
  return at < 0 ? s : s.slice(0, at);
}

/** "a, "b, c", d" -> a | "b, c" | d */
function splitArgs(s: string): string[] {
  const mask = maskStrings(s);
  const out: string[] = [];
  let from = 0;
  for (let k = 0; k <= mask.length; k++) {
    if (k === mask.length || mask[k] === ",") {
      out.push(s.slice(from, k).trim());
      from = k + 1;
    }
  }
  return out;
}

/** "Q1", "q 1", "{Q1}", "Q1.answers" -> "Q1"; null when it doesn't name a question */
const Q_REF = /^\{?\s*Q\s*(\d+)\s*(\.\s*(answers|entries))?\s*\}?$/i;
const qRefOf = (s: string): string | null => {
  const m = s.trim().match(Q_REF);
  return m ? `Q${Number(m[1])}` : null;
};

/** a name as the registry compares it */
const scriptName = (s: string) => s.trim().toLowerCase().replace(/[_\s]+/g, "-");

// ─── a step: ShowQuestion(Q1, time: 30) ───────────────────────────────

const STEP_NAMES: Record<string, string> = {
  waiting: "ShowWaiting",
  wait: "ShowWaiting",
  question: "ShowQuestion",
  answers: "ShowAnswers",
  answer: "ShowAnswers",
  elaboration: "ShowElaboration",
  explanation: "ShowElaboration",
  result: "ShowResult",
  results: "ShowResult",
  leaderboard: "ShowResult",
  scores: "ShowResult",
};

/** the time a step gets when it doesn't say one */
const STEP_TIME: Record<string, number> = { ShowWaiting: 5, ShowQuestion: 30, ShowAnswers: 15, ShowElaboration: 10, ShowResult: 8 };
/** making something takes longer than answering */
const QUESTION_TIME: Partial<Record<Ask, number>> = { chain: 300, draw: 90, write: 60 };

const S3 = "can't read this step. Write it like: ShowQuestion(Q1, time: 30)";
const S4 = "say which question this step shows: ShowQuestion(Q1, time: 30)";

/**
 * A step line, `ShowQuestion(Q1, time: 30)`: its function, the question it
 * shows and its time. null when the line isn't a step at all; `error` when it
 * is one that can't be read. `askOf` tells a question's ask, for the time a
 * step gets when it doesn't say one (`defaulted`). `canonical`: written just
 * as the writer writes it. The editor's hints read steps through this too, so
 * they can't disagree with the parser.
 */
export function readShowLine(
  line: string,
  askOf?: (ref: string) => Ask | undefined,
): { fn: string; ref: string; time: number; defaulted: boolean; canonical: boolean } | { error: string } | null {
  const t = clean(line);
  const m = t.match(/^show\s*([a-z]+)\s*\((.*?)\)\s*[;,]?\s*((#|\/\/).*)?$/i);
  if (!m) return /^show(waiting|question|answers?|elaboration|results?)\b/i.test(t) ? { error: S3 } : null;
  const fn = STEP_NAMES[m[1].toLowerCase()];
  if (!fn) {
    const said = t.match(/^show\s*[a-z]+/i)![0];
    return { error: `${said} isn't a step. The steps are ShowWaiting, ShowQuestion, ShowAnswers, ShowElaboration and ShowResult` };
  }
  let ref: string | undefined;
  let time: number | undefined;
  for (const arg of splitArgs(m[2])) {
    if (!arg) continue;
    const r = arg.match(/^(question\s*[:=]\s*)?["']?\s*(q\s*\d+)\s*["']?$/i);
    if (r && !ref) {
      ref = `Q${Number(r[2].replace(/\D/g, ""))}`;
      continue;
    }
    const tm = arg.match(/^(time\s*[:=]\s*)?["']?\s*(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds)?\s*["']?$/i);
    if (tm && time === undefined) {
      time = Math.round(Number(tm[2]));
      continue;
    }
    return { error: S3 };
  }
  if (!ref) return { error: S4 };
  if (time === undefined) {
    const ask = askOf?.(ref);
    const t2 = fn === "ShowQuestion" ? ((ask && QUESTION_TIME[ask]) ?? STEP_TIME[fn]) : STEP_TIME[fn];
    return { fn, ref, time: t2, defaulted: true, canonical: false };
  }
  return { fn, ref, time, defaulted: false, canonical: t === `${fn}(${ref}, time: ${time})` };
}

// ─── a question's header: NewQuestion Q1 ( ────────────────────────────

const S1 = "can't read this question header. Write it like: NewQuestion Q1 (";

/**
 * A question's header, `NewQuestion Q1 (`: its name, whether its block opens
 * on this line (`opens`), and what follows the "(" there (`rest`, the first
 * line of its body). null when the line isn't a header; `error` when it is
 * one that can't be read. `canonical`: written just as the writer writes it.
 */
export function readHeader(line: string): { ref: string; opens: boolean; rest: string; canonical: boolean } | { error: string } | null {
  const t = clean(line);
  const m = t.match(/^new\s*question\b\s*(.*)$/i);
  if (!m) return null;
  const name = m[1].match(/^q\s*(\d+)/i);
  if (!name) {
    const said = m[1].match(/^[^\s(]+/)?.[0];
    return { error: said ? `name questions Q1, Q2, Q3 and on, not "${said}"` : S1 };
  }
  const ref = `Q${Number(name[1])}`;
  const after = stripComment(m[1].slice(name[0].length)).trim();
  const canonical = t === `NewQuestion ${ref} (`;
  if (after === "") return { ref, opens: false, rest: "", canonical };
  if (after.startsWith("(")) return { ref, opens: true, rest: after.slice(1).trim(), canonical };
  return { error: S1 };
}

/** a line that's only "(", maybe with a comment: a header's "(" on the next line */
const OPEN_LINE = /^\(\s*((#|\/\/).*)?$/;
/** a line that's only ")": the end of a block */
const CLOSE_LINE = /^\)\s*[,;]?\s*((#|\/\/).*)?$/;
/** lines that start something new at the top: a block left open ends before them */
const TOP_LINE = /^(new\s*question\b|show\w*\s*\(|roster\s*\()/i;

/** a body line that ends the block itself, `prompt: "x" )`: the part before its ")", else null */
function endsWithClose(text: string): string | null {
  const s = stripComment(text);
  const mask = maskStrings(s).trimEnd();
  if (!/\)\s*[,;]?$/.test(mask)) return null;
  return s.slice(0, mask.lastIndexOf(")"));
}

// ─── settings lines and list markers ──────────────────────────────────

/** `speed, points=2 {`, also `points: 2 {  # double`: what it opens, and how it reads when written the usual way */
function readSettingsLine(line: string): { opened: Partial<QuizSettings>; changed: boolean; canonical: string } | null {
  const bare = stripComment(line).trim();
  const m = bare.match(/^(.+?)\s*\{$/);
  if (!m) return null;
  const head = m[1].replace(/([A-Za-z]+)\s*:\s*/g, "$1=");
  const opened = parseSettings(head);
  if (Object.keys(opened).length === 0) return null;
  return { opened, changed: head !== m[1] || bare !== line, canonical: `${head} {` };
}

/** `1. NewQuestion Q1 (`, `- ShowQuestion(...)`, `**...**`, a line in backticks: what's inside, or null */
function unwrap(line: string): string | null {
  const m = line.match(/^(\d+[.)]|[-*•])\s+(.*)$/) ?? line.match(/^(\*\*)(.+)\*\*$/) ?? line.match(/^(`)([^`]+)`$/);
  return m ? m[2].trim() : null;
}

/** a line that means something at the top of a script, so a list marker before it is just in the way */
const structural = (s: string) =>
  readHeader(s) !== null || readShowLine(s) !== null || /^roster\s*\(/i.test(s) || readSettingsLine(s) !== null || s === "}" || s === ")";

export type TopKind = "skip" | "divider" | "settings" | "close" | "roster" | "roster-miss" | "header" | "step" | "note";

/**
 * What a line outside a question block is, the way the parser reads it, and
 * its text once tidied (`unwrapped`: a list marker or ** was taken off). The
 * editor's hints use this too, so they can't disagree with the parser.
 */
export function topLine(raw: string): { kind: TopKind; text: string; unwrapped: boolean } {
  let text = clean(raw);
  if (!text || /^```[\w-]*$/.test(text) || text.startsWith("#") || text.startsWith("//")) return { kind: "skip", text, unwrapped: false };
  const inner = unwrap(text);
  const unwrapped = inner !== null && structural(inner);
  if (unwrapped) text = inner;
  let kind: TopKind = "note";
  if (text === "---") kind = "divider";
  else if (readSettingsLine(text)) kind = "settings";
  else if (text === "}") kind = "close";
  else if (/^roster\s*\(/i.test(text)) kind = "roster";
  // Roster: ..., players(...): an attempt at a roster; "players: Anna, Bence" stays a note
  else if (/^roster\s*[:=([{]/i.test(text) || /^players\s*[([{=]/i.test(text)) kind = "roster-miss";
  else if (readHeader(text)) kind = "header";
  else if (readShowLine(text)) kind = "step";
  return { kind, text, unwrapped };
}

/** a line inside a block that starts something new at the top, so a block left open ends before it */
export const startsTop = (raw: string) => TOP_LINE.test(clean(raw));
/** a header's "(" on a line of its own */
export const opensBlock = (raw: string) => OPEN_LINE.test(clean(raw));
/** a line that ends a block: ")" on its own, or a field line ending in ")" */
export const closesBlock = (raw: string) => CLOSE_LINE.test(clean(raw)) || endsWithClose(raw.replace(INVISIBLE, "")) !== null;
/** a roster line that goes on past this one: its ")" is still to come */
export const rosterGoesOn = (raw: string) => !maskStrings(clean(raw)).includes(")");

/** fields a question block can have besides its extras (questionTypes: QuestionField) */
const EXTRA_FIELDS: QuestionField[] = ["unit", "min", "max", "rounds"];

// ─── the inside of a NewQuestion ( ... ) block ─────────────────────────

type Tok =
  | { k: "id" | "str" | "num"; v: string; line: number }
  | { k: "punc"; v: string; line: number };

type Fix = (line: number, text: string) => void;

/** what may follow a string on a field line; anything else means the string had quotes inside it */
const CONTINUES = /^\s*($|[,}\])#:=]|\/\/|[A-Za-z_][\w-]*\s*[:=])/;

/**
 * The string opening at s[0]: its value and length. When what follows it
 * can't be the rest of a field line, the quotes inside were meant as text:
 * it runs on to the nearest closing quote after which the line reads.
 */
function readString(s: string): { v: string; len: number; inner: boolean } | null {
  const end = stringEnd(s, 0);
  if (end < 0) return null;
  let at = end;
  let inner = false;
  if (!CONTINUES.test(s.slice(at))) {
    const close = CLOSERS[s[0]];
    for (let k = at; k < s.length; k++) {
      if (close.includes(s[k]) && CONTINUES.test(s.slice(k + 1))) {
        at = k + 1;
        inner = true;
        break;
      }
    }
  }
  const body = s.slice(1, at - 1);
  let v = body;
  if (s[0] === '"') {
    try {
      v = JSON.parse(inner ? `"${body.replace(/\\?"/g, '\\"')}"` : s.slice(0, at));
    } catch {
      v = body;
    }
  }
  return { v, len: at, inner };
}

/** `prompt: "a, b"` -> id prompt, punc :, str "a, b": strings keep their commas and colons */
function tokenize(lines: { text: string; no: number }[], errors: string[], fix: Fix): Tok[] {
  const out: Tok[] = [];
  for (const { text, no } of lines) {
    let s = text.replace(INVISIBLE, "");
    let requoted = false;
    while (s.length) {
      const ws = s.match(/^\s+/);
      if (ws) {
        s = s.slice(ws[0].length);
        continue;
      }
      if (s.startsWith("#")) break;
      if (s.startsWith("//")) {
        fix(no, "read // as a comment");
        break;
      }
      if (CLOSERS[s[0]]) {
        const str = readString(s);
        if (str) {
          if (s[0] !== '"' && !requoted) {
            requoted = true;
            fix(no, 'read the quotes as "double quotes"');
          }
          if (str.inner) fix(no, "read the quotes inside the text as part of it");
          out.push({ k: "str", v: str.v, line: no });
          s = s.slice(str.len);
          continue;
        }
      }
      const num = s.match(/^-?\d+(?:\.\d+)?/);
      if (num) {
        out.push({ k: "num", v: num[0], line: no });
        s = s.slice(num[0].length);
        continue;
      }
      const id = s.match(/^[A-Za-z_][\w-]*/);
      if (id) {
        out.push({ k: "id", v: id[0], line: no });
        s = s.slice(id[0].length);
        continue;
      }
      if ("{}[]:,".includes(s[0])) {
        out.push({ k: "punc", v: s[0], line: no });
        s = s.slice(1);
        continue;
      }
      if (s[0] === "=") {
        fix(no, "read = as :");
        out.push({ k: "punc", v: ":", line: no });
        s = s.slice(1);
        continue;
      }
      errors.push(`Line ${no}: can't read "${s.trim()}"`);
      break;
    }
  }
  return out;
}

type Value = string | number;
type Fields = { key: string; value: Value | Record<string, Value>[]; line: number }[];

const TRUE = ["true", "yes", "1"];
const FALSE = ["false", "no", "0"];

/** key: value, key: value ... where a value is a string, a number or a [ { ... } ] list */
function readFields(toks: Tok[], errors: string[], fix: Fix): Fields {
  const fields: Fields = [];
  let i = 0;
  const peek = () => toks[i];
  const isPunc = (t: Tok | undefined, v: string) => !!t && t.k === "punc" && t.v === v;
  const skipComma = () => {
    while (isPunc(peek(), ",")) i++;
  };
  /** a key: a word, or a word in quotes, followed by ":" */
  const isKey = (at: number) => !!toks[at] && (toks[at].k === "id" || toks[at].k === "str") && isPunc(toks[at + 1], ":");
  const keyOf = (t: Tok) => {
    if (t.k === "str") fix(t.line, `read "${t.v}" as ${t.v}`);
    return t.v;
  };
  /** a value: a string, a number, or a bare word read as a string */
  const scalar = (t: Tok | undefined, quiet = false): Value | undefined => {
    if (!t) return undefined;
    if (t.k === "str") return t.v;
    if (t.k === "num") return Number(t.v);
    if (t.k === "id") {
      if (!quiet) fix(t.line, `read ${t.v} as "${t.v}"`);
      return t.v;
    }
    return undefined;
  };

  while (i < toks.length) {
    skipComma();
    const key = toks[i];
    if (!key) break;
    if (!isKey(i)) {
      errors.push(`Line ${key.line}: expected a field like "prompt: ...", found "${key.v}"`);
      // skip to the next line's tokens
      const line = key.line;
      while (i < toks.length && toks[i].line === line) i++;
      continue;
    }
    const name = keyOf(key);
    i += 2;
    if (isPunc(peek(), "[")) {
      i++;
      const list: Record<string, Value>[] = [];
      while (i < toks.length && !isPunc(peek(), "]")) {
        skipComma();
        if (isPunc(peek(), "]")) break;
        const item = peek();
        // a bare option, "Paris", is an answer worth nothing
        if (item.k === "str" && !isPunc(toks[i + 1], ":")) {
          fix(item.line, `read "${item.v}" as { text: "${item.v}", value: 0 }`);
          list.push({ text: item.v, value: 0 });
          i++;
          continue;
        }
        if (!isPunc(item, "{")) {
          errors.push(`Line ${item.line}: expected { ... } in ${name}`);
          i++;
          continue;
        }
        i++;
        const obj: Record<string, Value> = {};
        while (i < toks.length && !isPunc(peek(), "}")) {
          skipComma();
          const k = toks[i];
          if (!k || isPunc(k, "}")) break;
          const ok = isKey(i);
          const v = ok ? scalar(toks[i + 2], k.v === "correct") : undefined;
          if (!ok || v === undefined) {
            errors.push(`Line ${k.line}: can't read "${k.v}" in ${name}`);
            i++;
            continue;
          }
          obj[keyOf(k)] = v;
          i += 3;
        }
        if (isPunc(peek(), "}")) i++;
        // correct: true is how other quiz formats say an answer is the right one
        if (obj.correct !== undefined) {
          const c = String(obj.correct).toLowerCase();
          if (TRUE.includes(c) || FALSE.includes(c)) {
            const right = TRUE.includes(c);
            if (obj.value === undefined) obj.value = right ? 100 : 0;
            fix(item.line, right ? "read correct: true as value: 100" : "read correct: false as value: 0");
            delete obj.correct;
          }
        }
        list.push(obj);
      }
      if (isPunc(peek(), "]")) i++;
      else errors.push(`Line ${key.line}: ${name} is missing its closing "]"`);
      fields.push({ key: name, value: list, line: key.line });
      continue;
    }
    const v = scalar(peek());
    if (v === undefined) {
      errors.push(`Line ${key.line}: ${name} needs a "string" or a number`);
      i++;
      continue;
    }
    fields.push({ key: name, value: v, line: key.line });
    i++;
  }
  return fields;
}

// ─── fill-ins: {Q2.winner}, {author}, {answer} ────────────────────────

/** anything in braces that looks like it wants filling in; {1,2}, { } and {a b} stay text */
const FILL = /\{\{?\s*([A-Za-z][\w-]*(\s*\.\s*[A-Za-z][\w-]*)?)\s*\}?\}/g;
const WINNER_WORDS = /^(winner|win|top|best|winning|funniest)$/i;
const AUTHOR_WORDS = /^(author|name|player|person|who)$/i;
const ANSWER_WORDS = /^(answer|text|entry)$/i;
/** quotes hugging a fill-in that brings its own */
const HUGGED = /(["'“„])(\{answer\}|\{Q\d+\.winner\})(["'”“])/g;
const HUG_PAIRS: Record<string, string> = { '"': '"', "'": "'", "“": "”", "„": "”“" };

const P1_TAIL = "isn't something JQzz can fill in. It can fill in {Q2.winner}, and {author} and {answer} on a question with from";

// ─── what the reader keeps about each question while it reads ─────────

interface Info {
  /** its name in the script, "Q2" */
  name: string;
  q: Question;
  header: number;
  mode: Mode;
  /** the question it names in from (or answers: Q1), and where; no line when it was a default */
  from?: string;
  fromLine?: number;
  answersLine?: number;
  scoreLine?: number;
  picksLine?: number;
  overflowLine?: number;
  picks?: number;
  overflow?: number;
  /** {Qn.winner} in its texts */
  winners: { name: string; line: number }[];
  /** {author} and {answer} in its texts */
  fills: { kind: "author" | "answer"; line: number }[];
  /** its first and last step, and whether any of its steps is in a shuffle group */
  first?: number;
  last?: number;
  shuffled: boolean;
}

/**
 * Parses a JQzz script. Questions keep the identity (id, images) of the
 * question with the same Q-number in `prevQuestions`, so editing the text
 * doesn't detach anything that isn't represented in the script.
 */
export function parseScript(text: string, prevQuestions: Question[]): ParseResult {
  const { questions, actions, errors, fixed, warnings } = readScript(text, prevQuestions);
  return { questions, actions, errors, fixed, warnings };
}

/**
 * parseScript, plus which question each name in the script is: the editor's
 * hints read it, so they say what the parser read.
 */
export function readScript(text: string, prevQuestions: Question[]): ParseResult & { byName: Map<string, Question> } {
  const lines = text.split(/\r?\n/);
  const questions: Question[] = [];
  const actions: Action[] = [];
  const errors: string[] = [];
  const fixed: string[] = [];
  const warnings: string[] = [];
  const err = (no: number, t: string) => errors.push(`Line ${no}: ${t}`);
  const fix: Fix = (no, t) => fixed.push(`Line ${no}: ${t}`);
  const qRefMap = new Map<string, Question>();
  const infos: Info[] = [];
  const infoOf = new Map<Question, Info>();
  let rosterLine = 0;
  // open `settings {` groups: what each one changed, so `}` can put it back
  const groups: Partial<QuizSettings>[] = [];
  let current: QuizSettings = { ...DEFAULTS };
  const setting = (s: Partial<QuizSettings>) => {
    current = { ...current, ...s };
    actions.push({ id: generateId(), phase: "SETTING", time: 0, question: null, preview: formatSettings(s) });
  };
  let i = 0;

  /**
   * A block's body, from just after its "(" to its ")". `first` is what
   * followed the "(" on the header line. It ends at a line that's ")", at a
   * line ending in ")", or, with the ")" forgotten, just before the next
   * question or step.
   */
  const readBody = (first: string, headerNo: number, name: string) => {
    const body: { text: string; no: number }[] = [];
    const inline = (t: string, no: number) => {
      const cut = endsWithClose(t);
      if (cut === null) return false;
      if (cut.trim()) body.push({ text: cut, no });
      return true;
    };
    if (first) {
      if (CLOSE_LINE.test(first)) return { body, closed: true, odd: true, endLine: headerNo };
      if (inline(first, headerNo)) return { body, closed: true, odd: true, endLine: headerNo };
      body.push({ text: first, no: headerNo });
    }
    while (i < lines.length) {
      const t = clean(lines[i]);
      const no = i + 1;
      if (CLOSE_LINE.test(t)) {
        i++;
        return { body, closed: true, odd: t !== ")", endLine: no };
      }
      if (TOP_LINE.test(t)) {
        const last = [...body].reverse().find((b) => b.text.trim())?.no ?? headerNo;
        fix(last, `${name} had no closing ")", so it ends here`);
        return { body, closed: true, odd: false, endLine: last };
      }
      i++;
      if (inline(lines[i - 1], no)) return { body, closed: true, odd: true, endLine: no };
      body.push({ text: lines[i - 1], no });
    }
    return { body, closed: false, odd: false, endLine: lines.length };
  };

  while (i < lines.length) {
    const lineNo = i + 1;
    const top = topLine(lines[i]);
    const line = top.text;
    i++;

    if (top.kind === "skip") continue;
    if (top.unwrapped) fix(lineNo, "took off the list marker");

    if (top.kind === "divider") {
      actions.push({ id: generateId(), phase: "DIVIDER", time: 0, question: null, preview: "---" });
      continue;
    }

    const group = top.kind === "settings" ? readSettingsLine(line) : null;
    if (group) {
      if (group.changed) fix(lineNo, `read as ${group.canonical}`);
      const before: Partial<QuizSettings> = {};
      (Object.keys(group.opened) as (keyof QuizSettings)[]).forEach((k) => {
        (before as Record<string, unknown>)[k] = current[k];
      });
      groups.push(before);
      setting(group.opened);
      continue;
    }
    if (top.kind === "close") {
      const before = groups.pop();
      if (before) setting(before);
      else err(lineNo, `"}" closes a group that was never opened`);
      continue;
    }

    // ─── Roster("Anna", "Bence") ───
    if (top.kind === "roster") {
      let whole = line;
      if (!maskStrings(whole).includes(")")) {
        // the names went on over the next lines
        for (let k = 0; k < 60 && i < lines.length; k++) {
          const next = clean(lines[i]);
          i++;
          whole += ` ${next}`;
          if (maskStrings(next).includes(")")) {
            fix(lineNo, "read the roster across lines");
            break;
          }
        }
      }
      const roster = readRosterLine(whole);
      if ("error" in roster) err(lineNo, roster.error);
      else if (rosterLine) err(lineNo, `the roster is already on line ${rosterLine}: put everyone in one Roster(...)`);
      else {
        rosterLine = lineNo;
        actions.push(rosterAction(roster));
      }
      continue;
    }
    if (top.kind === "roster-miss") {
      err(lineNo, 'write the roster like this: Roster("Anna", "Bence")');
      continue;
    }

    // ─── NewQuestion Q1 ( ... ) ───
    const header = readHeader(line);
    if (header && "error" in header) {
      err(lineNo, header.error);
      // its block isn't a question, but its lines aren't notes either
      const at = maskStrings(line).indexOf("(");
      if (at >= 0) readBody(line.slice(at + 1).trim(), lineNo, "it");
      continue;
    }
    if (header) {
      const qRef = header.ref;
      let opens = header.opens;
      if (!opens) {
        // the "(" may be on the next line
        let k = i;
        while (k < lines.length && !clean(lines[k])) k++;
        if (k < lines.length && OPEN_LINE.test(clean(lines[k]))) {
          i = k + 1;
          opens = true;
        }
      }
      if (!opens) {
        err(lineNo, S1);
        continue;
      }
      if (!header.canonical) fix(lineNo, `read as NewQuestion ${qRef} (`);
      if (qRefMap.has(qRef)) err(lineNo, `${qRef} is defined twice`);
      const prev = prevQuestions[parseInt(qRef.slice(1), 10) - 1];

      const block = readBody(header.rest, lineNo, qRef);
      if (!block.closed) err(lineNo, `${qRef} is missing its closing ")"`);
      else if (block.odd) fix(block.endLine, `read ")" as the end of ${qRef}`);

      const question: Question = {
        id: prev?.id ?? generateId(),
        text: "",
        imageUrl: prev?.imageUrl ?? "",
        elaborationImageUrl: prev?.elaborationImageUrl,
        userId: prev?.userId,
        type: "PREWRITTEN_SINGLE",
        elaborationText: "",
        answers: [],
      };
      const info: Info = { name: qRef, q: question, header: lineNo, mode: { ask: "pick", score: "right" }, winners: [], fills: [], shuffled: false };
      const options: QuestionOptions = {};
      // what it is: a `type` shorthand, then `ask` and `score` over it
      let ask: Ask | undefined;
      let score: Score | undefined;
      let preset: ReturnType<typeof presetFromScript>;
      // ask: "vote", a shorthand's name where the ask goes
      let askPreset: { name: string; line: number; mode: Mode } | undefined;
      let scoreLine = lineNo;
      let fromText: { value: string; line: number } | undefined;
      let answersRef: { value: string; ref: string | null; line: number } | undefined;
      let picksText: { value: string; line: number } | undefined;
      let overflowText: { value: string; line: number } | undefined;
      let maxLine = lineNo;
      let promptLine = lineNo;
      let elaborationLine = lineNo;
      for (const f of readFields(tokenize(block.body, errors, fix), errors, fix)) {
        const asText = typeof f.value === "string" ? f.value : typeof f.value === "number" ? String(f.value) : undefined;
        switch (f.key) {
          case "prompt":
            question.text = asText ?? "";
            promptLine = f.line;
            break;
          case "elaboration":
            question.elaborationText = asText ?? "";
            elaborationLine = f.line;
            break;
          case "type": {
            preset = asText ? presetFromScript(asText) : undefined;
            if (!preset) err(f.line, `unknown question type "${asText}"`);
            break;
          }
          case "ask": {
            ask = asText ? askFromScript(asText) : undefined;
            if (ask) {
              if (scriptName(asText!) !== ask) fix(f.line, `read ask: "${asText}" as ask: "${ask}"`);
              break;
            }
            const p = asText ? presetFromScript(asText) : undefined;
            if (p) {
              ask = p.mode.ask;
              askPreset = { name: asText!, line: f.line, mode: p.mode };
            } else err(f.line, `ask is one of ${ASKS.map((a) => a.id).join(", ")}, not "${asText}"`);
            break;
          }
          case "score": {
            score = asText ? scoreFromScript(asText) : undefined;
            scoreLine = f.line;
            info.scoreLine = f.line;
            if (!score) err(f.line, `score is one of ${SCORES.map((s) => s.id).join(", ")}, not "${asText}"`);
            else if (scriptName(asText!) !== score) fix(f.line, `read score: "${asText}" as score: "${score}"`);
            break;
          }
          case "time":
            break; // v1: per-step time lives on the Show lines
          case "from":
            fromText = { value: asText ?? "", line: f.line };
            break;
          case "picks":
          case "max-picks":
          case "max_picks":
          case "maxPicks":
            if (f.key !== "picks") fix(f.line, `read ${f.key} as picks`);
            picksText = { value: asText ?? "", line: f.line };
            break;
          case "overflow":
            overflowText = { value: asText ?? "", line: f.line };
            break;
          case "answers": {
            if (typeof f.value === "string") {
              answersRef = { value: f.value, ref: qRefOf(f.value), line: f.line };
              info.answersLine = f.line;
              break;
            }
            if (!Array.isArray(f.value)) {
              err(f.line, "answers is a list: answers: [ { text: \"...\", value: 0 } ]");
              break;
            }
            info.answersLine = f.line;
            question.answers = f.value.map((o, n): Answer => {
              const prevAnswer = prev?.answers?.[n];
              const answer: Answer = {
                id: prevAnswer?.id ?? generateId(),
                text: o.text === undefined ? "" : String(o.text),
                value: typeof o.value === "number" ? Math.round(o.value) : Number(o.value) || 0,
                imageUrl: prevAnswer?.imageUrl,
                userId: prevAnswer?.userId,
              };
              if (o.match !== undefined) answer.match = String(o.match);
              const unknown = Object.keys(o).filter((k) => !["text", "value", "match"].includes(k));
              if (unknown.length) err(f.line, `answers don't have ${unknown.map((k) => `"${k}"`).join(", ")}`);
              return answer;
            });
            break;
          }
          default:
            if ((EXTRA_FIELDS as string[]).includes(f.key) && asText !== undefined) {
              options[f.key as QuestionField] = asText;
              if (f.key === "max") maxLine = f.line;
            } else if (asText !== undefined && qRefOf(asText) && f.key !== "ref") {
              // ref is the quiz's own hidden label, never written: it keeps the plain message
              err(f.line, `unexpected "${f.key}" in ${qRef}. To use an earlier question's answers, write from: "${qRefOf(asText)}"`);
            } else {
              err(f.line, `unexpected "${f.key}" in ${qRef}`);
            }
        }
      }

      // answers: Q1 means from: "Q1"; answers: players on a person question says what it does anyway
      const askSoFar = ask ?? preset?.mode.ask ?? "pick";
      if (answersRef) {
        const people = /^(players|everyone|people)$/i.test(answersRef.value.trim());
        if (askSoFar === "person" && people) {
          fix(answersRef.line, `a person question lists the players itself: left out answers: ${answersRef.value}`);
          info.answersLine = undefined;
        } else if (answersRef.ref) {
          info.answersLine = undefined;
          const fromRef = fromText ? qRefOf(fromText.value) : null;
          if (fromText && fromRef !== answersRef.ref) {
            err(answersRef.line, `answers: "${answersRef.value}" and from: "${fromText.value}" disagree: keep just from`);
          } else if (!fromText) {
            fix(answersRef.line, `read answers: ${answersRef.value} as from: "${answersRef.ref}"`);
            fromText = { value: answersRef.ref, line: answersRef.line };
          }
        } else {
          err(answersRef.line, "answers is a list: answers: [ { text: \"...\", value: 0 } ]");
        }
      }
      if (fromText) {
        const ref = qRefOf(fromText.value);
        if (!ref) err(fromText.line, `from names a question, like from: "Q1"`);
        else {
          if (fromText.value !== ref && fromText.line !== answersRef?.line) fix(fromText.line, `read from: "${fromText.value}" as from: "${ref}"`);
          info.from = ref;
          info.fromLine = fromText.line;
        }
      }

      // what it is
      const askId = askSoFar;
      const scores = askInfo(askId).scores;
      let scoreId: Score;
      if (score) scoreId = score;
      else if (askPreset) {
        scoreId = askPreset.mode.score;
        fix(askPreset.line, `read ask: "${askPreset.name}" as ask: "${askPreset.mode.ask}", score: "${askPreset.mode.score}"`);
      } else if (askId === "pick" && (fromText || answersRef?.ref) && !preset) scoreId = "votes"; // a pick on earlier answers is a vote
      else scoreId = (ask && !preset ? scores[0] : preset?.mode.score) ?? scores[0];
      if (score && askPreset) fix(askPreset.line, `read ask: "${askPreset.name}" as ask: "${askPreset.mode.ask}"`);
      if (!scores.includes(scoreId)) {
        if (score) err(scoreLine, `${askId} can't score ${score}: it takes ${scores.join(", ")}`);
        scoreId = scores[0];
      }
      const mode: Mode = { ask: askId, score: scoreId };
      info.mode = mode;
      question.mode = modeKey(mode);
      question.type = typeIdOf(mode);

      // max: on a vote means picks
      if (askId === "pick" && info.from && options.max !== undefined && !picksText) {
        picksText = { value: options.max, line: maxLine };
        fix(maxLine, "read max as picks");
        delete options.max;
      }
      if (picksText) {
        const n = Number(picksText.value);
        info.picksLine = picksText.line;
        if (picksText.value.trim() === "" || !Number.isFinite(n) || Math.round(n) < 1 || Math.round(n) > PICKS_MOST) {
          err(picksText.line, "picks is how many each player can vote for: a whole number from 1 to 10");
        } else info.picks = Math.round(n);
      }
      if (overflowText) {
        const v = overflowText.value.trim().toLowerCase();
        info.overflowLine = overflowText.line;
        if (["on", "yes", "true"].includes(v)) {
          fix(overflowText.line, `read overflow: "${overflowText.value}" as overflow: 6`);
          info.overflow = 6;
        } else if (["off", "no", "false", "0"].includes(v)) {
          info.overflowLine = undefined;
        } else {
          const n = Number(v);
          if (v === "" || !Number.isFinite(n) || n < 2 || n > 20) err(overflowText.line, 'overflow is the most answers one player sees: a number from 2 to 20, or "off"');
          else info.overflow = Math.round(n);
        }
      }

      // fill-ins, in the prompt and the elaboration
      const canDeal = (askId === "write" || askId === "draw") && !!info.from;
      question.text = readFills(question.text, promptLine, info, canDeal, err, fix);
      question.elaborationText = readFills(question.elaborationText ?? "", elaborationLine, info, canDeal, err, fix);

      const extras = formatOptions(options);
      if (extras) question.options = extras;

      questions.push(question);
      qRefMap.set(qRef, question);
      infos.push(info);
      infoOf.set(question, info);
      continue;
    }

    // ─── ShowQuestion(Q1, time: 30) ───
    const show = readShowLine(line, (ref) => {
      const q = qRefMap.get(ref);
      return q ? modeOf(q).ask : undefined;
    });
    if (show && "error" in show) err(lineNo, show.error);
    else if (show) {
      const { fn, ref: qRef, time } = show;
      const q = qRefMap.get(qRef);
      if (q) {
        if (!show.canonical) fix(lineNo, `read as ${fn}(${qRef}, time: ${time})`);
        const info = infoOf.get(q)!;
        info.first ??= actions.length;
        info.last = actions.length;
        info.shuffled ||= current.shuffle;
        actions.push({
          id: generateId(),
          phase: FN_PHASE_MAP[fn],
          time,
          question: q,
          preview: `${fn.replace("Show", "")}: "${q.text.slice(0, 30)}"`,
        });
        continue;
      }
      err(lineNo, `${qRef} is used before it is defined`);
    }

    actions.push({ id: generateId(), phase: "TEXT", time: 0, question: null, preview: line });
  }
  // a group still open at the end simply lasts to the end

  link(infos, err, (no, t) => warnings.push(`Line ${no}: ${t}`));

  // the roster goes first, wherever it was written
  const r = actions.findIndex((a) => a.phase === "ROSTER");
  if (r > 0) actions.unshift(...actions.splice(r, 1));

  return { questions, actions, errors: byLine(errors), fixed: byLine(fixed), warnings: byLine(warnings), byName: qRefMap };
}

/** "Line n: ..." messages in line order (stable), each once */
function byLine(messages: string[]): string[] {
  const lineOf = (m: string) => Number(m.match(/^Line (\d+):/)?.[1] ?? Infinity);
  return [...new Set(messages)].map((m, k) => ({ m, k, n: lineOf(m) })).sort((a, b) => a.n - b.n || a.k - b.k).map((x) => x.m);
}

/**
 * Reads the fill-ins in one text: each spelling becomes {Q2.winner},
 * {author} or {answer}, quotes hugging one are taken off, and what's used is
 * noted on `info` for the checks once every question is read. Anything else
 * in braces that looks like a fill-in is an error.
 */
function readFills(text: string, line: number, info: Info, canDeal: boolean, err: Fix, fix: Fix): string {
  if (!text) return text;
  if (/\{\s*Q\s*\?\s*\.\s*winner\s*\}/i.test(text)) err(line, "{Q?.winner} points at a question that's gone");
  // [Q2.winner] always means the fill-in; [author] and [answer] only where they can be filled
  let out = text.replace(/\[\s*(Q\s*\d+\s*\.\s*winner|author|answer)\s*\]/gi, (whole, inner: string) => {
    const word = inner.replace(/\s+/g, "");
    if (/^q\d+\.winner$/i.test(word)) {
      const fill = `{Q${Number(word.match(/\d+/)![0])}.winner}`;
      fix(line, `read ${whole} as ${fill}`);
      return fill;
    }
    if (!canDeal) return whole;
    const fill = `{${word.toLowerCase()}}`;
    fix(line, `read ${whole} as ${fill}`);
    return fill;
  });
  out = out.replace(FILL, (whole, inner: string) => {
    const word = inner.replace(/\s+/g, "");
    const [head, tail] = word.split(".");
    let fill: string;
    if (tail !== undefined && /^q\d+$/i.test(head) && WINNER_WORDS.test(tail)) {
      fill = `{Q${Number(head.slice(1))}.winner}`;
      info.winners.push({ name: `Q${Number(head.slice(1))}`, line });
    } else if (tail === undefined && AUTHOR_WORDS.test(word)) {
      fill = "{author}";
      info.fills.push({ kind: "author", line });
    } else if (tail === undefined && ANSWER_WORDS.test(word)) {
      fill = "{answer}";
      info.fills.push({ kind: "answer", line });
    } else {
      err(line, `{${word}} ${P1_TAIL}`);
      return whole;
    }
    if (whole !== fill) fix(line, `read ${whole} as ${fill}`);
    return fill;
  });
  out = out.replace(HUGGED, (whole, open: string, fill: string, close: string) => {
    if (!HUG_PAIRS[open].includes(close)) return whole;
    fix(line, `took the quotes off ${fill}: they're added when it's filled in`);
    return fill;
  });
  return out;
}

/**
 * Once every question is read: what each `from` and {Qn.winner} names,
 * whether that can work (its kind, and the order things play in), the
 * warnings, and the hidden labels the quiz keeps the links by.
 */
function link(infos: Info[], err: Fix, warn: Fix) {
  const byName = new Map(infos.map((x) => [x.name, x]));
  const get = (name: string | undefined) => (name ? byName.get(name) : undefined);
  const shown = (x: Info) => x.first !== undefined;

  // a person question that doesn't say from, but fills in exactly one winner, is about that one
  for (const x of infos) {
    if (x.mode.ask === "person" && x.mode.score === "right" && !x.from && x.fromLine === undefined) {
      const named = [...new Set(x.winners.map((w) => w.name))];
      if (named.length === 1 && get(named[0])) x.from = named[0];
    }
  }

  const sourceOf = (x: Info): Info | undefined => {
    const s = get(x.from);
    return s && s !== x ? s : undefined;
  };
  const makes = (x: Info) => x.mode.ask === "write" || x.mode.ask === "draw";
  const borrows = (x: Info) => x.mode.ask === "pick" && (x.mode.score === "votes" || !!x.from);
  const hasBoard = (x: Info) => makes(x) || borrows(x);
  const hasWinner = (x: Info) => (makes(x) && (x.mode.score === "votes" || x.mode.score === "knockout")) || borrows(x);
  /** whose answers these really are: a pick that borrows is its source's */
  const maker = (x: Info): Info => {
    const seen = new Set<Info>();
    let m = x;
    while (borrows(m) && !seen.has(m)) {
      seen.add(m);
      const s = sourceOf(m);
      if (!s) break;
      m = s;
    }
    return m;
  };
  const drawn = (x: Info) => maker(x).mode.ask === "draw";

  for (const x of infos) {
    const at = x.fromLine ?? x.header;
    const { ask, score } = x.mode;
    if (x.from) {
      const s = get(x.from);
      if (!s) err(at, `from: "${x.from}" names ${x.from}, which isn't defined`);
      else if (s === x) err(at, `${x.name} can't take from itself`);
      else if (!["pick", "write", "draw", "person"].includes(ask)) err(at, `from works on ask "pick", "write", "draw" and "person", not on "${ask}"`);
      else if (ask === "pick") {
        if (score !== "votes" && score !== "none") err(at, 'a pick with from scores "votes" or "none". To guess who wrote one, use ask: "person"');
        else if (!hasBoard(s)) err(at, `${x.name} takes answers from ${s.name}, but nobody writes or draws anything in ${s.name}`);
      } else if (ask === "write" || ask === "draw") {
        if (score === "secret") err(at, 'from doesn\'t mix with score "secret": the secret words already say what to make');
        else if (!hasBoard(s)) err(at, `${x.name} takes answers from ${s.name}, but nobody writes or draws anything in ${s.name}`);
      } else if (score !== "right") err(at, 'from on a person question only works with score "right"');
      else if (!hasWinner(s)) {
        err(at, `${x.name} asks who made ${s.name}'s winner, but ${s.name} has no winner. Point it at a question people vote on (score: "votes") or a knockout`);
      }
    }
    if (ask === "pick" && x.from && x.answersLine !== undefined && x.q.answers.length) {
      err(x.answersLine, `${x.name} takes its options from ${x.from}, so leave out answers`);
    }
    if (ask === "person" && x.answersLine !== undefined && x.q.answers.length) err(x.answersLine, "a person question lists the players itself, so leave out answers");
    if (ask === "pick" && score === "votes" && !x.from) err(x.scoreLine ?? x.header, 'a pick scored by votes needs from: "Q1": its options are what players made there');
    if (ask === "person" && score === "right" && !x.from) err(x.header, 'a person question scored "right" needs from: "Q2": whoever made Q2\'s winner is the right answer');
    if (x.picksLine !== undefined && !((ask === "pick" && x.from) || (makes(x) && score === "votes"))) {
      err(x.picksLine, 'picks only works where people vote: a pick with from, or score: "votes"');
    }
    if (x.overflowLine !== undefined && !(ask === "pick" && x.from)) err(x.overflowLine, "overflow only works on a pick with from");

    // fill-ins
    const s = sourceOf(x);
    for (const f of x.fills) {
      if (!makes(x)) err(f.line, "{author} and {answer} only work on a write or draw question with from");
      else if (!x.from) err(f.line, '{author} and {answer} need from: "Q1" on this question, to know whose answer to use');
      else if (f.kind === "answer" && s && drawn(s)) err(f.line, `${s.name}'s answers are drawings, so there's no {answer} to fill in`);
    }
    for (const w of x.winners) {
      const t = get(w.name);
      if (!t) err(w.line, `{${w.name}.winner} names ${w.name}, which isn't defined`);
      else if (!hasWinner(t)) err(w.line, `{${w.name}.winner} needs ${w.name} to have a winner: a question people vote on (score: "votes") or a knockout`);
      else if (drawn(t)) err(w.line, `${w.name}'s winner is a drawing, so {${w.name}.winner} can't go in the text`);
    }
  }

  // the order things play in: what a question uses is over before it starts
  const order = (user: Info, used: Info, at: number) => {
    if (!shown(user) || used === user) return;
    if (!shown(used)) err(at, `${user.name} uses ${used.name}, but ${used.name} is never shown`);
    else if (used.last! >= user.first!) err(at, `${user.name} uses ${used.name}, so all of ${used.name}'s Show lines must come before ${user.name}'s first one`);
    else if (used.shuffled || user.shuffled) err(at, `${user.name} uses ${used.name}, so neither can be inside a shuffle group`);
  };
  for (const x of infos) {
    const s = sourceOf(x);
    if (s) order(x, s, x.fromLine ?? x.header);
    for (const w of x.winners) {
      const t = get(w.name);
      if (t) order(x, t, w.line);
    }
  }

  // a person question asks who made an answer: nothing may give that away before it's over
  for (const p of infos) {
    if (p.mode.ask !== "person" || p.mode.score !== "right") continue;
    const chain: Info[] = [];
    for (let c = sourceOf(p); c && !chain.includes(c); c = borrows(c) ? sourceOf(c) : undefined) chain.push(c);
    const authors = chain.find((c) => c.mode.score === "authors");
    if (authors) err(p.fromLine ?? p.header, `${authors.name} already shows who wrote what, so ${p.name} has nothing to guess`);
    if (!shown(p)) continue;
    for (const u of infos) {
      const s = sourceOf(u);
      if (!makes(u) || !s || !shown(u)) continue;
      const m = maker(s);
      if (chain.includes(m) && u.first! < p.last!) {
        err(u.fromLine ?? u.header, `${u.name} shows who wrote ${m.name}'s answers, but ${p.name} still asks who wrote one: put ${u.name} after ${p.name}`);
      }
    }
  }

  // things nobody can score on: they don't block, but nobody would want them
  for (const x of infos) {
    const { ask, score } = x.mode;
    if (!shown(x)) warn(x.header, `${x.name} is never shown, so it's left out. Add a line like ShowQuestion(${x.name}, time: 30)`);
    if (ask === "type-in" && x.q.answers.length === 0) warn(x.header, 'type-in needs accepted answers, so nobody can score. For free writing, use ask: "write"');
    if ((ask === "pick" || ask === "pick-many") && score === "right" && !x.from && !x.q.answers.some((a) => a.value > 0)) {
      warn(x.header, "no answer is worth points, so nobody can score: give the right one value: 100");
    }
  }

  // hidden labels: q<k>, k its number as the script is written back (the order of first steps)
  const pointed = new Set<Info>();
  for (const x of infos) {
    const s = sourceOf(x);
    if (s) pointed.add(s);
    for (const w of x.winners) {
      const t = get(w.name);
      if (t) pointed.add(t);
    }
  }
  const numbered = [...infos.filter(shown).sort((a, b) => a.first! - b.first!), ...infos.filter((x) => !shown(x))];
  const label = new Map<Info, string>();
  numbered.forEach((x, k) => {
    if (pointed.has(x)) label.set(x, `q${k + 1}`);
  });
  for (const x of infos) {
    const o = parseOptions(x.q.options);
    const s = sourceOf(x);
    if (s) o.from = label.get(s);
    if (x.picks && x.picks > 1) o.picks = String(x.picks);
    if (x.overflow) o.overflow = String(x.overflow);
    if (label.has(x)) o.ref = label.get(x);
    const winner = (t: string) =>
      t.replace(/\{Q(\d+)\.winner\}/g, (whole, n: string) => {
        const target = get(`Q${Number(n)}`);
        return target && label.has(target) ? `{@${label.get(target)}.winner}` : whole;
      });
    x.q.text = winner(x.q.text);
    if (x.q.elaborationText) x.q.elaborationText = winner(x.q.elaborationText);
    const extras = formatOptions(o);
    if (extras) x.q.options = extras;
    else delete x.q.options;
  }
}

// ─── Roster("Anna", "Bence", unique: off) ─────────────────────────────

const R1 = 'write the roster like this: Roster("Anna", "Bence")';

/** a whole roster line (its names may have come from several lines): the roster, or what's wrong */
function readRosterLine(whole: string): { names: string[]; unique: boolean } | { error: string } {
  const mask = maskStrings(whole);
  const open = mask.indexOf("(");
  const close = mask.indexOf(")");
  if (open < 0 || close < open || !/^[;,]?\s*((#|\/\/).*)?$/.test(whole.slice(close + 1).trim())) return { error: R1 };
  const names: string[] = [];
  let unique = true;
  for (const item of splitArgs(whole.slice(open + 1, close))) {
    if (!item) continue;
    if (CLOSERS[item[0]]) {
      const s = readString(item);
      if (!s || s.len !== item.length) return { error: R1 };
      names.push(s.v.trim().replace(/\s+/g, " "));
      continue;
    }
    const kv = item.match(/^([A-Za-z_][\w-]*)\s*[:=]\s*(.*)$/);
    if (!kv) return { error: R1 };
    if (kv[1].toLowerCase() !== "unique") return { error: `Roster takes names and unique: off, not "${kv[1]}"` };
    const v = kv[2].trim().replace(/^["'“„](.*)["'”“]$/, "$1").trim().toLowerCase();
    if (["on", "true", "yes"].includes(v)) unique = true;
    else if (["off", "false", "no"].includes(v)) unique = false;
    else return { error: "unique is on or off" };
  }
  const problem = rosterProblem(names);
  return problem ? { error: problem } : { names, unique };
}
