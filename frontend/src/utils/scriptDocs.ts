import { ASKS, PRESETS, SCORES } from "./questionTypes";

/*
 * The language reference for JQzz Script, version 3. It's the one source for
 * two things: the manual beside the text editor (ScriptDocs.tsx), and the
 * explanation that fills an empty quiz's script, as # comments
 * (scriptSerializer.ts EMPTY_SCRIPT, through docsAsText). The tables of asks,
 * scores and shorthands come from the registry, so a new one shows up here by
 * itself. Keep it true to the reader (scriptParser.ts): when the language
 * changes, change this first.
 *
 * In prose, `code` marks something written in a script.
 */

export type DocBlock =
  | { p: string }
  /** a script, coloured as the editor colours it */
  | { code: string }
  /** the grammar, in EBNF */
  | { grammar: string }
  | { table: { head: string[]; rows: string[][] } }
  | { list: string[] }
  /** something easy to get wrong */
  | { note: string };

export interface DocSection {
  /** for links: stable, lowercase */
  id: string;
  title: string;
  blocks: DocBlock[];
}

const DEFAULT_TIME: Record<string, string> = {
  ShowWaiting: "5",
  ShowQuestion: "30 (write 60, draw 90, chain 300)",
  ShowAnswers: "15",
  ShowElaboration: "10",
  ShowResult: "8",
};

