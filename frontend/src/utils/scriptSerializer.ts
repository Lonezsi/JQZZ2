import type { Quiz, Action, Question } from "../types";
import { PHASE_FN_MAP } from "../constants/phaseMaps";
import { DEFAULTS, parseSettings } from "./settings";
import type { QuizSettings } from "./settings";

export const EMPTY_SCRIPT = `# New Quiz — JQzz Script v1
# Author: you
#
# ─── How to write a quiz ─────────────────────────────
#
# NewQuestion Q1 (
#   type: "prewritten-single",
#   prompt: "Your question here?",
#   elaboration: "Fun fact about the answer",
#   answers: [
#     { text: "Option A", value: 0   },
#     { text: "Option B", value: 100 },
#   ],
# )
#
# ShowWaiting(Q1, time: 10)
# ShowQuestion(Q1, time: 30)
# ShowAnswers(Q1, time: 15)
# ShowElaboration(Q1, time: 20)
# ShowResult(Q1, time: 10)
#
# Use --- to insert a visual divider.
# Settings group what's inside them, until the closing brace:
#
# shuffle {            questions inside swap places
# mix {                answers come in a random order
# grade=off {          played, but nobody scores
# points=2 {           double points
# }                    back to how it was before the group
#
# Any other line becomes a text note block.
# ─────────────────────────────────────────────────────`;

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

export function quizToScript(quiz: Quiz | undefined): string {
  if (!quiz || quiz.actions.length === 0) return EMPTY_SCRIPT;

  const lines: string[] = [
    `# ${quiz.name} — JQzz Script v1`,
    `# Author: ${quiz.authorId}`,
    "",
  ];

  const uniqueQuestions = getUniqueQuestionsFromActions(quiz.actions);

  // Map question ID to index (starting from 1)
  const qIndexMap = new Map<number, number>();
  uniqueQuestions.forEach((q, idx) => qIndexMap.set(q.id, idx + 1));

  // Write NewQuestion blocks
  uniqueQuestions.forEach((q) => {
    const qid = `Q${qIndexMap.get(q.id)}`;
    lines.push(`NewQuestion ${qid} (`);
    const type = (q.type || "PREWRITTEN_SINGLE").toLowerCase().replace(/_/g, "-");
    const answers = q.answers ?? [];
    lines.push(`  type: ${str(type)},`);
    lines.push(`  prompt: ${str(q.text)},`);
    if (q.elaborationText) lines.push(`  elaboration: ${str(q.elaborationText)},`);
    if (answers.length > 0) {
      lines.push(`  answers: [`);
      answers.forEach((a) =>
        lines.push(`    { text: ${str(a.text)}, value: ${a.value} },`),
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
