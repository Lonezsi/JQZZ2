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
 *
 * What a line is (a header, a step, a roster, a note) comes from the parser's
 * own readers (topLine, readHeader, readShowLine), so a hint never says one
 * thing while the parser reads another.
 */
import { closesBlock, opensBlock, readHeader, readScript, readShowLine, rosterGoesOn, startsTop, topLine } from "./scriptParser";
import { FN_PHASE_MAP } from "../constants/phaseMaps";
import { describe as describeSettings, parseSettings } from "./settings";
import { describe, modeOf, overflowOf, parseOptions, picksOf, presetFromScript } from "./questionTypes";
import { readRoster } from "./roster";
import { showRefs } from "./scriptRefs";
import { formatTimecode } from "./timecode";
import { maxPoints } from "./questionInfo";

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

const KEYS = /^(ask|score|type|time|prompt|elaboration|answers|text|value|match|unit|min|max|rounds|from|picks|overflow|unique)(?=\s*[:=])/;

interface Open {
  char: string;
  role: BracketRole;
  phase?: string;
  line: number;
  index: number;
}

const CLOSES: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

/** "Line 7: ..." from the parser, by line: the first for each */
function byLine(messages: string[]): Map<number, string> {
  const out = new Map<number, string>();
  for (const e of messages) {
    const m = e.match(/^Line (\d+): (.*)$/);
    if (m && !out.has(Number(m[1]))) out.set(Number(m[1]), m[2]);
  }
  return out;
}

const shorten = (s: string, n = 34) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** a note that's trying to say who's coming */
const GUESTS = /^(players|expected|guests)\b/i;
/** square brackets an AI writes for a fill-in */
const SQUARE_FILL = /\[(answer|author|x|y|name)\]/i;

/**
 * The script, line by line, as the editor draws it. `caret` is an offset into
 * the text; the bracket next to it and its partner are lit.
 */
