import type { Quiz } from "../types";
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

export function quizToScript(quiz: Quiz | undefined): string {
  if (!quiz || quiz.questions.length === 0) return EMPTY_SCRIPT;
  const lines: string[] = [
    `# ${quiz.name} — JQzz Script v1`,
    `# Author: ${quiz.authorId}`,
    "",
  ];
  const qIndexMap = new Map<number, number>();
  quiz.questions.forEach((q, i) => qIndexMap.set(q.id, i + 1));

  quiz.questions.forEach((q, qi) => {
    const qid = `Q${qi + 1}`;
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

  quiz.actions.forEach((a) => {
    if (a.phase === "DIVIDER") {
      lines.push("---");
      lines.push("");
      return;
    }
    if (a.phase === "TEXT") {
      lines.push(a.preview);
      return;
    }
    const fn = PHASE_FN_MAP[a.phase];
    const qi = qIndexMap.get(a.questionId);
    if (fn && qi != null) lines.push(`${fn}(Q${qi}, time: ${a.time})`);
  });

  return lines.join("\n");
}