export const SCRIPT_DOCS: DocSection[] = [
  {
    id: "overview",
    title: "Overview",
    blocks: [
      {
        p: "JQzz Script is the language a quiz is written in. A script declares its questions once each, then lists the steps that play them, in order. The text editor reads it as you type; the visual editor writes the same script.",
      },
      { p: "A complete script, with one question:" },
      {
        code: `# Space quiz · JQzz Script v3

NewQuestion Q1 (
  ask: "pick", score: "right",
  prompt: "Which planet is the biggest?",
  answers: [
    { text: "Jupiter", value: 100 },
    { text: "Mars", value: 0 },
  ],
)

ShowWaiting(Q1, time: 5)
ShowQuestion(Q1, time: 20)
ShowAnswers(Q1, time: 10)
ShowResult(Q1, time: 8)`,
      },
    ],
  },
  {
    id: "lexical",
    title: "Lexical structure",
    blocks: [
      {
        list: [
          "A script is read line by line. A question's fields may span lines; everything else is one statement per line.",
          "`#` starts a comment that runs to the end of the line. `//` works the same way.",
          "Strings are in double quotes: `\"Paris\"`. Inside them, `\\\"` is a quote and `\\n` a new line.",
          "Numbers are written bare: `100`, `2.5`. Words that aren't strings or numbers are names: `ask`, `Q1`.",
          "Questions are named `Q1`, `Q2`, `Q3` and on. The numbers don't have to be in order: the writer renumbers them by when each is first shown.",
          "Keywords are case-sensitive in their canonical form (`NewQuestion`, `ShowQuestion`, `Roster`). The reader accepts other cases and repairs them (see Leniency).",
        ],
      },
    ],
  },
  {
    id: "structure",
    title: "Program structure",
    blocks: [
      {
        p: "The first line is the title. After it, in any order: the roster, question definitions, steps, settings groups, dividers and notes. Steps play in the order they're written; where a question is defined doesn't matter.",
      },
      {
        grammar: `script      = title , { statement } ;
title       = "#" , text , "· JQzz Script v3" ;
statement   = comment | roster | question | step
            | group-open | group-close | divider | note ;

question    = "NewQuestion" , qref , "(" , { field , "," } , ")" ;
field       = key , ":" , value ;
value       = string | number | name | answers ;
answers     = "[" , { "{" , pair , { "," , pair } , "}" , "," } , "]" ;

step        = step-name , "(" , qref , [ "," , "time:" , number ] , ")" ;
step-name   = "ShowWaiting" | "ShowQuestion" | "ShowAnswers"
            | "ShowElaboration" | "ShowResult" ;

roster      = "Roster(" , string , { "," , string } ,
              [ "," , "unique:" , ( "on" | "off" ) ] , ")" ;
group-open  = setting , "{" ;
group-close = "}" ;
divider     = "---" ;
qref        = "Q" , digit , { digit } ;
note        = (* any other line *) ;`,
      },
      {
        note: "A line that is none of the statements above becomes a note on the timeline, which players never see. A line that looks like a broken question, step or roster is an error instead, so a typo can't quietly turn into a note.",
      },
    ],
  },
  {
    id: "questions",
    title: "Question definitions",
    blocks: [
      {
        code: `NewQuestion Q2 (
  ask: "number", score: "right",
  prompt: "How tall is the Eiffel Tower?",
  unit: "m",
  min: 100,
  max: 500,
  answers: [
    { text: "330", value: 100 },
  ],
)`,
      },
      { p: "Fields are `key: value`, separated by commas; a trailing comma is fine. These keys exist, and no others:" },
      {
        table: {
          head: ["key", "value", "applies to", "meaning"],
          rows: [
            ["ask", "an ask", "every question", "what players do (see Asks)"],
            ["score", "a score", "every question", "how it's marked. Omitted: the first score the ask allows"],
            ["type", "a shorthand", "every question", "sets ask and score at once (see Compatibility)"],
            ["prompt", "string", "every question", "the text on every screen"],
            ["elaboration", "string", "every question", "shown by ShowElaboration"],
            ["answers", "list", "most asks", "options, accepted answers or secret words"],
            ["unit", "string", "number", "written after the number"],
            ["min, max", "number", "number", "the ends of the slider"],
            ["rounds", "number", "chain", "how many hand-offs"],
            ["from", "\"Qn\"", "pick, write, draw, person", "an earlier question it uses (see Linking questions)"],
            ["picks", "1 to 10", "anything voted on", "how many different ones each player can vote for. Default 1"],
            ["overflow", "2 to 20, \"on\", \"off\"", "pick with from", "the most answers one player sees. \"on\" is 6"],
          ],
        },
      },
      {
        p: "An answer is `{ text: \"...\", value: 100 }`. `value` is the points it's worth; a match answer adds `match: \"...\"`, its other half. A right-answer question needs at least one answer worth 100.",
      },
    ],
  },
  {
    id: "asks",
    title: "Asks",
    blocks: [
      { p: "`ask` is what players do. Each ask takes some scores, listed in the order they're tried when `score` is omitted." },
      {
        table: {
          head: ["ask", "players", "scores"],
          rows: ASKS.map((a) => [a.id, a.blurb, a.scores.join(", ")]),
        },
      },
    ],
  },
  {
    id: "scores",
    title: "Scores",
    blocks: [
      { p: "`score` is how a question is marked." },
      {
        table: {
          head: ["score", "meaning"],
          rows: SCORES.map((s) => [s.id, s.blurb]),
        },
      },
      {
        note: "For free text, use `ask: \"write\"`. `type-in` only marks a known right answer, so without accepted answers nobody can score.",
      },
    ],
  },
  {
    id: "steps",
    title: "Steps",
    blocks: [
      { p: "A step shows one question for some seconds. Steps play top to bottom." },
      {
        table: {
          head: ["step", "what happens", "default time (s)"],
          rows: [
            ["ShowWaiting", "get ready", DEFAULT_TIME.ShowWaiting],
            ["ShowQuestion", "everyone answers; a pick with from is voted on here", DEFAULT_TIME.ShowQuestion],
            ["ShowAnswers", "the reveal; votes on write and draw happen here", DEFAULT_TIME.ShowAnswers],
            ["ShowElaboration", "the elaboration", DEFAULT_TIME.ShowElaboration],
            ["ShowResult", "the scoreboard", DEFAULT_TIME.ShowResult],
          ],
        },
      },
      { p: "`time` is whole seconds and may be omitted. A question with no step is never played, and the writer leaves it out." },
    ],
  },
  {
    id: "settings",
    title: "Settings groups",
    blocks: [
      { p: "A settings line opens a group that holds until a line with only `}`. Settings hold for everything inside." },
      {
        code: `speed {
  ShowQuestion(Q1, time: 20)
  ShowAnswers(Q1, time: 10)
}`,
      },
      {
        table: {
          head: ["setting", "effect"],
          rows: [
            ["shuffle {", "the questions inside swap places"],
            ["mix {", "answers come in a random order"],
            ["grade=off {", "played, but nobody scores"],
            ["latejoin=off {", "nobody new can join from here on"],
            ["points=2 {", "every point counts double"],
            ["speed {", "faster answers score more"],
          ],
        },
      },
      { note: "Never shuffle a question that uses `from`, or the question it uses." },
    ],
  },
  {
    id: "linking",
    title: "Linking questions",
    blocks: [
      {
        p: "`from: \"Q1\"` makes a question use what players wrote or drew in Q1. Every step of Q1 must come before the first step of the question that uses it.",
      },
      {
        table: {
          head: ["question", "with from: \"Q1\""],
          rows: [
            ["pick (votes or none)", "the options are Q1's answers, never your own. Voting happens in ShowQuestion; ShowAnswers shows the winner. No answers field"],
            ["write, draw", "each player gets a different Q1 answer (never their own) to write or draw about"],
            ["person (right)", "the right answer is whoever made Q1's winner. Q1 must be voted on, or a knockout"],
          ],
        },
      },
      {
        p: "`picks: 2` lets each player vote for up to two different answers. `overflow: 6` caps what one player sees at six: each gets their own set, never their own answer, and every answer lands in someone's set. The big screen hides the answers then. Extra rounds happen only when one round can't cover them all.",
      },
      {
        code: `NewQuestion Q2 (
  ask: "pick", score: "votes",
  from: "Q1",
  prompt: "Which one is the funniest?",
  overflow: 6,
  picks: 2,
)`,
      },
    ],
  },
  {
    id: "fillins",
    title: "Fill-ins",
    blocks: [
      { p: "A prompt or an elaboration can hold fill-ins, replaced when the question is played:" },
      {
        table: {
          head: ["fill-in", "becomes", "needs"],
          rows: [
            ["{Q2.winner}", "the words of Q2's winning answer, the same for everyone", "Q2 is voted on or a knockout, and played earlier"],
            ["{author}", "who made the answer this player got", "a write or draw with from"],
            ["{answer}", "the words of that answer", "a write or draw with from, on written answers"],
          ],
        },
      },
      { note: "Anything else in braces that looks like a fill-in is an error. Each phone gets its own `{author}` and `{answer}`; the big screen shows ___." },
    ],
  },
  {
    id: "roster",
    title: "The roster",
    blocks: [
      { code: `Roster("Anna", "Bence", "Csilla")` },
      {
        list: [
          "One line, outside the questions. The writer puts it under the title.",
          "Everyone who joins picks their name from the list. The name holds for this game only; nobody's account changes.",
          "Names are unique: two people can't have the same one. `unique: off` allows repeats.",
          "Up to 50 names, each up to 30 letters. Nobody off the list can join.",
          "Practice games skip it, and it stays out of public quiz lists.",
        ],
      },
    ],
  },
  {
    id: "person",
    title: "The person ask",
    blocks: [
      {
        p: "`ask: \"person\"` gives every phone a list of the people in the game, leaving out the one choosing. With `score: \"right\"` and `from`, naming whoever made the winner of `from` scores 100. While it's still being asked, who made what stays off every screen, and the points it would give away wait until it ends.",
      },
    ],
  },
  {
    id: "diagnostics",
    title: "Diagnostics",
    blocks: [
      {
        table: {
          head: ["kind", "effect", "example"],
          rows: [
            ["error", "nothing is applied until it's fixed", "Line 9: from: \"Q9\" names Q9, which isn't defined"],
            ["warning", "applied; something can't score or play", "Q4 is never shown, so it's left out"],
            ["fix", "applied; the line was read as meant", "read as ShowQuestion(Q1, time: 30)"],
          ],
        },
      },
      { p: "The editor shows the first error and the count of the rest. \"copy errors for the AI\" copies all of them." },
    ],
  },
  {
    id: "leniency",
    title: "Leniency",
    blocks: [
      { p: "Scripts often come from an AI, so the reader repairs common slips and reports each as a fix:" },
      {
        list: [
          "code fences, list markers and **bold** around lines",
          "'single' and curly quotes; `//` comments; `=` for `:`",
          "bare words for strings (`ask: pick`); quoted keys",
          "`newquestion q1 (`, a `(` on the next line, a whole question on one line",
          "steps in any case, arguments in any order, time as `30`, `30s` or `\"30\"`, or omitted",
          "`answers: Q1` for `from: \"Q1\"`; `ask: \"vote\"` for a pick scored by votes; `correct: true` for `value: 100`",
          "`[answer]` or `{name}` for `{answer}` and `{author}`",
        ],
      },
    ],
  },
  {
    id: "compatibility",
    title: "Compatibility",
    blocks: [
      { p: "Version 2 named each kind of question with `type`. Those names still read, as shorthands for an ask and a score:" },
      {
        table: {
          head: ["type", "ask", "score"],
          rows: PRESETS.map((p) => [p.script, p.mode.ask, p.mode.score]),
        },
      },
    ],
  },
  {
    id: "example",
    title: "Complete example",
    blocks: [
      { p: "Write what you did yesterday, vote for the funniest, guess who wrote it, draw someone's face, vote for the best drawings." },
      {
        code: `# Yesterday · JQzz Script v3

Roster("Anna", "Bence", "Csilla", "Dani", "Eszter")

NewQuestion Q1 (
  ask: "write", score: "none",
  prompt: "What did you do yesterday?",
)

NewQuestion Q2 (
  ask: "pick", score: "votes",
  from: "Q1",
  prompt: "Which one is the funniest?",
  overflow: 6,
)

NewQuestion Q3 (
  ask: "person", score: "right",
  from: "Q2",
  prompt: "The funniest answer was: {Q2.winner}. Who do you think wrote it?",
)

NewQuestion Q4 (
  ask: "draw", score: "none",
  from: "Q1",
  prompt: "How did you think {author}'s face looked when they typed {answer}?",
)

NewQuestion Q5 (
  ask: "pick", score: "votes",
  from: "Q4",
  prompt: "Which drawing is the funniest? Pick up to 2.",
  picks: 2,
)

ShowQuestion(Q1, time: 60)
ShowQuestion(Q2, time: 40)
ShowAnswers(Q2, time: 15)
ShowQuestion(Q3, time: 25)
ShowAnswers(Q3, time: 10)
ShowResult(Q3, time: 8)
ShowQuestion(Q4, time: 90)
ShowQuestion(Q5, time: 40)
ShowAnswers(Q5, time: 15)
ShowResult(Q5, time: 10)`,
      },
    ],
  },
];