export function analyze(text: string, caret: number | null = null): InsightLine[] {
  const lines = text.split("\n");
  const parsed = readScript(text, []);
  const errs = byLine(parsed.errors);
  const fixes = byLine(parsed.fixed);
  const warns = byLine(parsed.warnings);
  const byRef = parsed.byName;
  const askOf = (ref: string) => {
    const q = byRef.get(ref);
    return q ? modeOf(q).ask : undefined;
  };
  // how many steps show each question
  const shows = new Map<number, number>();
  for (const a of parsed.actions) if (a.question) shows.set(a.question.id, (shows.get(a.question.id) ?? 0) + 1);
  const rosterStep = parsed.actions.find((a) => a.phase === "ROSTER");
  const roster = rosterStep ? readRoster(rosterStep.preview) : null;

  const out: InsightLine[] = lines.map(() => ({ pieces: [] }));
  const stack: Open[] = [];
  // the question whose block we're in ("?" for a header that can't be read), its "(", and a header still waiting for its "("
  let inQuestion: string | null = null;
  let questionOpen: Open | null = null;
  let pending: string | null = null;
  let inRoster = false;
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
    const fixHint = () => {
      const f = fixes.get(ln + 1);
      if (f) setHint(f);
    };

    const bracket = (ch: string, role: BracketRole, phase?: string): Piece => {
      const piece: Piece = { v: ch, kind: "bracket", role, phase };
      pieces.push(piece);
      return piece;
    };
    const open = (ch: string, role: BracketRole, phase?: string): Open => {
      bracket(ch, role, phase);
      const o = { char: ch, role, phase, line: ln, index: pieces.length - 1 };
      stack.push(o);
      return o;
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

    /**
     * The line token by token. `first` is what the line's first "(" opens
     * (a question, a step); every other "(" is just a bracket.
     */
    const paint = (first?: { role: BracketRole; phase?: string }): Open | null => {
      let opened: Open | null = null;
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
        if (rest.startsWith("#") || rest.startsWith("//")) {
          pieces.push({ v: rest, kind: "comment" });
          break;
        }
        if (eat(/^"(?:[^"\\]|\\.)*"?/, "str")) continue;
        if (eat(/^[“„][^”“]*[”“]?/, "str")) continue;
        if (eat(/^'[^']*'?/, "str")) continue;
        if (eat(/^-?\d+(?:\.\d+)?/, "num")) continue;
        if (eat(/^(new\s*question|show\s*[a-z]+(?=\s*\()|roster(?=\s*\())/i, "kw")) continue;
        if (eat(/^[Qq]\s*\d+\b/, "ref")) continue;
        if (eat(KEYS, "key")) continue;
        const ch = rest[0];
        if (ch === "(" || ch === "[" || ch === "{") {
          const top = stack[stack.length - 1];
          if (ch === "(") {
            const o = open("(", first && !opened ? first.role : "other", first && !opened ? first.phase : undefined);
            opened ??= o;
          } else if (ch === "[") open("[", "list");
          else open("{", top?.role === "list" ? "answer" : "other");
          rest = rest.slice(1);
          continue;
        }
        if (ch === ")" || ch === "]" || ch === "}") {
          close(ch);
          rest = rest.slice(1);
          continue;
        }
        if (eat(/^[,:=]/, "punc")) continue;
        if (eat(/^[^\s"“„'(),:=[\]{}#]+/, "plain")) continue;
        pieces.push({ v: rest[0], kind: "plain" });
        rest = rest.slice(1);
      }
      return opened;
    };

    /** a question's block is over when its "(" is no longer open */
    const questionClosed = () => !!questionOpen && !stack.includes(questionOpen);
    const enterQuestion = (name: string, o: Open | null) => {
      inQuestion = name;
      questionOpen = o;
      answerIndex = 0;
    };

    if (!trimmed) return;

    // ─── a roster whose names go on over several lines ───
    if (inRoster) {
      paint();
      if (!rosterGoesOn(line)) inRoster = false;
      return;
    }

    // ─── a header's "(" on the line after it ───
    if (pending) {
      const name = pending;
      pending = null;
      if (opensBlock(line)) {
        enterQuestion(name, paint({ role: "question" }));
        return;
      }
    }

    // ─── a block left open ends where the next question or step starts (the parser says so on its last line) ───
    if (inQuestion && startsTop(line)) {
      const at = questionOpen ? stack.indexOf(questionOpen) : -1;
      if (at >= 0) stack.splice(at);
      inQuestion = null;
      questionOpen = null;
    }

    if (inQuestion) {
      if (trimmed.startsWith("#") || trimmed.startsWith("//")) {
        pieces.push({ v: line, kind: "comment" });
        return;
      }
      paint();
      if (questionClosed() || (!questionOpen && closesBlock(line))) {
        const was = inQuestion;
        inQuestion = null;
        questionOpen = null;
        fixHint();
        if (/^\)/.test(trimmed)) setHint(`end of ${was}`);
        return;
      }
      fixHint();
      fieldHint(inQuestion, line, trimmed, setHint);
      return;
    }

    const top = topLine(line);
    switch (top.kind) {
      case "skip":
        pieces.push({ v: line, kind: "comment" });
        return;
      case "divider":
        pieces.push({ v: line, kind: "div" });
        return;
      case "settings": {
        // `speed, points=2 {`, maybe with a comment after it
        const group = line.match(/^(\s*)(.+?)(\s*)\{(.*)$/)!;
        pieces.push({ v: group[1], kind: "ws" }, { v: group[2], kind: "set" }, { v: group[3], kind: "ws" });
        open("{", "group");
        if (group[4]) pieces.push({ v: group[4], kind: "comment" });
        const head = group[2].replace(/([A-Za-z]+)\s*:\s*/g, "$1=");
        groups.push(head.trim());
        fixHint();
        const said = describeSettings(parseSettings(head), true);
        setHint(`from here: ${said.join(", ") || head.trim()}`);
        return;
      }
      case "close": {
        pieces.push({ v: line.slice(0, line.indexOf("}")), kind: "ws" });
        const was = close("}");
        if (line.slice(line.indexOf("}") + 1)) pieces.push({ v: line.slice(line.indexOf("}") + 1), kind: "ws" });
        if (was) setHint(`back to how it was before ${groups.pop() ?? "the group"}`);
        return;
      }
      case "roster": {
        paint();
        if (rosterGoesOn(line)) inRoster = true;
        fixHint();
        if (roster) {
          const n = roster.names.length;
          setHint(`who's coming: ${n} ${n === 1 ? "name" : "names"} · ${roster.unique ? "nobody can pick the same name" : "two people can pick the same name"}`);
        }
        return;
      }
      case "roster-miss":
        pieces.push({ v: line, kind: "note" });
        return;
      case "header": {
        const h = readHeader(top.text);
        const opened = paint({ role: "question" });
        if (!h || "error" in h) {
          // the parser skips its block: so do the hints
          if (opened) enterQuestion("?", opened);
          return;
        }
        if (opened) enterQuestion(h.ref, opened);
        else pending = h.ref;
        if (questionClosed()) {
          inQuestion = null;
          questionOpen = null;
        }
        const warn = warns.get(ln + 1);
        if (warn) setHint(warn, "warn");
        fixHint();
        const q = byRef.get(h.ref);
        if (q) {
          const n = shows.get(q.id) ?? 0;
          const d = describe(modeOf(q));
          setHint(n ? `${d.label} · shown in ${n} ${n === 1 ? "phase" : "phases"}` : `${d.label} · never shown: add a Show line for it`, n ? "info" : "warn");
        }
        return;
      }
      case "step": {
        const show = readShowLine(top.text, askOf);
        const ok = show && !("error" in show) ? show : null;
        paint({ role: "step", phase: ok ? FN_PHASE_MAP[ok.fn] : undefined });
        if (!ok) return;
        const q = byRef.get(ok.ref);
        if (!q) {
          setHint(`${ok.ref} isn't defined above`, "error");
          return;
        }
        const start = clock;
        clock += ok.time;
        const what = q.text ? `“${shorten(showRefs(q.text, parsed.actions, q))}”` : ok.ref;
        setHint(`${formatTimecode(start)} → ${formatTimecode(clock)} · ${what}${ok.defaulted ? ` · no time given: ${ok.time} seconds` : ""}`);
        return;
      }
      case "note":
        // anything else outside a question is a note on the timeline
        pieces.push({ v: line, kind: "note" });
        if (GUESTS.test(top.text)) setHint('a note on the timeline. To say who\'s coming, write Roster("Anna", "Bence")', "warn");
        else setHint("a note on the timeline");
        return;
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

  /** what a field line inside a question does */
  function fieldHint(name: string, line: string, trimmed: string, setHint: (t: string, tone?: HintTone) => void) {
    const q = byRef.get(name);
    if (!q) return;
    const mode = modeOf(q);
    const d = describe(mode);
    const o = parseOptions(q.options);
    const key = trimmed.match(/^["']?([A-Za-z_][\w-]*)["']?\s*[:=]/)?.[1];
    if (/^\s*ask\s*[:=]|,\s*score\s*[:=]|^\s*score\s*[:=]/i.test(line)) {
      setHint(`${d.label}: ${d.blurb}`, "good");
    } else if (key === "type") {
      const said = trimmed.match(/type\s*[:=]\s*["']?([^"',]*)/)?.[1] ?? "";
      const p = presetFromScript(said);
      if (p) setHint(`shorthand for ask: "${p.mode.ask}", score: "${p.mode.score}"`, "good");
    } else if (key === "from" || (key === "answers" && /Q\s*\d/i.test(trimmed) && !trimmed.includes("["))) {
      const ref = trimmed.match(/Q\s*(\d+)/i);
      const source = ref ? `Q${Number(ref[1])}` : null;
      const s = source ? byRef.get(source) : undefined;
      if (!source || !s) return;
      if (mode.ask === "pick") setHint(`options: the answers to ${source}, “${shorten(showRefs(s.text, parsed.actions, s))}”`, "good");
      else if (mode.ask === "write" || mode.ask === "draw") setHint(`each player gets someone else's answer to ${source}`, "good");
      else if (mode.ask === "person") setHint(`right answer: whoever made ${source}'s winner`, "good");
    } else if (key === "picks") {
      setHint(`each player votes for up to ${picksOf(o)}`);
    } else if (key === "overflow") {
      const n = overflowOf(o);
      if (n) setHint(`nobody sees more than ${n} at once. the big screen won't show them`);
    } else if (key === "answers") {
      const n = q.answers.length;
      const max = maxPoints(q);
      const what = d.answers?.text ?? "answer";
      setHint(`${n} ${n === 1 ? what : `${what}s`}${max ? ` · up to ${max} points` : ""}${d.answers ? "" : " · this question doesn't use answers"}`, d.answers ? "info" : "warn");
    } else if (key === "unit" || key === "min" || key === "max") {
      if (mode.ask !== "number") setHint(`only a number question uses ${key}`, "warn");
      else if (o.min !== undefined && o.max !== undefined) setHint(`a slider from ${o.min} to ${o.max}${o.unit ? ` ${o.unit}` : ""}`);
    } else if (key === "rounds") {
      if (mode.ask !== "chain") setHint("only a chain uses rounds", "warn");
      else setHint("turns, the first write included");
    } else if (key === "prompt" || key === "elaboration") {
      const winner = trimmed.match(/\{\s*Q\s*(\d+)\s*\.\s*winner\s*\}/i);
      if (winner) setHint(`fills in Q${Number(winner[1])}'s winning answer`);
      else if (/\{(author|answer)\}/i.test(trimmed)) setHint("each phone gets its own {author} and {answer}");
      else if (SQUARE_FILL.test(trimmed)) {
        const said = trimmed.match(SQUARE_FILL)![0];
        setHint(`players will see ${said} as it is. To fill it in, write {answer} and add from:`, "warn");
      } else if (key === "prompt" && !q.text) setHint("players see this: say what to do", "warn");
    } else if (/^\{/.test(trimmed) && stack.some((s) => s.role === "list")) {
      const a = q.answers[answerIndex++];
      if (!a) return;
      if (mode.ask === "order") setHint(`#${answerIndex} in the right order`);
      else if (mode.score === "secret") setHint("a secret word someone gets");
      else if (mode.score === "right" && (mode.ask === "pick" || mode.ask === "pick-many")) {
        setHint(a.value > 0 ? `right: ${a.value} points` : a.value < 0 ? `costs ${-a.value} points` : "wrong", a.value > 0 ? "good" : "info");
      } else if (mode.ask === "match") setHint(`${a.text || "…"} goes with ${a.match || "…"}`);
    }
  }

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
