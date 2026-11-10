/*
 * Checks for the script language: `npm run check:script`. The script is the
 * source of truth, so what it reads it must write back the same way.
 */
import { parseScript, readShowLine } from "./scriptParser";
import { EMPTY_SCRIPT, quizToScript } from "./scriptSerializer";
import { ASKS, SCORES, formatOptions, modeOf, parseOptions } from "./questionTypes";
import { GAME_MODES } from "../modes";
import { parseSettings } from "./settings";
import { analyze } from "./scriptInsight";
import { AI_BASIC_EXAMPLE, AI_EXAMPLE, aiReference, errorsForAI, extractScript, titleOf } from "./aiReference";
import { freshRefs, resolveRef, showRefs, sourceOf } from "./scriptRefs";
import { SCRIPT_DOCS, docsAsText } from "./scriptDocs";
import { readRoster, rosterAction } from "./roster";
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

// ─── the party quiz: earlier answers, a vote, a guess, a roster ───────
{
  const r = parseScript(AI_EXAMPLE, []);
  check("yesterday: reads with no errors, fixes or warnings", !r.errors.length && !r.fixed.length && !r.warnings.length, r);
  const golden = [
    ["write/none", "USER_GENERATED", "What did you do yesterday?", "ref=q1"],
    ["pick/votes", "PREWRITTEN_SINGLE", "Which one is the funniest?", "from=q1, overflow=6, ref=q2"],
    ["person/right", "PREWRITTEN_SINGLE", "The funniest answer was: {@q2.winner}. Who do you think wrote it?", "from=q2"],
    ["draw/none", "DRAW", "How did you think {author}'s face looked when they typed {answer}?", "from=q1, ref=q4"],
    ["pick/votes", "PREWRITTEN_SINGLE", "Which drawing is the funniest? Pick up to 2.", "from=q4, picks=2"],
  ];
  const got = r.questions.map((q) => [q.mode, q.type, q.text, q.options ?? ""]);
  check("yesterday: stored exactly as the golden table says", JSON.stringify(got) === JSON.stringify(golden), got);
  const steps = r.actions.map((a) => (a.question ? `${a.phase} Q${r.questions.indexOf(a.question) + 1} ${a.time}` : `${a.phase} ${a.preview}`));
  const want = [
    'ROSTER {"names":["Anna","Bence","Csilla","Dani","Eszter"],"unique":true}',
    "QUESTION Q1 60",
    "QUESTION Q2 40",
    "ANSWER Q2 15",
    "QUESTION Q3 25",
    "ANSWER Q3 10",
    "RESULT Q3 8",
    "QUESTION Q4 90",
    "QUESTION Q5 40",
    "ANSWER Q5 15",
    "RESULT Q5 10",
  ];
  check("yesterday: its 11 steps, the roster first", JSON.stringify(steps) === JSON.stringify(want), steps);
  const written = quizToScript({ id: 1, name: "Yesterday", authorId: "me", actions: r.actions });
  const tail = (s: string) => s.split("\n").slice(1).join("\n");
  check("yesterday: written back the same from line 2", tail(written) === tail(AI_EXAMPLE), written);
  check("yesterday: written back with the app's title line", written.split("\n")[0] === "# Yesterday · JQzz Script v3", written.split("\n")[0]);
  check("yesterday: the writer never prints a hidden label", !/\bref\b/.test(written), written);
  check("yesterday: is a game mode", GAME_MODES.some((m) => m.id === "yesterday" && m.name === "Yesterday" && m.players === "3+"));
  const mode = GAME_MODES.find((m) => m.id === "yesterday");
  check("yesterday: the mode is the same quiz without the roster", !!mode && tail(mode.script).replace(/\r/g, "").includes(tail(AI_EXAMPLE).replace(/^\s*Roster\(.*\)\n\n/, "")), mode?.script);
}

// ─── the AI guide ─────────────────────────────────────────────────────
{
  roundTrip("the AI's plain example", AI_BASIC_EXAMPLE);
  const basic = parseScript(AI_BASIC_EXAMPLE, []);
  check("the AI's plain example: no fixes or warnings", !basic.fixed.length && !basic.warnings.length, basic);
  check("the AI's plain example: written back the same from line 2", quizToScript(quizOf(basic.actions)).split("\n").slice(1).join("\n") === AI_BASIC_EXAMPLE.split("\n").slice(1).join("\n"));
  const guide = aiReference("a quiz about space");
  check("the AI guide: ASCII only", /^[\x20-\x7e\n]*$/.test(guide), [...guide].filter((c) => !/[\x20-\x7e\n]/.test(c)));
  check("the AI guide: at most 9000 characters", guide.length <= 9000, guide.length);
  check("the AI guide: names every ask", ASKS.every((a) => guide.includes(`- ${a.id}: `)), ASKS.filter((a) => !guide.includes(`- ${a.id}: `)).map((a) => a.id));
  check("the AI guide: names every score", SCORES.every((s) => guide.includes(`- ${s.id}: `)));
  check("the AI guide: has both examples", guide.includes(AI_BASIC_EXAMPLE) && guide.includes(AI_EXAMPLE));
  check("the AI guide: ends with what's wanted", guide.endsWith("== THE QUIZ I WANT ==\na quiz about space"));
  const edit = aiReference("", "# Mine - JQzz Script v3");
  check("the AI guide: with a quiz, asks for changes", edit.endsWith("== THE QUIZ SO FAR ==\n# Mine - JQzz Script v3\n\n== WHAT TO CHANGE ==\n(say what to change)"), edit.slice(-120));

  const FENCE = "```";
  const script = "# Pub - JQzz Script v3\n\nNewQuestion Q1 (\n  prompt: \"x\",\n)\n\nShowQuestion(Q1, time: 20)";
  check("extractScript: the fenced block", extractScript(`Sure! Here it is:\n\n${FENCE}jqzz\n${script}\n${FENCE}\n\nHave fun!`) === script);
  check("extractScript: the block that looks most like a script", extractScript(`${FENCE}\nnot this\n${FENCE}\n${FENCE}\n${script}\n${FENCE}`) === script);
  check("extractScript: a fence never closed runs to the end", extractScript(`Here:\n${FENCE}\n${script}\n`) === script);
  check("extractScript: no fences, prose around it", extractScript(`Here is your quiz.\n${script}\nEnjoy the game!`) === script);
  check("extractScript: Windows line ends and invisible characters", extractScript(`\uFEFF${script.replace(/\n/g, "\r\n")}`) === script);
  check("extractScript: nothing like a script comes back whole", extractScript("just words") === "just words");
  check("titleOf: the title line", titleOf("# Pub night - JQzz Script v3\n# about: x") === "Pub night");
  check("titleOf: the app's own title line", titleOf("# Pub night · JQzz Script v1") === "Pub night");
  check("titleOf: else the first comment that isn't about, players or author", titleOf("# about: x\n# Trivia\nNewQuestion Q1 (") === "Trivia");
  check("titleOf: cut at 60", titleOf(`# ${"a".repeat(80)}`)?.length === 60);
  check("titleOf: none", titleOf("NewQuestion Q1 (") === null);
  const forAI = errorsForAI(["Line 12: b", "a thing", "Line 7: a", "Line 12: c"]);
  check(
    "errorsForAI: by line, one per line, unnumbered last",
    forAI === "The app found problems in your script. Fix them and send the whole script again, in one code block, with nothing else.\n\nLine 7: a\nLine 12: b\na thing",
    forAI,
  );
  const many = errorsForAI(Array.from({ length: 25 }, (_, k) => `Line ${k + 1}: x`));
  check("errorsForAI: at most 20, then how many more", many.endsWith("Line 20: x\n(and 5 more)"), many.slice(-40));
}

