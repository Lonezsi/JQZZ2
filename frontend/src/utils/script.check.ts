/*
 * Checks for the script language: `npm run check:script`. The script is the
 * source of truth, so what it reads it must write back the same way.
 */
import { parseScript } from "./scriptParser";
import { quizToScript } from "./scriptSerializer";
import { ASKS, SCORES, modeOf, parseOptions } from "./questionTypes";
import { GAME_MODES } from "../modes";
import { parseSettings } from "./settings";
import { analyze } from "./scriptInsight";
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
      mode: q.mode,
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
check("v1: and say what they are", v1.questions.map((q) => q.mode).join() === "pick/right,write/votes", v1.questions.map((q) => q.mode));
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
check("writes ask and score", written.includes('ask: "pick", score: "right"') && written.includes('ask: "write", score: "votes"'), written);
const extras = quizToScript(quizOf(v2.actions));
check("writes numbers bare and words quoted", extras.includes('unit: "m"') && extras.includes("max: 10000"), extras);
check("writes the match key", extras.includes('match: "Au"'), extras);

// ─── v3: any pair an ask takes ─────────────────────────────────────────
const v3 = roundTrip(
  "v3 pairs",
  `NewQuestion Q1 (
  ask: "draw", score: "authors",
  prompt: "Draw your pet",
)
NewQuestion Q2 (
  ask: "write", score: "secret",
  prompt: "Describe it without saying it",
  answers: [ { text: "volcano", value: 100 } ],
)
NewQuestion Q3 (
  ask: "number", score: "crowd",
  prompt: "How many hours of sleep is enough?",
  min: 0, max: 14,
)
NewQuestion Q4 (
  ask: "pick", score: "none",
  prompt: "Tea or coffee?",
  answers: [ { text: "Tea", value: 0 }, { text: "Coffee", value: 0 } ],
)
NewQuestion Q5 (
  type: "draw-vote",
  score: "knockout",
  prompt: "a shorthand, with its score changed",
)
NewQuestion Q6 (
  ask: "rank",
  prompt: "no score said: the first it takes",
)
ShowQuestion(Q1, time: 60)
ShowQuestion(Q2, time: 60)
ShowQuestion(Q3, time: 20)
ShowQuestion(Q4, time: 10)
ShowQuestion(Q5, time: 60)
ShowQuestion(Q6, time: 60)`,
);
const modes = v3.questions.map((q) => q.mode).join();
check("v3: every pair reads", modes === "draw/authors,write/secret,number/crowd,pick/none,draw/knockout,rank/crowd", modes);
check("v3: a pair without a preset keeps the nearest stored type", v3.questions[0].type === "DRAW", v3.questions[0].type);
check("v3: a pair with one gets it", v3.questions[4].type === "DRAW_BATTLE", v3.questions[4].type);
check("v3: modeOf reads it back", modeOf(v3.questions[1]).score === "secret");

const wrongPair = parseScript(`NewQuestion Q1 (
  ask: "draw", score: "right",
  prompt: "x",
)`, []);
check("a pair the ask can't take is named", wrongPair.errors.join().includes("draw can't score right"), wrongPair.errors);
const wrongAsk = parseScript(`NewQuestion Q1 (
  ask: "dance",
)`, []);
check("an unknown ask lists the right ones", wrongAsk.errors.join().includes("ask is one of pick"), wrongAsk.errors);

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

// ─── the game modes: every one reads cleanly and comes back the same ───
for (const mode of GAME_MODES) {
  roundTrip(`mode ${mode.id}`, mode.script);
  check(`mode ${mode.id}: has a name, an about and a player count`, !!mode.name && !!mode.about && !!mode.players, mode);
  check(`mode ${mode.id}: has questions`, mode.questions > 0);
}
const asks = new Set(GAME_MODES.flatMap((m) => m.modes.map((x) => x.ask)));
const scores = new Set(GAME_MODES.flatMap((m) => m.modes.map((x) => x.score)));
// "person" comes with the yesterday mode, which needs from: to read; until that mode is in, it's the one ask no mode uses
if (!GAME_MODES.some((m) => m.id === "yesterday")) asks.add("person");
check("the modes use every ask", ASKS.every((a) => asks.has(a.id)), ASKS.filter((a) => !asks.has(a.id)).map((a) => a.id));
check("the modes use every score", SCORES.every((x) => scores.has(x.id)), SCORES.filter((x) => !scores.has(x.id)).map((x) => x.id));

// ─── the editor's colours and hints (scriptInsight) ───────────────────
{
  const script = `NewQuestion Q1 (
  type: "poll",
  prompt: "Cats or dogs?",
  answers: [
    { text: "Cats", value: 100 },
  ],
)
speed {
  ShowQuestion(Q1, time: 20)
}
ShowAnswers(Q1, time: 10)`;
  const lines = analyze(script);
  const brackets = (ln: number) => lines[ln].pieces.filter((p) => p.kind === "bracket");
  check("insight: a question's brackets", brackets(0)[0]?.role === "question" && brackets(6)[0]?.role === "question");
  check("insight: the answer list and an answer", brackets(3)[0]?.role === "list" && brackets(4).every((p) => p.role === "answer") && brackets(5)[0]?.role === "list");
  check("insight: a step's brackets carry its phase", brackets(8).every((p) => p.role === "step" && p.phase === "QUESTION"), brackets(8));
  check("insight: a settings group closes in its colour", brackets(7)[0]?.role === "group" && brackets(9)[0]?.role === "group");
  check("insight: a shorthand says what it stands for", lines[1].hint?.text.includes('ask: "pick", score: "crowd"') === true, lines[1].hint);
  check("insight: steps say when they run", lines[8].hint?.text.startsWith("00:00 → 00:20") === true && lines[10].hint?.text.startsWith("00:20 → 00:30") === true, [lines[8].hint, lines[10].hint]);
  check("insight: a group says what it changes", lines[7].hint?.text.includes("speed counts") === true, lines[7].hint);
  check("insight: a question says what it is", lines[0].hint?.text.startsWith("poll") === true, lines[0].hint);
  const lit = analyze(script, script.indexOf("(") + 1);
  check("insight: the caret lights a bracket and its partner", lit[0].pieces.some((p) => p.lit) && lit[6].pieces.some((p) => p.lit));
  const broken = analyze(`ShowQuestion(Q9, time: 5]`);
  check("insight: a bracket closing the wrong thing is marked", broken[0].pieces.some((p) => p.bad) && broken[0].hint?.tone === "error", broken[0]);
}

console.log(`${passed} passed, ${failed} failed`);
// a failure fails the run (scripts/check-script.mjs runs this under Node)
if (failed) throw new Error(`${failed} script check${failed > 1 ? "s" : ""} failed`);
