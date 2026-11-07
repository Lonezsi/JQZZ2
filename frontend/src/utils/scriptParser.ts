import type { Question, Action, Answer } from "../types";
import { FN_PHASE_MAP } from "../constants/phaseMaps";
import { generateId } from "./idGenerator";
import { DEFAULTS, formatSettings, parseSettings } from "./settings";
import type { QuizSettings } from "./settings";
import {
  ASKS,
  SCORES,
  askFromScript,
  askInfo,
  formatOptions,
  modeKey,
  modeOf,
  presetFromScript,
  scoreFromScript,
  typeIdOf,
} from "./questionTypes";
import type { Ask, QuestionField, QuestionOptions, Score } from "./questionTypes";

/*
 * Reads a JQzz script (docs/script.md) into questions and timeline steps.
 * The script is the source of truth: whatever it can say, the quiz can be.
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
  const m = line.trim().match(/^(Show\w+)\(\s*(Q\d+)\s*,\s*time:\s*(\d+)\s*\)$/);
  if (!m) return null;
  const [, fn, ref, t] = m;
  if (!FN_PHASE_MAP[fn]) return { error: `unknown function ${fn}` };
  // every step read today says its time; askOf is for the ones that don't
  void askOf;
  return { fn, ref, time: Number(t), defaulted: false, canonical: line.trim() === `${fn}(${ref}, time: ${t})` };
}

/**
 * A question's header, `NewQuestion Q1 (`: its name, whether its block opens
 * on this line (`opens`), and what follows the "(" there (`rest`, the first
 * line of its body). null when the line isn't a header; `error` when it is
 * one that can't be read. `canonical`: written just as the writer writes it.
 */
