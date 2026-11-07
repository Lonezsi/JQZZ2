import type { Action, Question } from "../types";
import { borrows, formatOptions, modeKey, modeOf, parseOptions, typeIdOf } from "./questionTypes";
import type { Mode } from "./questionTypes";
import { settingsAt } from "./settings";

/*
 * Links between questions (docs/script.md, "Using an earlier question"). The
 * script calls questions Q1, Q2 by where they stand, but a quiz keeps hidden
 * labels instead: the question something uses has `ref=q1` in its extras, the
 * one using it `from=q1`, and a prompt says {@q1.winner}. Labels stay put when
 * questions move, so a link never ends up pointing at the wrong one.
 */

/** a stored fill-in for an earlier question's winner, {@q2.winner} */
const STORED_WINNER = /\{@([a-z0-9-]+)\.winner\}/g;
/** the script's way to say it, {Q2.winner} */
const SCRIPT_WINNER = /\{\s*Q\s*(\d+)\s*\.\s*winner\s*\}/gi;

/** its hidden label, when something uses it */
export const refOf = (q: Question): string | undefined => parseOptions(q.options).ref || undefined;
/** the label of the question it uses */
const fromOf = (q: Question): string | undefined => parseOptions(q.options).from || undefined;

/** each question once, in the order the script writes them (first appearance among the steps) */
function questionsOf(actions: Action[]): Question[] {
  const seen = new Set<number>();
  const out: Question[] = [];
  for (const a of actions) {
    if (a.question && !seen.has(a.question.id)) {
      seen.add(a.question.id);
      out.push(a.question);
    }
  }
  return out;
}

/** question id -> its number as the script writes it (first appearance among actions) */
export function questionNumbers(actions: Action[]): Map<number, number> {
  return new Map(questionsOf(actions).map((q, i) => [q.id, i + 1]));
}

/**
 * The question a label points at, seen from `user`: the nearest one before it
 * with that label, else the first one with it anywhere, never `user` itself.
 */
export function resolveRef(actions: Action[], label: string, user?: Question): Question | null {
  if (!label) return null;
  const qs = questionsOf(actions);
  const at = user ? qs.findIndex((q) => q.id === user.id) : -1;
  for (let j = at - 1; j >= 0; j--) if (refOf(qs[j]) === label) return qs[j];
  return qs.find((q) => refOf(q) === label && q.id !== user?.id) ?? null;
}

/** the question q takes from, or null when it takes from none (or that one's gone) */
export function sourceOf(actions: Action[], q: Question): Question | null {
  const from = fromOf(q);
  return from ? resolveRef(actions, from, q) : null;
}

const makes = (m: Mode) => m.ask === "write" || m.ask === "draw";
/** has answers to vote on or hand out: written or drawn there, or borrowed from further back */
const hasBoard = (q: Question) => makes(modeOf(q)) || borrows(modeOf(q), parseOptions(q.options));
/** ends up with a winner: people vote on it, or it's a knockout */
const hasWinner = (q: Question) => {
  const m = modeOf(q);
  return (makes(m) && (m.score === "votes" || m.score === "knockout")) || borrows(m, parseOptions(q.options));
};

/** what q can take from, by its mode; null when it can't take from anything */
function wants(q: Question): ((s: Question) => boolean) | null {
  const m = modeOf(q);
  // a pick scored right or crowd becomes a vote when it's linked (linkTo)
  if (m.ask === "pick") return hasBoard;
  if (makes(m) && m.score !== "secret") return hasBoard;
  if (m.ask === "person" && m.score === "right") return hasWinner;
  return null;
}

/** earlier questions q can take from for its mode (1.3 kinds), with their numbers */
export function sourcesFor(actions: Action[], q: Question): { question: Question; n: number }[] {
  const want = wants(q);
  if (!want) return [];
  // each question's first and last step, and whether any of its steps is shuffled
  const settings = settingsAt(actions);
  const places = new Map<number, { first: number; last: number; shuffled: boolean }>();
  actions.forEach((a, i) => {
    if (!a.question) return;
    const shuffled = !!settings.get(a.id)?.shuffle;
    const p = places.get(a.question.id);
    if (p) {
      p.last = i;
      p.shuffled = p.shuffled || shuffled;
    } else places.set(a.question.id, { first: i, last: i, shuffled });
  });
  const mine = places.get(q.id);
  if (mine?.shuffled) return [];
  const numbers = questionNumbers(actions);
  return questionsOf(actions)
    .filter((s) => {
      const p = places.get(s.id)!;
      // all of its steps before this one's first, and neither in a shuffle group
      return s.id !== q.id && want(s) && !p.shuffled && (!mine || p.last < mine.first);
    })
    .map((s) => ({ question: s, n: numbers.get(s.id)! }));
}

/** base, or base with b, c... after it when that's taken */
function freeLabel(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let k = 1; ; k++) {
    const label = base + (k < 26 ? String.fromCharCode(97 + k) : `-${k}`);
    if (!taken.has(label)) return label;
  }
}

const labelsIn = (qs: Question[]) => new Set(qs.map(refOf).filter((l): l is string => !!l));