// ─── as plain text: the empty script's comments ─────────────────────

const plain = (s: string) => s.replace(/`([^`]+)`/g, "$1");

/** words broken into lines of at most `width` */
function wrap(text: string, width: number, indent = ""): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && (line + " " + word).length > width) {
      out.push(indent + line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(indent + line);
  return out;
}

function tableText(head: string[], rows: string[][]): string[] {
  const all = [head, ...rows].map((r) => r.map(plain));
  const widths = head.map((_, c) => Math.min(24, Math.max(...all.map((r) => r[c].length))));
  const row = (r: string[]) =>
    r.map((cell, c) => (c === r.length - 1 ? cell : cell.padEnd(widths[c]))).join("  ").trimEnd();
  return [row(all[0]), widths.map((w, c) => "-".repeat(c === head.length - 1 ? Math.max(4, all[0][c].length) : w)).join("  "), ...all.slice(1).map(row)];
}

function blockText(b: DocBlock): string[] {
  if ("p" in b) return wrap(plain(b.p), 76);
  if ("note" in b) return wrap(`Note: ${plain(b.note)}`, 76);
  if ("code" in b) return b.code.split("\n").map((l) => `    ${l}`);
  if ("grammar" in b) return b.grammar.split("\n").map((l) => `    ${l}`);
  if ("list" in b) return b.list.flatMap((item) => wrap(plain(item), 74).map((l, i) => (i === 0 ? `- ${l}` : `  ${l}`)));
  return tableText(b.table.head, b.table.rows);
}

/** the reference as plain text: what an empty script holds, as comments */
export function docsAsText(): string {
  return SCRIPT_DOCS.map((s, i) => {
    const heading = `${i + 1}. ${s.title.toUpperCase()}`;
    return [heading, ...s.blocks.flatMap((b) => ["", ...blockText(b)])].join("\n");
  }).join("\n\n");
}
