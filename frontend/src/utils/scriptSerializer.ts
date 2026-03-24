import type { Quiz, Action, Question } from "../types";
import { PHASE_FN_MAP } from "../constants/phaseMaps";

export const EMPTY_SCRIPT = `# New Quiz — JQzz Script v1
# Author: you
#
# ─── How to write a quiz ─────────────────────────────
#
# NewQuestion Q1 (
#   time: 30,
#   type: "choose-answer",
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
# Any other line becomes a text note block.
# ─────────────────────────────────────────────────────`;

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
    lines.push(`  time: 30,`);
    lines.push(`  type: "${q.type.toLowerCase().replace(/_/g, "-")}",`);
    lines.push(`  prompt: "${q.text || "..."}",`);
    if (q.elaborationText) lines.push(`  elaboration: "${q.elaborationText}",`);
    if (q.answers.length > 0) {
      lines.push(`  answers: [`);
      q.answers.forEach((a) =>
        lines.push(`    { text: "${a.text}", value: ${a.value} },`),
      );
      lines.push(`  ],`);
    }
    lines.push(`)`);
    lines.push("");
  });

  // Write actions
  for (const a of quiz.actions) {
    if (a.phase === "DIVIDER") {
      lines.push("---");
      lines.push("");
      continue;
    }
    if (a.phase === "TEXT") {
      lines.push(a.preview);
      continue;
    }
    const fn = PHASE_FN_MAP[a.phase];
    const qId = a.question?.id;
    if (fn && qId) {
      const qi = qIndexMap.get(qId);
      if (qi) lines.push(`${fn}(Q${qi}, time: ${a.time})`);
    }
  }

  return lines.join("\n");
}
