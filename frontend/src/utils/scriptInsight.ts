/*
 * What the script editor shows besides the words: colours, brackets coloured
 * by what they open and close, the pair of the bracket at the caret, and a
 * quiet hint at the end of each line saying what that line does.
 *
 * It reads the whole script in one pass. A bracket's colour comes from what
 * it belongs to (a question, a step of a phase, a settings group, the answer
 * list, one answer), and its closing bracket takes the same colour, so a
 * glance down the left edge shows what ends where. A bracket that closes
 * nothing, or the wrong thing, is marked.
 */
import { parseScript } from "./scriptParser";
import { FN_PHASE_MAP } from "../constants/phaseMaps";
import { describe as describeSettings, parseSettings } from "./settings";
import { describe, modeOf, presetFromScript, parseOptions } from "./questionTypes";
import { formatTimecode } from "./timecode";
import { maxPoints } from "./questionInfo";
import type { Question } from "../types";

export type PieceKind = "comment" | "kw" | "ref" | "str" | "num" | "key" | "punc" | "set" | "note" | "div" | "plain" | "ws" | "bracket";
export type BracketRole = "question" | "step" | "group" | "list" | "answer" | "other";

export interface Piece {
  v: string;
  kind: PieceKind;
  /** for brackets: what it opens or closes */
  role?: BracketRole;
  /** for a step's brackets: its phase, which gives its colour */
  phase?: string;
  /** closes nothing, or the wrong thing */
  bad?: boolean;
  /** the bracket at the caret, or its partner */
  lit?: boolean;
}

export type HintTone = "info" | "good" | "warn" | "error";

export interface InsightLine {
  pieces: Piece[];
  hint?: { text: string; tone: HintTone };
}

const KEYS = /^(ask|score|type|time|prompt|elaboration|answers|text|value|match|unit|min|max|rounds)(?=\s*:)/;

interface Open {
  char: string;
  role: BracketRole;
  phase?: string;
  line: number;
  index: number;
}

const CLOSES: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

/** "Line 7: ..." from the parser, by line */
function errorsByLine(errors: string[]): Map<number, string> {
  const out = new Map<number, string>();
  for (const e of errors) {
    const m = e.match(/^Line (\d+): (.*)$/);
    if (m && !out.has(Number(m[1]))) out.set(Number(m[1]), m[2]);
  }
  return out;
}

const shorten = (s: string, n = 34) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * The script, line by line, as the editor draws it. `caret` is an offset into
 * the text; the bracket next to it and its partner are lit.
 */
