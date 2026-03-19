import type { Question, Action, Answer } from "../types";
import { FN_PHASE_MAP } from "../constants/phaseMaps";

export interface ParseResult {
  questions: Question[];
  actions: Action[];
  errors: string[];
}

export function parseScript(
  text: string,
  prevQuestions: Question[],
): ParseResult {
  const lines = text.split("\n");
  const questions: Question[] = [];
  const actions: Action[] = [];
  const errors: string[] = [];
  const qRefMap = new Map<string, Question>();
  let aid = Date.now();
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    i++;

    if (!line || line.startsWith("#")) continue;

    if (line === "---") {
      actions.push({
        id: aid++,
        phase: "DIVIDER",
        time: 0,
        questionId: 0,
        preview: "---",
      });
      continue;
    }

    const newQMatch = line.match(/^NewQuestion\s+(Q\d+)\s*\(/);
    if (newQMatch) {
      const qRef = newQMatch[1];
      const qIdx = parseInt(qRef.slice(1), 10) - 1;
      const prev = prevQuestions[qIdx];
      const question: Question = prev
        ? { ...prev, answers: [...prev.answers] }
        : {
            id: Date.now() + questions.length * 7,
            text: "",
            imageUrl: "",
            type: "PREWRITTEN_SINGLE",
            elaborationText: "",
            answers: [],
          };

      while (i < lines.length && lines[i].trim() !== ")") {
        const fl = lines[i].trim();
        i++;
        const promptM = fl.match(/^prompt:\s*"(.*)"/);
        if (promptM) question.text = promptM[1];
        const typeM = fl.match(/^type:\s*"(.*)"/);
        if (typeM) question.type = typeM[1].toUpperCase().replace(/-/g, "_");
        const elabM = fl.match(/^elaboration:\s*"(.*)"/);
        if (elabM) question.elaborationText = elabM[1];

        if (fl === "answers: [") {
          const ans: Answer[] = [];
          while (i < lines.length && lines[i].trim() !== "],") {
            const al = lines[i].trim();
            i++;
            const am = al.match(
              /\{\s*text:\s*"([^"]*)",\s*value:\s*(-?\d+)\s*\}/,
            );
            if (am)
              ans.push({
                id: Date.now() + ans.length * 3,
                text: am[1],
                value: Number(am[2]),
              });
          }
          if (lines[i]?.trim() === "],") i++;
          question.answers = ans;
        }
      }
      if (i < lines.length && lines[i].trim() === ")") i++;

      questions.push(question);
      qRefMap.set(qRef, question);
      continue;
    }

    const showMatch = line.match(/^(Show\w+)\((Q\d+),\s*time:\s*(\d+)\)/);
    if (showMatch) {
      const [, fn, qRef, t] = showMatch;
      const phase = FN_PHASE_MAP[fn];
      const q = qRefMap.get(qRef);
      if (phase && q) {
        actions.push({
          id: aid++,
          phase,
          time: Number(t),
          questionId: q.id,
          preview: `${fn.replace("Show", "")}: "${q.text.slice(0, 30)}"`,
        });
      } else {
        errors.push(`Unknown ref ${qRef} in "${line}"`);
        actions.push({
          id: aid++,
          phase: "TEXT",
          time: 0,
          questionId: 0,
          preview: line,
        });
      }
      continue;
    }

    actions.push({
      id: aid++,
      phase: "TEXT",
      time: 0,
      questionId: 0,
      preview: line,
    });
  }

  return { questions, actions, errors };
}