/** the patch that gives q a new label */
const labelPatch = (q: Question, ref: string) => ({ id: q.id, patch: { options: formatOptions({ ...parseOptions(q.options), ref }) } });

/**
 * Patches that point `user` at `source` (null: unlink). The source gets a free
 * label if it has none; a pick scored right or crowd becomes pick + votes.
 */
export function linkTo(actions: Action[], user: Question, source: Question | null): { id: number; patch: Partial<Question> }[] {
  const o = parseOptions(user.options);
  if (!source) {
    delete o.from;
    return [{ id: user.id, patch: { options: formatOptions(o) || undefined } }];
  }
  const patches: { id: number; patch: Partial<Question> }[] = [];
  let label = refOf(source);
  if (!label) {
    const n = questionNumbers(actions).get(source.id) ?? questionsOf(actions).length + 1;
    label = freeLabel(`q${n}`, labelsIn(questionsOf(actions)));
    patches.push(labelPatch(source, label));
  }
  const patch: Partial<Question> = { options: formatOptions({ ...o, from: label }) };
  const m = modeOf(user);
  if (m.ask === "pick" && (m.score === "right" || m.score === "crowd")) {
    const vote: Mode = { ask: "pick", score: "votes" };
    patch.mode = modeKey(vote);
    patch.type = typeIdOf(vote);
  }
  patches.push({ id: user.id, patch });
  return patches;
}

/** stored -> script form: {@q2.winner} -> {Q2.winner}; "{Q?.winner}" when it's gone */
export function showRefs(text: string, actions: Action[], user?: Question): string {
  const numbers = questionNumbers(actions);
  return text.replace(STORED_WINNER, (_, label: string) => {
    const q = resolveRef(actions, label, user);
    return `{Q${(q && numbers.get(q.id)) ?? "?"}.winner}`;
  });
}

/**
 * Script form -> stored, labelling Qn if it needs one. error: "Q9 isn't a
 * question here", or the text's own question (`user`) naming itself.
 */
export function storeRefs(
  text: string,
  actions: Action[],
  user?: Question,
): { text: string; patches: { id: number; patch: Partial<Question> }[]; error?: string } {
  const qs = questionsOf(actions);
  const taken = labelsIn(qs);
  const given = new Map<number, string>();
  const patches: { id: number; patch: Partial<Question> }[] = [];
  let error: string | undefined;
  const stored = text.replace(SCRIPT_WINNER, (whole, num: string) => {
    const n = Number(num);
    const q = qs[n - 1];
    if (!q || q.id === user?.id) {
      error ??= q ? `Q${n} is this question: it has no winner yet` : `Q${n} isn't a question here`;
      return whole;
    }
    let label = refOf(q) ?? given.get(q.id);
    if (!label) {
      label = freeLabel(`q${n}`, taken);
      taken.add(label);
      given.set(q.id, label);
      patches.push(labelPatch(q, label));
    }
    return `{@${label}.winner}`;
  });
  return error ? { text: stored, patches, error } : { text: stored, patches };
}

/** without the quiz: {@x.winner} -> "[the winning answer]", {author} -> "[someone]", {answer} -> "[what they wrote]" */
export function plainRefs(text: string): string {
  return text
    .replace(STORED_WINNER, "[the winning answer]")
    .replace(/\{author\}/gi, "[someone]")
    .replace(/\{answer\}/gi, "[what they wrote]");
}

/**
 * Steps dropped into a quiz: their labels that clash with `existing`, or that
 * they use but don't define, renamed so they can't link across.
 */
export function freshRefs(added: Action[], existing: Action[]): Action[] {
  const outside = labelsIn(questionsOf(existing));
  const qs = questionsOf(added);
  const defined = labelsIn(qs);
  const used = new Set<string>();
  for (const q of qs) {
    const from = fromOf(q);
    if (from) used.add(from);
    for (const t of [q.text, q.elaborationText ?? ""]) for (const m of t.matchAll(STORED_WINNER)) used.add(m[1]);
  }
  const taken = new Set([...outside, ...defined, ...used]);
  const rename = new Map<string, string>();
  const renameTo = (label: string) => {
    const fresh = freeLabel(label, taken);
    taken.add(fresh);
    rename.set(label, fresh);
  };
  for (const l of defined) if (outside.has(l)) renameTo(l);
  for (const l of used) if (!defined.has(l) && !rename.has(l)) renameTo(l);
  if (!rename.size) return added;

  const swap = (label: string) => rename.get(label) ?? label;
  const swapText = (t: string) => t.replace(STORED_WINNER, (_, l: string) => `{@${swap(l)}.winner}`);
  const renamed = new Map<number, Question>();
  for (const q of qs) {
    const o = parseOptions(q.options);
    const ref = o.ref && swap(o.ref);
    const from = o.from && swap(o.from);
    const text = swapText(q.text);
    const elaborationText = q.elaborationText && swapText(q.elaborationText);
    if (ref === o.ref && from === o.from && text === q.text && elaborationText === q.elaborationText) continue;
    renamed.set(q.id, { ...q, text, elaborationText, options: formatOptions({ ...o, ref, from }) || undefined });
  }
  return added.map((a) => (a.question && renamed.has(a.question.id) ? { ...a, question: renamed.get(a.question.id)! } : a));
}
