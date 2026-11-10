import type { Quiz, Action, Question } from "../types";
import { PHASE_FN_MAP } from "../constants/phaseMaps";
import { DEFAULTS, parseSettings } from "./settings";
import type { QuizSettings } from "./settings";
import { modeOf, parseOptions } from "./questionTypes";
import type { OptionKey } from "./questionTypes";
import { readRoster, rosterLine } from "./roster";
import { showRefs, sourceOf } from "./scriptRefs";
import { docsAsText } from "./scriptDocs";

/*
 * The empty quiz's text: the whole manual as comments (scriptDocs.ts), so the
 * explanation is right there in the script, and comments are dropped when the
 * quiz is saved. Its first line and last rule are what the writer and the
 * roster line rely on.
 */
export const EMPTY_SCRIPT = [
  "# New Quiz · JQzz Script v3",
  "# Author: you",
  "#",
  ...docsAsText().split("\n").map((line) => (line ? `# ${line}` : "#")),
  "#",
  "# Delete these comments whenever you like: they're left out when the quiz is saved.",
  "# ─────────────────────────────────────────────────────",
].join("\n");

// JSON string syntax, which the parser reads back (quotes and newlines survive)
const str = (s: string | undefined) => JSON.stringify(s ?? "");

function getUniqueQuestionsFromActions(actions: Action[]): Question[] {
  const seen = new Map<number, boolean>();
  const result: Question[] = [];
  for (const action of actions) {
    const q = action.question;
    if (q && !seen.has(q.id)) {
      seen.set(q.id, true);
      result.push(q);
    }
  }
  return result;
}

/** the extras written in a block, in the order they're stored; from is written first and ref never */
const WRITTEN: OptionKey[] = ["unit", "min", "max", "rounds", "picks", "overflow"];

export function quizToScript(quiz: Quiz | undefined): string {
  if (!quiz || quiz.actions.length === 0) return EMPTY_SCRIPT;

  // who's coming, written right under the title
  const rosterStep = quiz.actions.find((a) => a.phase === "ROSTER");
  const roster = rosterStep ? readRoster(rosterStep.preview) : null;
  const rosterText = roster && roster.names.length > 0 ? rosterLine(roster) : null;
  if (quiz.actions.every((a) => a.phase === "ROSTER")) {
    if (!rosterText) return EMPTY_SCRIPT;
    const [title, ...rest] = EMPTY_SCRIPT.split("\n");
    return [title, "", rosterText, "", ...rest].join("\n");
  }

  const lines: string[] = [
    // no author line: a quiz's author id is its owner's login, and scripts get shared
    `# ${quiz.name} · JQzz Script v3`,
    "",
  ];
  if (rosterText) lines.push(rosterText, "");

  const uniqueQuestions = getUniqueQuestionsFromActions(quiz.actions);

  // Map question ID to index (starting from 1)
  const qIndexMap = new Map<number, number>();
  uniqueQuestions.forEach((q, idx) => qIndexMap.set(q.id, idx + 1));

  // Write NewQuestion blocks
  uniqueQuestions.forEach((q) => {
    const qid = `Q${qIndexMap.get(q.id)}`;
    lines.push(`NewQuestion ${qid} (`);
    const mode = modeOf(q);
    const answers = q.answers ?? [];
    lines.push(`  ask: ${str(mode.ask)}, score: ${str(mode.score)},`);
    // the question it uses, by its number here; a link to one that's gone is left out, and reading it back says what's missing
    const source = sourceOf(quiz.actions, q);
    const sourceNo = source && qIndexMap.get(source.id);
    if (sourceNo) lines.push(`  from: "Q${sourceNo}",`);
    // {@q2.winner} is kept by label; the script says {Q2.winner}
    lines.push(`  prompt: ${str(showRefs(q.text, quiz.actions, q))},`);
    if (q.elaborationText) lines.push(`  elaboration: ${str(showRefs(q.elaborationText, quiz.actions, q))},`);
    // a type's extras, numbers bare and words quoted
    const extras = parseOptions(q.options);
    WRITTEN.filter((k) => extras[k] !== undefined && extras[k] !== "").forEach((k) => {
      const v = extras[k]!;
      lines.push(`  ${k}: ${/^-?\d+(\.\d+)?$/.test(v) ? v : str(v)},`);
    });
    if (answers.length > 0) {
      lines.push(`  answers: [`);
      answers.forEach((a) =>
        lines.push(
          `    { text: ${str(a.text)}${a.match !== undefined && a.match !== null ? `, match: ${str(a.match)}` : ""}, value: ${a.value} },`,
        ),
      );
      lines.push(`  ],`);
    }
    lines.push(`)`);
    lines.push("");
  });

  // Write actions. A setting that undoes the group above it closes it with
  // "}"; any other opens a group. Inside a group, lines are indented.
  const groups: Partial<QuizSettings>[] = [];
  let current: QuizSettings = { ...DEFAULTS };
  const pad = () => "  ".repeat(groups.length);
  const sameAs = (a: Partial<QuizSettings>, b: Partial<QuizSettings>) => {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => a[k as keyof QuizSettings] === b[k as keyof QuizSettings]);
  };
  for (const a of quiz.actions) {
    if (a.phase === "ROSTER") continue; // written under the title
    if (a.phase === "SETTING") {
      const s = parseSettings(a.preview);
      if (groups.length > 0 && sameAs(s, groups[groups.length - 1])) {
        groups.pop();
        lines.push(`${pad()}}`);
      } else {
        const before: Partial<QuizSettings> = {};
        (Object.keys(s) as (keyof QuizSettings)[]).forEach((k) => {
          (before as Record<string, unknown>)[k] = current[k];
        });
        const head = (Object.keys(s) as (keyof QuizSettings)[])
          .map((k) => (k === "points" ? `points=${s.points}` : s[k] ? k : `${k}=off`))
          .join(", ");
        lines.push(`${pad()}${head} {`);
        groups.push(before);
      }
      current = { ...current, ...s };
      continue;
    }
    if (a.phase === "DIVIDER") {
      lines.push("---");
      lines.push("");
      continue;
    }
    if (a.phase === "TEXT") {
      lines.push(`${pad()}${a.preview}`);
      continue;
    }
    const fn = PHASE_FN_MAP[a.phase];
    const qId = a.question?.id;
    if (fn && qId) {
      const qi = qIndexMap.get(qId);
      if (qi) lines.push(`${pad()}${fn}(Q${qi}, time: ${a.time})`);
    }
  }

  return lines.join("\n");
}
