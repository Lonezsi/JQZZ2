import type { Question, Action, Answer } from "../types";
import { FN_PHASE_MAP } from "../constants/phaseMaps";
import { generateId } from "./idGenerator";

export interface ParseResult {
  questions: Question[];
  actions: Action[];
  errors: string[];
}

/** Question types the backend accepts (QuestionType.java). */
export const QUESTION_TYPES = [
  "PREWRITTEN_SINGLE",
  "PREWRITTEN_MULTIPLE",
  "USER_GENERATED",
  "USER_GENERATED_VOTE",
  "USER_GENERATED_IDENTIFY",
  "TIERLIST",
  "KNOCKOUT_BATTLE",
];

// A double-quoted string with JSON-style escapes, e.g. "say \"hi\""
const STRING = String.raw`"(?:[^"\\]|\\.)*"`;
const ANSWER_RE = new RegExp(
  String.raw`^\{\s*text:\s*(${STRING})\s*,\s*value:\s*(-?\d+)\s*\},?$`,
);

function readString(literal: string): string {
  try {
    return JSON.parse(literal);
  } catch {
    return literal.slice(1, -1);
  }
}

function readField(line: string, key: string): string | undefined {
  const m = line.match(new RegExp(String.raw`^${key}:\s*(${STRING})\s*,?$`));
  return m ? readString(m[1]) : undefined;
}

/**
 * Parses a JQzz script. Questions keep the identity (id, images) of the
 * question with the same Q-number in `prevQuestions`, so editing the text
 * doesn't detach anything that isn't represented in the script.
 */
export function parseScript(
  text: string,
  prevQuestions: Question[],
): ParseResult {
  const lines = text.split(/\r?\n/);
  const questions: Question[] = [];
  const actions: Action[] = [];
  const errors: string[] = [];
  const qRefMap = new Map<string, Question>();
  let i = 0;

  while (i < lines.length) {
    const lineNo = i + 1;
    const line = lines[i].trim();
    i++;

    if (!line || line.startsWith("#")) continue;

    if (line === "---") {
      actions.push({
        id: generateId(),
        phase: "DIVIDER",
        time: 0,
        question: null,
        preview: "---",
      });
      continue;
    }

    const newQMatch = line.match(/^NewQuestion\s+(Q\d+)\s*\($/);
    if (newQMatch) {
      const qRef = newQMatch[1];
      if (qRefMap.has(qRef)) errors.push(`Line ${lineNo}: ${qRef} is defined twice`);
      const prev = prevQuestions[parseInt(qRef.slice(1), 10) - 1];
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

      let closed = false;
      while (i < lines.length) {
        const fieldNo = i + 1;
        const fl = lines[i].trim();
        i++;
        if (fl === ")") {
          closed = true;
          break;
        }
        if (!fl || fl.startsWith("#")) continue;

        const prompt = readField(fl, "prompt");
        if (prompt !== undefined) {
          question.text = prompt;
          continue;
        }
        const type = readField(fl, "type");
        if (type !== undefined) {
          const normalized = type.toUpperCase().replace(/-/g, "_");
          if (QUESTION_TYPES.includes(normalized)) question.type = normalized;
          else errors.push(`Line ${fieldNo}: unknown question type "${type}"`);
          continue;
        }
        const elaboration = readField(fl, "elaboration");
        if (elaboration !== undefined) {
          question.elaborationText = elaboration;
          continue;
        }
        if (/^time:\s*\d+\s*,?$/.test(fl)) continue; // per-action time lives on Show* calls

        if (/^answers:\s*\[$/.test(fl)) {
          const answers: Answer[] = [];
          while (i < lines.length) {
            const answerNo = i + 1;
            const al = lines[i].trim();
            if (al === ")") break; // missing "]": let the question block close
            i++;
            if (/^\],?$/.test(al)) break;
            if (!al || al.startsWith("#")) continue;
            const am = al.match(ANSWER_RE);
            if (!am) {
              errors.push(`Line ${answerNo}: can't read answer ${al}`);
              continue;
            }
            const prevAnswer = prev?.answers?.[answers.length];
            answers.push({
              id: prevAnswer?.id ?? generateId(),
              text: readString(am[1]),
              value: Number(am[2]),
              imageUrl: prevAnswer?.imageUrl,
              userId: prevAnswer?.userId,
            });
          }
          question.answers = answers;
          continue;
        }

        errors.push(`Line ${fieldNo}: unexpected "${fl}" in ${qRef}`);
      }
      if (!closed) errors.push(`Line ${lineNo}: ${qRef} is missing its closing ")"`);

      questions.push(question);
      qRefMap.set(qRef, question);
      continue;
    }

    const showMatch = line.match(/^(Show\w+)\(\s*(Q\d+)\s*,\s*time:\s*(\d+)\s*\)$/);
    if (showMatch) {
      const [, fn, qRef, t] = showMatch;
      const phase = FN_PHASE_MAP[fn];
      const q = qRefMap.get(qRef);
      if (phase && q) {
        actions.push({
          id: generateId(),
          phase,
          time: Number(t),
          question: q,
          preview: `${fn.replace("Show", "")}: "${q.text.slice(0, 30)}"`,
        });
        continue;
      }
      errors.push(
        phase
          ? `Line ${lineNo}: ${qRef} is used before it is defined`
          : `Line ${lineNo}: unknown function ${fn}`,
      );
    }

    actions.push({
      id: generateId(),
      phase: "TEXT",
      time: 0,
      question: null,
      preview: line,
    });
  }

  return { questions, actions, errors };
}