// ─── what the reader forgives: each reads as its canonical form, and says so ───
{
  /** a script whose parts are swapped in */
  const base = (parts: { q1?: string; q2?: string; steps?: string; top?: string }) =>
    [
      parts.top ?? "",
      parts.q1 ??
        `NewQuestion Q1 (
  ask: "write", score: "none",
  prompt: "What did you do?",
)`,
      parts.q2 ??
        `NewQuestion Q2 (
  ask: "pick", score: "votes",
  from: "Q1",
  prompt: "Which is funniest?",
  picks: 2,
  overflow: 6,
)`,
      parts.steps ?? "ShowQuestion(Q1, time: 60)\nShowQuestion(Q2, time: 40)\nShowAnswers(Q2, time: 15)",
    ].join("\n");
  const same = (name: string, canonical: string, variant: string, fix: string) => {
    const a = parseScript(canonical, []);
    const b = parseScript(variant, []);
    check(`forgives ${name}: the canonical form is clean`, !a.errors.length && !a.fixed.length, a);
    check(`forgives ${name}: reads without errors`, !b.errors.length, { errors: b.errors, variant });
    check(`forgives ${name}: reads the same`, JSON.stringify(shape(a.questions, a.actions)) === JSON.stringify(shape(b.questions, b.actions)), {
      a: shape(a.questions, a.actions),
      b: shape(b.questions, b.actions),
    });
    // no fix to look for: it's a documented default, so nothing was tidied
    if (fix) check(`forgives ${name}: says what it tidied`, b.fixed.some((f) => f.includes(fix)), { fixed: b.fixed, want: fix });
    else check(`${name}: a default, nothing tidied`, b.fixed.length === 0, b.fixed);
  };
  const steps = (first: string) => `${first}\nShowQuestion(Q2, time: 40)\nShowAnswers(Q2, time: 15)`;
  const canon = base({});

  // X1: steps
  const stepVariants = [
    "show question(q1, 60)",
    'ShowQuestion(Q1, "60s")',
    "ShowQuestion(time=60, Q1)",
    "ShowQuestion(Q1, time: 60);",
    "ShowQuestion(Q1, time: 60) // the first",
    "showquestion(Q1, 60 seconds)",
    "ShowQuestion(question: Q1, time: 60)",
    "ShowQuestion(Q1)",
  ];
  for (const v of stepVariants) same(`the step ${v}`, canon, base({ steps: steps(v) }), "read as ShowQuestion(Q1, time: 60)");
  const defaults: [string, string][] = [
    ["ShowWaiting(Q1)", "ShowWaiting(Q1, time: 5)"],
    ["ShowWait(Q1)", "ShowWaiting(Q1, time: 5)"],
    ["ShowAnswer(Q1)", "ShowAnswers(Q1, time: 15)"],
    ["ShowExplanation(Q1)", "ShowElaboration(Q1, time: 10)"],
    ["ShowResults(Q1)", "ShowResult(Q1, time: 8)"],
    ["ShowLeaderboard(Q1)", "ShowResult(Q1, time: 8)"],
    ["ShowScores(Q1, 8)", "ShowResult(Q1, time: 8)"],
  ];
  for (const [v, c] of defaults) {
    same(`the step ${v}`, base({ steps: `ShowQuestion(Q1, time: 60)\n${c}` }), base({ steps: `ShowQuestion(Q1, time: 60)\n${v}` }), `read as ${c}`);
  }
  const drawQ = `NewQuestion Q1 (\n  ask: "draw", score: "none",\n  prompt: "x",\n)`;
  same("a draw's default time", base({ q1: drawQ, q2: "", steps: "ShowQuestion(Q1, time: 90)" }), base({ q1: drawQ, q2: "", steps: "ShowQuestion(Q1)" }), "time: 90");
  const chainQ = `NewQuestion Q1 (\n  ask: "chain", score: "none",\n  prompt: "x",\n)`;
  same("a chain's default time", base({ q1: chainQ, q2: "", steps: "ShowQuestion(Q1, time: 300)" }), base({ q1: chainQ, q2: "", steps: "ShowQuestion(Q1)" }), "time: 300");
  const pickQ = `NewQuestion Q1 (\n  ask: "pick", score: "right",\n  prompt: "x",\n  answers: [\n    { text: "a", value: 100 },\n  ],\n)`;
  same("a pick's default time", base({ q1: pickQ, q2: "", steps: "ShowQuestion(Q1, time: 30)" }), base({ q1: pickQ, q2: "", steps: "ShowQuestion(Q1)" }), "time: 30");

  // every step variant: the hints read it as a step, never as a note
  for (const v of [...stepVariants, ...defaults.map((d) => d[0])]) {
    const shown = readShowLine(v, () => "write");
    const script = base({ steps: `ShowQuestion(Q1, time: 60)\n${v}\nShowQuestion(Q2, time: 40)` });
    const hint = analyze(script)[script.split("\n").indexOf(v)]?.hint;
    check(`insight agrees with the parser on ${v}`, !!shown && !("error" in shown) && !!hint && /^\d\d:\d\d → /.test(hint.text), { shown, hint });
  }

  // X2: headers
  const q1Body = `  ask: "write", score: "none",\n  prompt: "What did you do?",\n)`;
  for (const h of ["newquestion q1 (", "NewQuestion Q1(", "New Question Q1 (", "NewQuestion Q1 ( # the first", "NewQuestion Q1\n(", "NewQuestion Q1\n\n( // opens"]) {
    same(`the header ${JSON.stringify(h)}`, canon, base({ q1: `${h}\n${q1Body}` }), "read as NewQuestion Q1 (");
  }
  same("a question on one line", canon, base({ q1: 'NewQuestion Q1 ( ask: "write", score: "none", prompt: "What did you do?" )' }), 'read ")" as the end of Q1');
  // X3: the end of a block
  const q1Open = `NewQuestion Q1 (\n  ask: "write", score: "none",\n  prompt: "What did you do?",`;
  same('"),"', canon, base({ q1: `${q1Open}\n),` }), 'read ")" as the end of Q1');
  same('") # done"', canon, base({ q1: `${q1Open}\n) # done` }), 'read ")" as the end of Q1');
  same('")" after the last field', canon, base({ q1: 'NewQuestion Q1 (\n  ask: "write", score: "none",\n  prompt: "What did you do?")' }), 'read ")" as the end of Q1');
  same('a forgotten ")"', canon, base({ q1: q1Open }), 'Q1 had no closing ")", so it ends here');
  // X4: list markers
  for (const [v, c] of [
    ["1. ShowQuestion(Q1, time: 60)", ""],
    ["- ShowQuestion(Q1, time: 60)", ""],
    ["* ShowQuestion(Q1, time: 60)", ""],
    ["**ShowQuestion(Q1, time: 60)**", ""],
    ["`ShowQuestion(Q1, time: 60)`", ""],
  ]) {
    same(`the marker ${v}`, canon + c, base({ steps: steps(v) }), "took off the list marker");
  }
  same("a numbered header", canon, base({ q1: `1. NewQuestion Q1 (\n${q1Body}` }), "took off the list marker");
  // X5, X5b, X6: quotes and comments
  same("single quotes", canon, base({ q1: `NewQuestion Q1 (\n  ask: 'write', score: 'none',\n  prompt: 'What did you do?',\n)` }), 'read the quotes as "double quotes"');
  same("curly quotes", canon, base({ q1: `NewQuestion Q1 (\n  ask: “write”, score: “none”,\n  prompt: „What did you do?”,\n)` }), 'read the quotes as "double quotes"');
  same(
    "quotes inside a string",
    base({ q1: `NewQuestion Q1 (\n  ask: "write", score: "none",\n  prompt: "Is \\"Dune\\" good?",\n)` }),
    base({ q1: `NewQuestion Q1 (\n  ask: "write", score: "none",\n  prompt: "Is "Dune" good?",\n)` }),
    "read the quotes inside the text as part of it",
  );
  same("// comments", canon, base({ q1: `NewQuestion Q1 (\n  ask: "write", score: "none", // free text\n  prompt: "What did you do?",\n)` }), "read // as a comment");
  // X7, X8, X8b: bare words, = and quoted keys
  same("bare words", canon, base({ q1: `NewQuestion Q1 (\n  ask: write, score: none,\n  prompt: "What did you do?",\n)` }), 'read write as "write"');
  same("= for :", canon, base({ q1: `NewQuestion Q1 (\n  ask = "write", score = "none",\n  prompt = "What did you do?",\n)` }), "read = as :");
  same("quoted keys", canon, base({ q1: `NewQuestion Q1 (\n  "ask": "write", "score": "none",\n  "prompt": "What did you do?",\n)` }), 'read "prompt" as prompt');
  // X9, the from forms
  const q2 = (from: string, extra = "") =>
    `NewQuestion Q2 (\n  ask: "pick", score: "votes",\n  ${from}\n  prompt: "Which is funniest?",\n  picks: 2,\n  overflow: 6,${extra}\n)`;
  same("answers: Q1", canon, base({ q2: q2("answers: Q1,") }), 'read answers: Q1 as from: "Q1"');
  same('answers: "Q1"', canon, base({ q2: q2('answers: "Q1",') }), 'read answers: Q1 as from: "Q1"');
  same("from: Q1", canon, base({ q2: q2("from: Q1,") }), 'read Q1 as "Q1"');
  same('from: "{Q1}"', canon, base({ q2: q2('from: "{Q1}",') }), 'as from: "Q1"');
  same('from: "Q1.answers"', canon, base({ q2: q2('from: "Q1.answers",') }), 'as from: "Q1"');
  // X14, X16
  const q2Plain = (extra: string) => `NewQuestion Q2 (\n  ask: "pick", score: "votes",\n  from: "Q1",\n  prompt: "Which is funniest?",\n${extra}\n)`;
  same('overflow: "on"', canon, base({ q2: q2Plain('  picks: 2,\n  overflow: "on",') }), 'read overflow: "on" as overflow: 6');
  same("overflow: on", canon, base({ q2: q2Plain("  picks: 2,\n  overflow: on,") }), "as overflow: 6");
  for (const k of ["max_picks", "max-picks", "maxPicks", "max"]) {
    same(`${k} for picks`, canon, base({ q2: q2Plain(`  ${k}: 2,\n  overflow: 6,`) }), `read ${k} as picks`);
  }
  same('overflow: "off"', base({ q2: q2Plain("  picks: 2,") }), base({ q2: q2Plain('  picks: 2,\n  overflow: "off",') }), "");
  // X15: names other apps give
  same('ask: "vote"', canon, base({ q2: `NewQuestion Q2 (\n  ask: "vote",\n  from: "Q1",\n  prompt: "Which is funniest?",\n  picks: 2,\n  overflow: 6,\n)` }), 'read ask: "vote" as ask: "pick", score: "votes"');
  same('ask: "free-text"', canon, base({ q1: `NewQuestion Q1 (\n  ask: "free-text", score: "none",\n  prompt: "What did you do?",\n)` }), 'read ask: "free-text" as ask: "write"');
  same('score: "no-points"', canon, base({ q1: `NewQuestion Q1 (\n  ask: "write", score: "no-points",\n  prompt: "What did you do?",\n)` }), 'read score: "no-points" as score: "none"');
  same("a pick with from and no score", canon, base({ q2: `NewQuestion Q2 (\n  ask: "pick",\n  from: "Q1",\n  prompt: "Which is funniest?",\n  picks: 2,\n  overflow: 6,\n)` }), "");
  // X11, X11b: answers the way other quiz formats write them
  const pick = (answers: string) => `NewQuestion Q1 (\n  ask: "pick", score: "right",\n  prompt: "Capital?",\n  answers: [\n${answers}\n  ],\n)`;
  const pickCanon = base({ q1: pick('    { text: "Paris", value: 100 },\n    { text: "Rome", value: 0 },'), q2: "", steps: "ShowQuestion(Q1, time: 20)" });
  same("bare options", base({ q1: pick('    { text: "Paris", value: 0 },'), q2: "", steps: "ShowQuestion(Q1, time: 20)" }), base({ q1: pick('    "Paris",'), q2: "", steps: "ShowQuestion(Q1, time: 20)" }), 'read "Paris" as { text: "Paris", value: 0 }');
  same("correct: true", pickCanon, base({ q1: pick('    { text: "Paris", correct: true },\n    { text: "Rome", correct: false },'), q2: "", steps: "ShowQuestion(Q1, time: 20)" }), "read correct: true as value: 100");
  // X17: settings
  same("speed: on {", base({ steps: "speed=on {\nShowQuestion(Q1, time: 60)\n}\nShowQuestion(Q2, time: 40)" }), base({ steps: "speed: on {\nShowQuestion(Q1, time: 60)\n}\nShowQuestion(Q2, time: 40)" }), "read as speed=on {");
  same("a comment after a settings line", base({ steps: "points=2 {\nShowQuestion(Q1, time: 60)\n}\nShowQuestion(Q2, time: 40)" }), base({ steps: "points=2 { # double\nShowQuestion(Q1, time: 60)\n}\nShowQuestion(Q2, time: 40)" }), "read as points=2 {");
  // X3: a roster across lines
  same("a roster across lines", base({ top: 'Roster("Anna", "Bence")' }), base({ top: 'Roster(\n  "Anna",\n  "Bence",\n)' }), "read the roster across lines");
  // fences are skipped without a word
  const fenced = parseScript("```jqzz\n" + canon + "\n```", []);
  check("forgives code fences around the script", !fenced.errors.length && JSON.stringify(shape(fenced.questions, fenced.actions)) === JSON.stringify(shape(parseScript(canon, []).questions, parseScript(canon, []).actions)), fenced.errors);

  // X10, X12, X13: fill-ins
  const yesterday = (q3: string, q4: string) => AI_EXAMPLE.replace(/NewQuestion Q3 \([\s\S]*?\n\)/, q3).replace(/NewQuestion Q4 \([\s\S]*?\n\)/, q4);
  const q3 = (prompt: string, extra = "") => `NewQuestion Q3 (\n  ask: "person", score: "right",\n  from: "Q2",\n  prompt: ${prompt},${extra}\n)`;
  const q4 = (prompt: string) => `NewQuestion Q4 (\n  ask: "draw", score: "none",\n  from: "Q1",\n  prompt: ${prompt},\n)`;
  const origQ3 = q3('"The funniest answer was: {Q2.winner}. Who do you think wrote it?"');
  const origQ4 = q4(`"How did you think {author}'s face looked when they typed {answer}?"`);
  check("the yesterday pieces put back make yesterday", yesterday(origQ3, origQ4) === AI_EXAMPLE);
  same("answers: players on a person question", AI_EXAMPLE, yesterday(q3('"The funniest answer was: {Q2.winner}. Who do you think wrote it?"', '\n  answers: "players",'), origQ4), "a person question lists the players itself: left out answers: players");
  for (const [spelling, fix] of [
    ["{q2.winner}", "read {q2.winner} as {Q2.winner}"],
    ["{{Q2.winner}}", "read {{Q2.winner}} as {Q2.winner}"],
    ["{ Q2 . best }", "as {Q2.winner}"],
    ["{Q2.funniest}", "read {Q2.funniest} as {Q2.winner}"],
    ["[Q2.winner]", "read [Q2.winner] as {Q2.winner}"],
    ['\\"{Q2.winner}\\"', "took the quotes off {Q2.winner}"],
    ['"{Q2.winner}"', "took the quotes off {Q2.winner}"],
  ]) {
    same(`the fill-in ${spelling}`, AI_EXAMPLE, yesterday(q3(`"The funniest answer was: ${spelling}. Who do you think wrote it?"`), origQ4), fix);
  }
  for (const [author, answer, fix] of [
    ["{name}", "{answer}", "read {name} as {author}"],
    ["{player}", "{answer}", "read {player} as {author}"],
    ["[author]", "[answer]", "read [answer] as {answer}"],
    ["{author}", "{text}", "read {text} as {answer}"],
    ["{author}", "'{answer}'", "took the quotes off {answer}"],
    ["{author}", "“{answer}”", "took the quotes off {answer}"],
  ]) {
    same(`the fill-ins ${author} and ${answer}`, AI_EXAMPLE, yesterday(origQ3, q4(`"How did you think ${author}'s face looked when they typed ${answer}?"`)), fix);
  }
  same("the person question's from, from its one winner", AI_EXAMPLE, yesterday(`NewQuestion Q3 (\n  ask: "person", score: "right",\n  prompt: "The funniest answer was: {Q2.winner}. Who do you think wrote it?",\n)`, origQ4), "");
}