export function readHeader(line: string): { ref: string; opens: boolean; rest: string; canonical: boolean } | { error: string } | null {
  const m = line.trim().match(/^NewQuestion\s+(Q\d+)\s*\($/);
  if (!m) return null;
  return { ref: m[1], opens: true, rest: "", canonical: line.trim() === `NewQuestion ${m[1]} (` };
}

/** fields a question block can have besides its extras (questionTypes: QuestionField) */
const EXTRA_FIELDS: QuestionField[] = ["unit", "min", "max", "rounds"];

// ─── the inside of a NewQuestion ( ... ) block ─────────────────────────

type Tok =
  | { k: "id" | "str" | "num"; v: string; line: number }
  | { k: "punc"; v: string; line: number };

/** `prompt: "a, b"` -> id prompt, punc :, str "a, b": strings keep their commas and colons */
function tokenize(lines: { text: string; no: number }[], errors: string[]): Tok[] {
  const out: Tok[] = [];
  for (const { text, no } of lines) {
    let s = text;
    while (s.length) {
      const ws = s.match(/^\s+/);
      if (ws) {
        s = s.slice(ws[0].length);
        continue;
      }
      if (s.startsWith("#")) break;
      const str = s.match(/^"(?:[^"\\]|\\.)*"/);
      if (str) {
        let v: string;
        try {
          v = JSON.parse(str[0]);
        } catch {
          v = str[0].slice(1, -1);
        }
        out.push({ k: "str", v, line: no });
        s = s.slice(str[0].length);
        continue;
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
      errors.push(`Line ${no}: can't read "${s.trim()}"`);
      break;
    }
  }
  return out;
}

type Value = string | number;
type Fields = { key: string; value: Value | Record<string, Value>[]; line: number }[];

/** key: value, key: value ... where a value is a string, a number or a [ { ... } ] list */
function readFields(toks: Tok[], errors: string[]): Fields {
  const fields: Fields = [];
  let i = 0;
  const peek = () => toks[i];
  const isPunc = (t: Tok | undefined, v: string) => !!t && t.k === "punc" && t.v === v;
  const skipComma = () => {
    while (isPunc(peek(), ",")) i++;
  };
  const scalar = (t: Tok | undefined): Value | undefined =>
    !t ? undefined : t.k === "str" ? t.v : t.k === "num" ? Number(t.v) : undefined;

  while (i < toks.length) {
    skipComma();
    const key = toks[i];
    if (!key) break;
    if (key.k !== "id" || !isPunc(toks[i + 1], ":")) {
      errors.push(`Line ${key.line}: expected a field like "prompt: ...", found "${key.v}"`);
      // skip to the next line's tokens
      const line = key.line;
      while (i < toks.length && toks[i].line === line) i++;
      continue;
    }
    i += 2;
    if (isPunc(peek(), "[")) {
      i++;
      const list: Record<string, Value>[] = [];
      while (i < toks.length && !isPunc(peek(), "]")) {
        skipComma();
        if (isPunc(peek(), "]")) break;
        if (!isPunc(peek(), "{")) {
          errors.push(`Line ${peek().line}: expected { ... } in ${key.v}`);
          i++;
          continue;
        }
        i++;
        const obj: Record<string, Value> = {};
        while (i < toks.length && !isPunc(peek(), "}")) {
          skipComma();
          const k = toks[i];
          if (!k || isPunc(k, "}")) break;
          const v = scalar(toks[i + 2]);
          if (k.k !== "id" || !isPunc(toks[i + 1], ":") || v === undefined) {
            errors.push(`Line ${k.line}: can't read "${k.v}" in ${key.v}`);
            i++;
            continue;
          }
          obj[k.v] = v;
          i += 3;
        }
        if (isPunc(peek(), "}")) i++;
        list.push(obj);
      }
      if (isPunc(peek(), "]")) i++;
      else errors.push(`Line ${key.line}: ${key.v} is missing its closing "]"`);
      fields.push({ key: key.v, value: list, line: key.line });
      continue;
    }
    const v = scalar(peek());
    if (v === undefined) {
      errors.push(`Line ${key.line}: ${key.v} needs a "string" or a number`);
      i++;
      continue;
    }
    fields.push({ key: key.v, value: v, line: key.line });
    i++;
  }
  return fields;
}

/**
 * Parses a JQzz script. Questions keep the identity (id, images) of the
 * question with the same Q-number in `prevQuestions`, so editing the text
 * doesn't detach anything that isn't represented in the script.
 */
export function parseScript(text: string, prevQuestions: Question[]): ParseResult {
  const lines = text.split(/\r?\n/);
  const questions: Question[] = [];
  const actions: Action[] = [];
  const errors: string[] = [];
  const fixed: string[] = [];
  const warnings: string[] = [];
  const qRefMap = new Map<string, Question>();
  // open `settings {` groups: what each one changed, so `}` can put it back
  const groups: Partial<QuizSettings>[] = [];
  let current: QuizSettings = { ...DEFAULTS };
  const setting = (s: Partial<QuizSettings>) => {
    current = { ...current, ...s };
    actions.push({ id: generateId(), phase: "SETTING", time: 0, question: null, preview: formatSettings(s) });
  };
  let i = 0;

  while (i < lines.length) {
    const lineNo = i + 1;
    const line = lines[i].trim();
    i++;

    if (!line || line.startsWith("#")) continue;

    if (line === "---") {
      actions.push({ id: generateId(), phase: "DIVIDER", time: 0, question: null, preview: "---" });
      continue;
    }

    const groupMatch = line.match(/^(.+?)\s*\{$/);
    const opened = groupMatch ? parseSettings(groupMatch[1]) : {};
    if (groupMatch && Object.keys(opened).length > 0) {
      const before: Partial<QuizSettings> = {};
      (Object.keys(opened) as (keyof QuizSettings)[]).forEach((k) => {
        (before as Record<string, unknown>)[k] = current[k];
      });
      groups.push(before);
      setting(opened);
      continue;
    }
    if (line === "}") {
      const before = groups.pop();
      if (before) setting(before);
      else errors.push(`Line ${lineNo}: "}" closes a group that was never opened`);
      continue;
    }

    const header = readHeader(line);
    if (header && "error" in header) errors.push(`Line ${lineNo}: ${header.error}`);
    else if (header) {
      const qRef = header.ref;
      if (qRefMap.has(qRef)) errors.push(`Line ${lineNo}: ${qRef} is defined twice`);
      const prev = prevQuestions[parseInt(qRef.slice(1), 10) - 1];

      // the block runs to the line that's just ")"
      const body: { text: string; no: number }[] = [];
      let closed = false;
      while (i < lines.length) {
        const fl = lines[i];
        i++;
        if (fl.trim() === ")") {
          closed = true;
          break;
        }
        body.push({ text: fl, no: i });
      }
      if (!closed) errors.push(`Line ${lineNo}: ${qRef} is missing its closing ")"`);

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
      const options: QuestionOptions = {};
      // what it is: a `type` shorthand, then `ask` and `score` over it
      let ask: Ask | undefined;
      let score: Score | undefined;
      let preset: ReturnType<typeof presetFromScript>;
      let scoreLine = lineNo;
      for (const f of readFields(tokenize(body, errors), errors)) {
        const asText = typeof f.value === "string" ? f.value : typeof f.value === "number" ? String(f.value) : undefined;
        switch (f.key) {
          case "prompt":
            question.text = asText ?? "";
            break;
          case "elaboration":
            question.elaborationText = asText ?? "";
            break;
          case "type": {
            preset = asText ? presetFromScript(asText) : undefined;
            if (!preset) errors.push(`Line ${f.line}: unknown question type "${asText}"`);
            break;
          }
          case "ask": {
            ask = asText ? askFromScript(asText) : undefined;
            if (!ask) errors.push(`Line ${f.line}: ask is one of ${ASKS.map((a) => a.id).join(", ")}, not "${asText}"`);
            break;
          }
          case "score": {
            score = asText ? scoreFromScript(asText) : undefined;
            scoreLine = f.line;
            if (!score) errors.push(`Line ${f.line}: score is one of ${SCORES.map((s) => s.id).join(", ")}, not "${asText}"`);
            break;
          }
          case "time":
            break; // v1: per-step time lives on the Show lines
          case "answers": {
            if (!Array.isArray(f.value)) {
              errors.push(`Line ${f.line}: answers is a list: answers: [ { text: "...", value: 0 } ]`);
              break;
            }
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
              if (unknown.length) errors.push(`Line ${f.line}: answers don't have ${unknown.map((k) => `"${k}"`).join(", ")}`);
              return answer;
            });
            break;
          }
          default:
            if ((EXTRA_FIELDS as string[]).includes(f.key) && asText !== undefined) {
              options[f.key as QuestionField] = asText;
            } else {
              errors.push(`Line ${f.line}: unexpected "${f.key}" in ${qRef}`);
            }
        }
      }
      const extras = formatOptions(options);
      if (extras) question.options = extras;

      const askId = ask ?? preset?.mode.ask ?? "pick";
      const scores = askInfo(askId).scores;
      let scoreId = score ?? (ask && !preset ? scores[0] : preset?.mode.score) ?? scores[0];
      if (!scores.includes(scoreId)) {
        if (score) errors.push(`Line ${scoreLine}: ${askId} can't score ${score}: it takes ${scores.join(", ")}`);
        scoreId = scores[0];
      }
      const mode = { ask: askId, score: scoreId };
      question.mode = modeKey(mode);
      question.type = typeIdOf(mode);

      questions.push(question);
      qRefMap.set(qRef, question);
      continue;
    }

    const show = readShowLine(line, (ref) => {
      const q = qRefMap.get(ref);
      return q ? modeOf(q).ask : undefined;
    });
    if (show && "error" in show) errors.push(`Line ${lineNo}: ${show.error}`);
    else if (show) {
      const { fn, ref: qRef, time } = show;
      const q = qRefMap.get(qRef);
      if (q) {
        actions.push({
          id: generateId(),
          phase: FN_PHASE_MAP[fn],
          time,
          question: q,
          preview: `${fn.replace("Show", "")}: "${q.text.slice(0, 30)}"`,
        });
        continue;
      }
      errors.push(`Line ${lineNo}: ${qRef} is used before it is defined`);
    }

    actions.push({ id: generateId(), phase: "TEXT", time: 0, question: null, preview: line });
  }

  // a group still open at the end simply lasts to the end
  return { questions, actions, errors, fixed, warnings };
}
