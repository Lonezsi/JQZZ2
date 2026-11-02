/*
 * Checks for the script language: `npm run check:script`. The script is the
 * source of truth, so what it reads it must write back the same way.
 */
import { parseScript } from "./scriptParser";
import { quizToScript } from "./scriptSerializer";
import { parseOptions } from "./questionTypes";
import { parseSettings } from "./settings";
import type { Action, Question } from "../types";

let failed = 0;
let passed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++;
    return;
  }
  failed++;
  console.error(`✗ ${name}`, detail ?? "");
}

const quizOf = (actions: Action[]) => ({ id: 1, name: "Check", authorId: "me", actions });

/** what matters about a parse, without the ids it makes up */
function shape(questions: Question[], actions: Action[]) {
  return {
    questions: questions.map((q) => ({
      type: q.type,
      text: q.text,
      elaboration: q.elaborationText || "",
      options: q.options ?? "",
      answers: q.answers.map((a) => [a.text, a.value, a.match ?? null]),
    })),
    steps: actions.map((a) => (a.question ? `${a.phase}:${a.time}:${a.question.text}` : `${a.phase}:${a.preview}`)),
  };
}

function roundTrip(name: string, script: string) {
  const first = parseScript(script, []);
  check(`${name}: reads without errors`, first.errors.length === 0, first.errors);
  const written = quizToScript(quizOf(first.actions));
  const second = parseScript(written, []);
  check(`${name}: what it writes reads back without errors`, second.errors.length === 0, second.errors);
  const a = JSON.stringify(shape(first.questions, first.actions));
  const b = JSON.stringify(shape(second.questions, second.actions));
  check(`${name}: reads back the same`, a === b, { first: a, second: b, written });
  return first;
}

// ─── v1 still reads ────────────────────────────────────────────────────
const v1 = roundTrip(
  "v1 script",
  `# Old · JQzz Script v1
NewQuestion Q1 (
  type: "prewritten-single",
  prompt: "Capital of France?",
  elaboration: "Paris",
  answers: [
    { text: "Paris", value: 100 },
    { text: "Rome", value: 0 },
  ],
)
NewQuestion Q2 (
  type: "user-generated-vote",
  prompt: "Worst pizza topping?",
)
shuffle, points=2 {
  ShowQuestion(Q1, time: 20)
  ShowAnswers(Q1, time: 10)
}
---
ShowQuestion(Q2, time: 40)
ShowAnswers(Q2, time: 20)
a note`,
);
check("v1: old type names map", v1.questions.map((q) => q.type).join() === "PREWRITTEN_SINGLE,USER_GENERATED_VOTE");
check("v1: settings group opens and closes", v1.actions.filter((a) => a.phase === "SETTING").length === 2);

// ─── every new type ────────────────────────────────────────────────────
const v2 = roundTrip(
  "v2 types",
  `NewQuestion Q1 (
  type: "typed",
  prompt: "Spell the capital of Iceland",
  answers: [ { text: "Reykjavik", value: 100 }, { text: "Reykjavík", value: 100 } ],
)
NewQuestion Q2 (
  type: "order",
  prompt: "Oldest first",
  answers: [
    { text: "Pyramids", value: 50 },
    { text: "Colosseum", value: 50 },
    { text: "Eiffel Tower", value: 50 },
  ],
)
NewQuestion Q3 (
  type: "number",
  prompt: "How tall is Everest?",
  unit: "m", min: 0, max: 10000,
  answers: [ { text: "8849", value: 1000 } ],
)
NewQuestion Q4 (
  type: "match",
  prompt: "Element to symbol",
  answers: [
    { text: "Gold", match: "Au", value: 100 },
    { text: "Iron", match: "Fe", value: 100 },
  ],
)
NewQuestion Q5 (
  type: "poll",
  prompt: "Cats or dogs?",
  answers: [ { text: "Cats", value: 100 }, { text: "Dogs", value: 100 } ],
)
NewQuestion Q6 (
  type: "draw-guess",
  prompt: "Draw your secret word",
  answers: [ { text: "lighthouse", value: 100 }, { text: "volcano", value: 100 } ],
)
NewQuestion Q7 (
  type: "telephone",
  prompt: "Write something strange",
  rounds: 4,
)
NewQuestion Q8 (
  type: "draw-vote",
  prompt: "Draw a cat in a hurry",
)
NewQuestion Q9 (
  type: "draw-knockout",
  prompt: "Draw a monster",
)
NewQuestion Q10 (
  type: "draw",
  prompt: "Draw your mood",
)
speed {
  ShowQuestion(Q1, time: 20)
  ShowQuestion(Q2, time: 30)
  ShowQuestion(Q3, time: 20)
  ShowQuestion(Q4, time: 30)
}
ShowQuestion(Q5, time: 15)
ShowQuestion(Q6, time: 60)
ShowAnswers(Q6, time: 40)
ShowQuestion(Q7, time: 240)
ShowAnswers(Q7, time: 60)
ShowQuestion(Q8, time: 60)
ShowAnswers(Q8, time: 20)
ShowQuestion(Q9, time: 60)
ShowAnswers(Q9, time: 40)
ShowQuestion(Q10, time: 60)`,
);
const types = v2.questions.map((q) => q.type).join();
check(
  "v2: every type reads",
  types === "TYPED,ORDER,NUMBER,MATCH,POLL,DRAW_GUESS,TELEPHONE,DRAW_VOTE,DRAW_BATTLE,DRAW",
  types,
);
const num = parseOptions(v2.questions[2].options);
check("number: unit, min and max", num.unit === "m" && num.min === "0" && num.max === "10000", num);
check("match: pairs keep their other half", v2.questions[3].answers.map((a) => a.match).join() === "Au,Fe");
check("telephone: rounds", parseOptions(v2.questions[6].options).rounds === "4");
check("typed: accents survive", v2.questions[0].answers[1].text === "Reykjavík");
check("speed: a setting", parseSettings(v2.actions[0].preview).speed === true, v2.actions[0].preview);

// ─── friendly writing ─────────────────────────────────────────────────
const written = quizToScript(quizOf(v1.actions));
check("writes the friendly names", written.includes('type: "single"') && written.includes('type: "write-vote"'), written);
const extras = quizToScript(quizOf(v2.actions));
check("writes numbers bare and words quoted", extras.includes('unit: "m"') && extras.includes("max: 10000"), extras);
check("writes the match key", extras.includes('match: "Au"'), extras);

// ─── what it says when something's wrong ──────────────────────────────
const bad = parseScript(
  `NewQuestion Q1 (
  type: "nonsense",
  prompt: "x",
  colour: "blue",
  answers: [ { text: "a", weight: 3 } ],
`,
  [],
);
const said = bad.errors.join(" | ");
check("unknown type is named", said.includes('unknown question type "nonsense"'), said);
check("unknown field is named", said.includes('unexpected "colour"'), said);
check("unknown answer key is named", said.includes('"weight"'), said);
check("missing ) is caught", said.includes('missing its closing ")"'), said);

const quoted = parseScript(`NewQuestion Q1 (\n  prompt: "a, b: \\"c\\"",\n)\nShowQuestion(Q1, time: 5)`, []);
check("strings keep commas, colons and quotes", quoted.questions[0]?.text === 'a, b: "c"', quoted.questions[0]?.text);

console.log(`${passed} passed, ${failed} failed`);
// a failure fails the run (scripts/check-script.mjs runs this under Node)
if (failed) throw new Error(`${failed} script check${failed > 1 ? "s" : ""} failed`);