// ─── every error fires on its trigger, word for word ──────────────────
{
  const W = (prompt = "x") => `NewQuestion Q1 (\n  ask: "write", score: "none",\n  prompt: "${prompt}",\n)`;
  const say = (name: string, script: string, message: string, kind: "errors" | "warnings" = "errors") => {
    const r = parseScript(script, []);
    check(`says ${name}`, r[kind].some((e) => e.replace(/^Line \d+: /, "") === message), { want: message, [kind]: r[kind] });
  };
  const PICK_VOTES = (from: string, extra = "") => `NewQuestion Q2 (\n  ask: "pick", score: "votes",\n  from: "${from}",\n  prompt: "y",${extra}\n)`;
  const shows = "\nShowQuestion(Q1, time: 60)\nShowQuestion(Q2, time: 40)";
  // structure
  say("S1", "NewQuestion Q1 [\n)", "can't read this question header. Write it like: NewQuestion Q1 (");
  say("S1 without a (", "NewQuestion Q1\nprompt: \"x\"", "can't read this question header. Write it like: NewQuestion Q1 (");
  say("S2", "NewQuestion Question1 (\n  prompt: \"x\",\n)", 'name questions Q1, Q2, Q3 and on, not "Question1"');
  say("S3", `${W()}\nShowQuestion(Q1, soon)`, "can't read this step. Write it like: ShowQuestion(Q1, time: 30)");
  say("S3 for a near miss", `${W()}\nShowQuestion Q1 30`, "can't read this step. Write it like: ShowQuestion(Q1, time: 30)");
  say("S4", `${W()}\nShowQuestion(time: 30)`, "say which question this step shows: ShowQuestion(Q1, time: 30)");
  say("S5", `${W()}\nShowVotes(Q1, time: 30)`, "ShowVotes isn't a step. The steps are ShowWaiting, ShowQuestion, ShowAnswers, ShowElaboration and ShowResult");
  say("S6", `${W()}\nNewQuestion Q2 (\n  ask: "pick", score: "votes",\n  source: "Q1",\n)`, 'unexpected "source" in Q2. To use an earlier question\'s answers, write from: "Q1"');
  say("a ref written in a script", `NewQuestion Q1 (\n  ask: "write",\n  ref: "q1",\n)\nShowQuestion(Q1, time: 60)`, 'unexpected "ref" in Q1');
  // links
  say("L1", `${W()}\n${PICK_VOTES("Q9")}${shows}`, 'from: "Q9" names Q9, which isn\'t defined');
  say("L2", `${W()}\n${PICK_VOTES("the first one")}${shows}`, 'from names a question, like from: "Q1"');
  say("L3", `NewQuestion Q1 (\n  ask: "draw",\n  from: "Q1",\n)\nShowQuestion(Q1, time: 60)`, "Q1 can't take from itself");
  say("L4", `${W()}\nNewQuestion Q2 (\n  ask: "number",\n  from: "Q1",\n)${shows}`, 'from works on ask "pick", "write", "draw" and "person", not on "number"');
  say("L5", `NewQuestion Q1 (\n  ask: "pick",\n  answers: [ { text: "a", value: 100 } ],\n)\n${PICK_VOTES("Q1")}${shows}`, "Q2 takes answers from Q1, but nobody writes or draws anything in Q1");
  say("L6", `${W()}\nNewQuestion Q2 (\n  ask: "person", score: "right",\n  from: "Q1",\n)${shows}`, 'Q2 asks who made Q1\'s winner, but Q1 has no winner. Point it at a question people vote on (score: "votes") or a knockout');
  say("L7", `${W()}\n${PICK_VOTES("Q1")}\nShowQuestion(Q2, time: 40)`, "Q2 uses Q1, but Q1 is never shown");
  say("L8", `${W()}\n${PICK_VOTES("Q1")}\nShowQuestion(Q2, time: 40)\nShowQuestion(Q1, time: 60)`, "Q2 uses Q1, so all of Q1's Show lines must come before Q2's first one");
  say("L9", `${W()}\n${PICK_VOTES("Q1")}\nshuffle {\nShowQuestion(Q1, time: 60)\n}\nShowQuestion(Q2, time: 40)`, "Q2 uses Q1, so neither can be inside a shuffle group");
  say("L11", `NewQuestion Q1 (\n  ask: "pick", score: "votes",\n)\nShowQuestion(Q1, time: 40)`, 'a pick scored by votes needs from: "Q1": its options are what players made there');
  say("L12", `${W()}\nNewQuestion Q2 (\n  ask: "pick", score: "crowd",\n  from: "Q1",\n)${shows}`, 'a pick with from scores "votes" or "none". To guess who wrote one, use ask: "person"');
  say("L13", `${W()}\n${PICK_VOTES("Q1", '\n  answers: [ { text: "a", value: 0 } ],')}${shows}`, "Q2 takes its options from Q1, so leave out answers");
  say("L14", `NewQuestion Q1 (\n  ask: "person", score: "none",\n  answers: [ { text: "Anna", value: 0 } ],\n)\nShowQuestion(Q1, time: 20)`, "a person question lists the players itself, so leave out answers");
  say("L15", `NewQuestion Q1 (\n  ask: "person", score: "right",\n  prompt: "who?",\n)\nShowQuestion(Q1, time: 20)`, 'a person question scored "right" needs from: "Q2": whoever made Q2\'s winner is the right answer');
  say("L16", `NewQuestion Q1 (\n  ask: "write", score: "votes",\n)\nNewQuestion Q2 (\n  ask: "person", score: "none",\n  from: "Q1",\n)${shows}`, 'from on a person question only works with score "right"');
  say("L17", `${W()}\nNewQuestion Q2 (\n  ask: "draw", score: "secret",\n  from: "Q1",\n  answers: [ { text: "cat", value: 100 } ],\n)${shows}`, 'from doesn\'t mix with score "secret": the secret words already say what to make');
  say(
    "L18",
    `NewQuestion Q1 (\n  ask: "write", score: "authors",\n)\n${PICK_VOTES("Q1")}\nNewQuestion Q3 (\n  ask: "person", score: "right",\n  from: "Q2",\n)${shows}\nShowAnswers(Q2, time: 15)\nShowQuestion(Q3, time: 20)`,
    "Q1 already shows who wrote what, so Q3 has nothing to guess",
  );
  say(
    "L19",
    AI_EXAMPLE.replace("ShowQuestion(Q4, time: 90)\n", "").replace("ShowAnswers(Q2, time: 15)\n", "ShowAnswers(Q2, time: 15)\nShowQuestion(Q4, time: 90)\n"),
    "Q4 shows who wrote Q1's answers, but Q3 still asks who wrote one: put Q4 after Q3",
  );
  say("L20", `${W()}\n${W().replace("Q1", "Q3")}\n${PICK_VOTES("Q1", '\n  answers: "Q3",')}${shows}`, 'answers: "Q3" and from: "Q1" disagree: keep just from');
  // fill-ins
  say("P1", `${W("Pick {one} of these")}\nShowQuestion(Q1, time: 60)`, "{one} isn't something JQzz can fill in. It can fill in {Q2.winner}, and {author} and {answer} on a question with from");
  say("P1 for a winner's other words", `${W("{Q1.answer}")}\nShowQuestion(Q1, time: 60)`, "{Q1.answer} isn't something JQzz can fill in. It can fill in {Q2.winner}, and {author} and {answer} on a question with from");
  say("P2", `${W("{Q9.winner}")}\nShowQuestion(Q1, time: 60)`, "{Q9.winner} names Q9, which isn't defined");
  say("P2 for a gone one", `${W("{Q?.winner}")}\nShowQuestion(Q1, time: 60)`, "{Q?.winner} points at a question that's gone");
  say("P3", `${W()}\n${W("{Q1.winner}").replace("Q1 (", "Q2 (")}${shows}`, '{Q1.winner} needs Q1 to have a winner: a question people vote on (score: "votes") or a knockout');
  say("P4", `NewQuestion Q1 (\n  ask: "draw", score: "votes",\n)\n${W("{Q1.winner}").replace("Q1 (", "Q2 (")}${shows}`, "Q1's winner is a drawing, so {Q1.winner} can't go in the text");
  say("P6", `NewQuestion Q1 (\n  ask: "draw",\n  prompt: "draw {author}",\n)\nShowQuestion(Q1, time: 60)`, '{author} and {answer} need from: "Q1" on this question, to know whose answer to use');
  say("P7", `NewQuestion Q1 (\n  ask: "pick",\n  prompt: "is {answer} right?",\n  answers: [ { text: "a", value: 100 } ],\n)\nShowQuestion(Q1, time: 60)`, "{author} and {answer} only work on a write or draw question with from");
  say("P8", `NewQuestion Q1 (\n  ask: "draw",\n)\nNewQuestion Q2 (\n  ask: "write", score: "none",\n  from: "Q1",\n  prompt: "what is {answer}?",\n)${shows}`, "Q1's answers are drawings, so there's no {answer} to fill in");
  // fields
  say("F1", `${W()}\n${PICK_VOTES("Q1", "\n  picks: 11,")}${shows}`, "picks is how many each player can vote for: a whole number from 1 to 10");
  say("F2", `${W().replace("score: \"none\",", "score: \"none\",\n  picks: 2,")}\nShowQuestion(Q1, time: 60)`, 'picks only works where people vote: a pick with from, or score: "votes"');
  say("F3", `${W()}\n${PICK_VOTES("Q1", "\n  overflow: 1,")}${shows}`, 'overflow is the most answers one player sees: a number from 2 to 20, or "off"');
  say("F4", `${W().replace("score: \"none\",", "score: \"none\",\n  overflow: 6,")}\nShowQuestion(Q1, time: 60)`, "overflow only works on a pick with from");
  // the roster
  const R = (line: string) => `${line}\n${W()}\nShowQuestion(Q1, time: 60)`;
  for (const miss of ["Roster: Anna, Bence", 'Roster = ["Anna"]', "roster [Anna]", 'players("Anna")', "Players = Anna", "Roster(Anna, Bence)", 'Roster("Anna") and more']) {
    say(`R1 for ${miss}`, R(miss), 'write the roster like this: Roster("Anna", "Bence")');
  }
  say("R2", R("Roster()"), "Roster needs at least one name");
  say("R3", R('Roster("Anna", " ")'), "a name on the roster can't be empty");
  say("R4", R('Roster("Anna", " anna ")'), '"anna" is on the roster twice');
  say("R4 even with unique off", R('Roster("Anna", "ANNA", unique: off)'), '"ANNA" is on the roster twice');
  say("R5", R(`Roster("${"a".repeat(31)}")`), "names on the roster are up to 30 letters");
  say("R6", R(`Roster(${Array.from({ length: 51 }, (_, k) => `"n${k}"`).join(", ")})`), "the roster takes up to 50 names");
  say("R7", `Roster("Anna")\nRoster("Bence")\n${W()}\nShowQuestion(Q1, time: 60)`, 'the roster is already on line 1: put everyone in one Roster(...)');
  say("R8", R('Roster("Anna", unique: maybe)'), "unique is on or off");
  say("R9", R('Roster("Anna", size: 3)'), 'Roster takes names and unique: off, not "size"');
  say("R10", R(`Roster(${Array.from({ length: 50 }, (_, k) => JSON.stringify(`${k}${'"'.repeat(27)}`)).join(", ")})`), "the roster is too long to keep: shorten some names");
  // warnings: they never block
  say("W1", `${W()}\n${W().replace("Q1 (", "Q2 (")}\nShowQuestion(Q1, time: 60)`, 'Q2 is never shown, so it\'s left out. Add a line like ShowQuestion(Q2, time: 30)', "warnings");
  say("W2", `NewQuestion Q1 (\n  ask: "type-in",\n  prompt: "x",\n)\nShowQuestion(Q1, time: 20)`, 'type-in needs accepted answers, so nobody can score. For free writing, use ask: "write"', "warnings");
  say("W3", `NewQuestion Q1 (\n  ask: "pick", score: "right",\n  answers: [ { text: "a", value: 0 } ],\n)\nShowQuestion(Q1, time: 20)`, "no answer is worth points, so nobody can score: give the right one value: 100", "warnings");
  const warned = parseScript(`NewQuestion Q1 (\n  ask: "type-in",\n)\nShowQuestion(Q1, time: 20)`, []);
  check("a warning doesn't block", warned.errors.length === 0 && warned.warnings.length === 1, warned);
  // messages come in line order, each once
  const twice = parseScript(`${W("{a} {a}")}\nShowQuestion(Q1, time: 60)\nShowVotes(Q1, time: 1)`, []);
  check("errors: in line order, each once", twice.errors.length === 2 && twice.errors[0].startsWith("Line 3:") && twice.errors[1].startsWith("Line 6:"), twice.errors);
}