export function analyze(text: string, caret: number | null = null): InsightLine[] {
  const lines = text.split("\n");
  const { questions, errors } = parseScript(text, []);
  const errs = errorsByLine(errors);

  // which question each Q-name is, and how it's shown
  const byRef = new Map<string, Question>();
  let defined = 0;
  const shows = new Map<string, number>();
  for (const line of lines) {
    const def = line.trim().match(/^NewQuestion\s+(Q\d+)\s*\($/);
    if (def) byRef.set(def[1], questions[defined++]);
    const show = line.trim().match(/^Show\w+\(\s*(Q\d+)/);
    if (show) shows.set(show[1], (shows.get(show[1]) ?? 0) + 1);
  }

  const out: InsightLine[] = lines.map(() => ({ pieces: [] }));
  const stack: Open[] = [];
  let inQuestion: string | null = null;
  let answerIndex = 0;
  let clock = 0;
  const groups: string[] = [];

  lines.forEach((raw, ln) => {
    const line = raw.replace(/\r$/, "");
    const trimmed = line.trim();
    const pieces = out[ln].pieces;
    const setHint = (t: string, tone: HintTone = "info") => {
      if (!out[ln].hint) out[ln].hint = { text: t, tone };
    };
    const err = errs.get(ln + 1);
    if (err) out[ln].hint = { text: err, tone: "error" };

    const bracket = (ch: string, role: BracketRole, phase?: string): Piece => {
      const piece: Piece = { v: ch, kind: "bracket", role, phase };
      pieces.push(piece);
      return piece;
    };
    const open = (ch: string, role: BracketRole, phase?: string) => {
      bracket(ch, role, phase);
      stack.push({ char: ch, role, phase, line: ln, index: pieces.length - 1 });
    };
    const close = (ch: string): Open | null => {
      const top = stack[stack.length - 1];
      if (top && top.char === CLOSES[ch]) {
        stack.pop();
        bracket(ch, top.role, top.phase);
        return top;
      }
      const p = bracket(ch, "other");
      p.bad = true;
      if (!out[ln].hint || out[ln].hint.tone !== "error") {
        out[ln].hint = { text: top ? `this "${ch}" doesn't close the "${top.char}" before it` : `"${ch}" closes nothing`, tone: "error" };
      }
      return null;
    };

    // ─── whole lines that are one thing ───
    if (!trimmed) return;
    if (trimmed.startsWith("#")) {
      pieces.push({ v: line, kind: "comment" });
      return;
    }
    if (trimmed === "---") {
      pieces.push({ v: line, kind: "div" });
      return;
    }

    // a settings group opening: `speed, points=2 {`
    const group = !inQuestion && line.match(/^(\s*)(.+?)(\s*)\{\s*$/);
    if (group && !/^\s*NewQuestion\b/.test(line) && Object.keys(parseSettings(group[2])).length > 0) {
      pieces.push({ v: group[1], kind: "ws" }, { v: group[2], kind: "set" }, { v: group[3], kind: "ws" });
      open("{", "group");
      groups.push(group[2].trim());
      const said = describeSettings(parseSettings(group[2]), true);
      setHint(`from here: ${said.join(", ") || group[2].trim()}`);
      return;
    }
    if (!inQuestion && trimmed === "}") {
      pieces.push({ v: line.slice(0, line.indexOf("}")), kind: "ws" });
      const was = close("}");
      if (was) setHint(`back to how it was before ${groups.pop() ?? "the group"}`);
      return;
    }

    // a question's block opens
    const def = line.match(/^(\s*)(NewQuestion)(\s+)(Q\d+)(\s*)\($/);
    if (def) {
      pieces.push({ v: def[1], kind: "ws" }, { v: def[2], kind: "kw" }, { v: def[3], kind: "ws" }, { v: def[4], kind: "ref" }, { v: def[5], kind: "ws" });
      open("(", "question");
      inQuestion = def[4];
      answerIndex = 0;
      const q = byRef.get(def[4]);
      const n = shows.get(def[4]) ?? 0;
      if (q) {
        const d = describe(modeOf(q));
        setHint(n ? `${d.label} · shown in ${n} ${n === 1 ? "step" : "steps"}` : `${d.label} · never shown: add a Show line for it`, n ? "info" : "warn");
      }
      return;
    }
    if (inQuestion && trimmed === ")") {
      pieces.push({ v: line.slice(0, line.indexOf(")")), kind: "ws" });
      const was = close(")");
      if (was) setHint(`end of ${inQuestion}`);
      inQuestion = null;
      return;
    }

    // a step: ShowQuestion(Q1, time: 20)
    const show = !inQuestion && line.match(/^(\s*)(Show\w+)\(/);
    const phase = show ? FN_PHASE_MAP[show[2]] : undefined;
    if (!inQuestion && !show) {
      // anything else outside a question is a note on the timeline
      pieces.push({ v: line, kind: "note" });
      setHint("a note on the timeline");
      return;
    }

    // ─── the rest goes token by token ───
    let rest = line;
    const eat = (re: RegExp, kind: PieceKind) => {
      const m = rest.match(re);
      if (!m || m.index !== 0) return null;
      pieces.push({ v: m[0], kind });
      rest = rest.slice(m[0].length);
      return m[0];
    };
    while (rest.length) {
      if (eat(/^\s+/, "ws")) continue;
      if (rest.startsWith("#")) {
        pieces.push({ v: rest, kind: "comment" });
        break;
      }
      if (eat(/^"(?:[^"\\]|\\.)*"?/, "str")) continue;
      if (eat(/^-?\d+(?:\.\d+)?/, "num")) continue;
      if (eat(/^(NewQuestion|Show\w+)\b/, "kw")) continue;
      if (eat(/^Q\d+\b/, "ref")) continue;
      if (eat(KEYS, "key")) continue;
      const ch = rest[0];
      if (ch === "(" || ch === "[" || ch === "{") {
        const top = stack[stack.length - 1];
        if (ch === "(") open("(", show ? "step" : "other", phase);
        else if (ch === "[") open("[", "list");
        else open("{", top?.role === "list" ? "answer" : "other");
        rest = rest.slice(1);
        continue;
      }
      if (ch === ")" || ch === "]" || ch === "}") {
        close(ch);
        rest = rest.slice(1);
        continue;
      }
      if (eat(/^[,:]/, "punc")) continue;
      if (eat(/^[^\s"(),:[\]{}#]+/, "plain")) continue;
      pieces.push({ v: rest[0], kind: "plain" });
      rest = rest.slice(1);
    }

    // ─── the hint for this line ───
    if (show) {
      const ref = line.match(/\(\s*(Q\d+)/)?.[1];
      const time = Number(line.match(/time:\s*(\d+)/)?.[1] ?? 0);
      const q = ref ? byRef.get(ref) : undefined;
      if (ref && !q) setHint(`${ref} isn't defined above`, "error");
      else if (!phase) setHint(`${show[2]} isn't a step: ShowWaiting, ShowQuestion, ShowAnswers, ShowElaboration, ShowResult`, "error");
      else {
        const start = clock;
        clock += time;
        const what = q?.text ? `“${shorten(q.text)}”` : ref;
        setHint(`${formatTimecode(start)} → ${formatTimecode(clock)} · ${what}`);
      }
      return;
    }
    const q = inQuestion ? byRef.get(inQuestion) : undefined;
    if (!q) return;
    const mode = modeOf(q);
    const d = describe(mode);
    const key = trimmed.match(/^(\w+)\s*:/)?.[1];
    if (/^\s*ask\s*:|,\s*score\s*:|^\s*score\s*:/.test(line)) {
      setHint(`${d.label}: ${d.blurb}`, "good");
    } else if (key === "type") {
      const name = trimmed.match(/type\s*:\s*"([^"]*)"/)?.[1] ?? "";
      const p = presetFromScript(name);
      if (p) setHint(`shorthand for ask: "${p.mode.ask}", score: "${p.mode.score}"`, "good");
    } else if (key === "answers") {
      const n = q.answers.length;
      const max = maxPoints(q);
      const what = d.answers?.text ?? "answer";
      setHint(`${n} ${n === 1 ? what : `${what}s`}${max ? ` · up to ${max} points` : ""}${d.answers ? "" : " · this question doesn't use answers"}`, d.answers ? "info" : "warn");
    } else if (key === "unit" || key === "min" || key === "max") {
      const o = parseOptions(q.options);
      if (mode.ask !== "number") setHint(`only a number question uses ${key}`, "warn");
      else if (o.min !== undefined && o.max !== undefined) setHint(`a slider from ${o.min} to ${o.max}${o.unit ? ` ${o.unit}` : ""}`);
    } else if (key === "rounds") {
      if (mode.ask !== "chain") setHint("only a chain uses rounds", "warn");
      else setHint("turns, the first write included");
    } else if (key === "prompt" && !q.text) {
      setHint("players see this: say what to do", "warn");
    } else if (/^\{/.test(trimmed) && stack.some((s) => s.role === "list")) {
      const a = q.answers[answerIndex++];
      if (!a) return;
      if (mode.ask === "order") setHint(`#${answerIndex} in the right order`);
      else if (mode.score === "secret") setHint("a secret word someone gets");
      else if (mode.score === "right" && (mode.ask === "pick" || mode.ask === "pick-many")) {
        setHint(a.value > 0 ? `right: ${a.value} points` : a.value < 0 ? `costs ${-a.value} points` : "wrong", a.value > 0 ? "good" : "info");
      } else if (mode.ask === "match") setHint(`${a.text || "…"} goes with ${a.match || "…"}`);
    }
  });

  // what's still open at the end never got closed
  for (const o of stack) {
    const p = out[o.line].pieces[o.index];
    p.bad = true;
    out[o.line].hint = { text: `this "${o.char}" is never closed`, tone: "error" };
  }

  // the bracket at the caret, and its partner
  if (caret !== null) {
    let at = 0;
    for (let ln = 0; ln < lines.length; ln++) {
      const len = lines[ln].length + 1;
      if (caret < at + len) {
        const col = caret - at;
        let x = 0;
        const pieces = out[ln].pieces;
        for (let i = 0; i < pieces.length; i++) {
          const p = pieces[i];
          if (p.kind === "bracket" && (x === col || x + 1 === col)) {
            light(out, ln, i);
            break;
          }
          x += p.v.length;
        }
        break;
      }
      at += len;
    }
  }
  return out;

  // the partner of a bracket: walk the pairs again, cheaply, from the stack history
  function light(all: InsightLine[], ln: number, i: number) {
    const target = all[ln].pieces[i];
    target.lit = true;
    // pair it by counting: forwards for an opener, backwards for a closer
    const openers = "([{";
    const forward = openers.includes(target.v);
    const want = forward ? { "(": ")", "[": "]", "{": "}" }[target.v as "(" | "[" | "{"] : CLOSES[target.v];
    let depth = 0;
    const lineList = forward ? range(ln, all.length) : range(ln, -1);
    for (const l of lineList) {
      const ps = all[l].pieces;
      const idx = forward ? range(l === ln ? i + 1 : 0, ps.length) : range(l === ln ? i - 1 : ps.length - 1, -1);
      for (const j of idx) {
        const p = ps[j];
        if (p.kind !== "bracket") continue;
        if (p.v === target.v) depth++;
        else if (p.v === want) {
          if (depth === 0) {
            p.lit = true;
            return;
          }
          depth--;
        }
      }
    }
  }
}

function range(from: number, to: number): number[] {
  const out: number[] = [];
  if (from <= to) for (let i = from; i < to; i++) out.push(i);
  else for (let i = from; i > to; i--) out.push(i);
  return out;
}