// ─── braces that aren't fill-ins stay text ────────────────────────────
{
  const r = parseScript(`NewQuestion Q1 (\n  ask: "write", score: "none",\n  prompt: "{1,2} and { } and {a b}. Pick {one} of these",\n)\nShowQuestion(Q1, time: 60)`, []);
  check("only {one} is an error", r.errors.length === 1 && r.errors[0].includes("{one} isn't something"), r.errors);
  check("the rest stays text", r.questions[0].text.startsWith("{1,2} and { } and {a b}."), r.questions[0].text);
}

// ─── hidden labels: links survive moves, pastes and clashes ───────────
{
  const script = `NewQuestion Q1 (
  ask: "write", score: "votes",
  prompt: "A",
)
NewQuestion Q2 (
  ask: "write", score: "none",
  prompt: "B",
)
NewQuestion Q3 (
  ask: "pick", score: "votes",
  from: "Q2",
  prompt: "Best B, after {Q1.winner}?",
)
ShowQuestion(Q1, time: 60)
ShowAnswers(Q1, time: 30)
ShowQuestion(Q2, time: 60)
ShowQuestion(Q3, time: 40)
ShowAnswers(Q3, time: 15)`;
  const r = parseScript(script, []);
  check("labels: a clean parse", !r.errors.length, r.errors);
  // the two question groups swap: B now plays first, A second
  const [a1, a2, b1, ...rest] = r.actions;
  const swapped = [b1, a1, a2, ...rest];
  const written = quizToScript(quizOf(swapped));
  const back = parseScript(written, []);
  check("labels: a reordered quiz still reads", !back.errors.length, { errors: back.errors, written });
  const user = back.questions.find((q) => q.text.includes("Best B"))!;
  check("labels: from still names the same question", sourceOf(back.actions, user)?.text === "B", written);
  const label = user.text.match(/\{@([a-z0-9-]+)\.winner\}/)?.[1] ?? "";
  check("labels: {Qn.winner} still names the same question", resolveRef(back.actions, label, user)?.text === "A", { text: user.text, written });
  check("labels: written by their new numbers", written.includes('from: "Q1"') && written.includes("{Q2.winner}"), written);

  // two questions with the same label: the nearest earlier one wins
  const q = (id: number, text: string, mode: string, options?: string): Question => ({ id, text, type: "USER_GENERATED", mode, answers: [], options });
  const first = q(1, "first", "write/none", "ref=q1");
  const between = q(2, "between", "pick/votes", "from=q1");
  const second = q(3, "second", "write/none", "ref=q1");
  const after = q(4, "after", "pick/votes", "from=q1");
  const step = (x: Question, id: number): Action => ({ id, phase: "QUESTION", time: 30, question: x, preview: "" });
  const dup = [step(first, 11), step(between, 12), step(second, 13), step(after, 14)];
  check("labels: between two, the one before wins", sourceOf(dup, between)?.text === "first");
  check("labels: after both, the nearer wins", sourceOf(dup, after)?.text === "second");
  const dupWritten = quizToScript(quizOf(dup));
  check("labels: written as the nearer one's number", dupWritten.includes('from: "Q1"') && dupWritten.includes('from: "Q3"'), dupWritten);
  check("labels: the writer never prints ref", !/\bref\b/.test(dupWritten), dupWritten);

  // steps dropped in whose label is taken get a fresh one, and their link comes along
  const pasted = freshRefs([step({ ...first, id: 5 }, 15), step({ ...after, id: 6 }, 16)], dup);
  const pastedOpts = pasted.map((a) => parseOptions(a.question!.options));
  check("freshRefs: a clash is renamed, with what uses it", pastedOpts[0].ref !== "q1" && pastedOpts[0].ref === pastedOpts[1].from, pastedOpts);
  const all = [...dup, ...pasted];
  check("freshRefs: the pasted ones link to each other", sourceOf(all, pasted[1].question!)?.id === 5);
  check("showRefs: a label that's gone reads {Q?.winner}", showRefs("{@nope.winner}", dup) === "{Q?.winner}");

  // extras keep the new keys through a round trip
  const o = { unit: "m", from: "q1", picks: "2", overflow: "6", ref: "q2" };
  const kept = parseOptions(formatOptions(o));
  check("extras: from, picks, overflow and ref survive", kept.from === "q1" && kept.picks === "2" && kept.overflow === "6" && kept.ref === "q2", kept);
  check("extras: stored in their order", formatOptions(o) === "unit=m, from=q1, picks=2, overflow=6, ref=q2", formatOptions(o));

  // a script without the new things writes none of them
  for (const [name, s] of [
    ["v1", v1.actions],
    ["v2", v2.actions],
    ["v3", v3.actions],
    ...GAME_MODES.filter((m) => m.id !== "yesterday").map((m) => [`mode ${m.id}`, parseScript(m.script, []).actions] as const),
  ] as [string, Action[]][]) {
    const w = quizToScript(quizOf(s));
    check(`${name}: writes no from, picks, overflow, ref or Roster`, !/\b(from|picks|overflow|ref):|Roster\(/.test(w), w);
    const opts = s.filter((a) => a.question).map((a) => parseOptions(a.question!.options));
    check(`${name}: keeps no link in its extras`, opts.every((x) => !x.from && !x.ref && !x.picks && !x.overflow), opts);
  }
}

// ─── who's coming ─────────────────────────────────────────────────────
{
  const script = `# Party - JQzz Script v3\n\nNewQuestion Q1 (\n  ask: "write", score: "none",\n  prompt: "x",\n)\n\nShowQuestion(Q1, time: 60)\n\nRoster("Anna", "Bence Kiss", unique: off)`;
  const r = parseScript(script, []);
  check("roster: anywhere outside a question, it reads", !r.errors.length, r.errors);
  check("roster: its step goes first", r.actions[0]?.phase === "ROSTER", r.actions.map((a) => a.phase));
  check("roster: stored as names and unique", r.actions[0]?.preview === '{"names":["Anna","Bence Kiss"],"unique":false}', r.actions[0]?.preview);
  const w = quizToScript({ id: 1, name: "Party", authorId: "me", actions: r.actions });
  check("roster: written right under the title", w.split("\n")[2] === 'Roster("Anna", "Bence Kiss", unique: off)', w);
  const again = parseScript(w, []);
  check("roster: unique: off comes back", again.actions[0]?.preview === r.actions[0]?.preview, again.actions[0]);
  check("roster: names with commas and quotes survive", readRoster(parseScript(quizToScript(quizOf([rosterAction({ names: ['Kiss, "Bence"'], unique: true })])), []).actions[0]?.preview)?.names[0] === 'Kiss, "Bence"');
  const only = quizToScript(quizOf([rosterAction({ names: ["Anna"], unique: true })]));
  // the manual: the placeholder of an empty quiz is the whole of it, as comments, and it reads clean
  const empty = parseScript(EMPTY_SCRIPT, []);
  check("manual: the empty script reads with no errors, fixes or warnings", empty.errors.length === 0 && empty.fixed.length === 0 && empty.warnings.length === 0 && empty.questions.length === 0, [empty.errors, empty.fixed, empty.warnings]);
  check("manual: the empty script's comments hold the whole manual", SCRIPT_DOCS.every((sec) => EMPTY_SCRIPT.includes(`# ${sec.name}`)), SCRIPT_DOCS.map((sec) => sec.name));
  const manual = docsAsText();
  for (const a of ASKS) check(`manual: ask "${a.id}" is described`, manual.includes(`${a.id.padEnd(10)} ${a.blurb}`), a.id);
  for (const sc of SCORES) check(`manual: score "${sc.id}" is described`, manual.includes(`${sc.id.padEnd(10)} ${sc.blurb}`), sc.id);
  check("roster: a quiz with only a roster writes the empty script and the line", only === [EMPTY_SCRIPT.split("\n")[0], "", 'Roster("Anna")', "", ...EMPTY_SCRIPT.split("\n").slice(1)].join("\n"), only);
  const onlyBack = parseScript(only, []);
  check("roster: which reads back as just the roster", !onlyBack.errors.length && onlyBack.actions.length === 1 && onlyBack.actions[0].phase === "ROSTER", onlyBack);
  const note = parseScript(`players: Anna, Bence\n# players: 3+`, []);
  check("roster: a players: note stays a note", !note.errors.length && note.actions.length === 1 && note.actions[0].phase === "TEXT", note);
  check("roster: and the hint says how to write one", analyze("players: Anna, Bence")[0].hint?.tone === "warn");
  const hint = analyze('Roster("Anna", "Bence")')[0];
  check("roster: the hint says who's coming", hint.hint?.text === "who's coming: 2 names · nobody can pick the same name", hint);
  check("roster: coloured as a keyword and strings", hint.pieces[0]?.kind === "kw" && hint.pieces.some((p) => p.kind === "str"), hint.pieces);
}

console.log(`${passed} passed, ${failed} failed`);
// a failure fails the run (scripts/check-script.mjs runs this under Node)
if (failed) throw new Error(`${failed} script check${failed > 1 ? "s" : ""} failed`);
