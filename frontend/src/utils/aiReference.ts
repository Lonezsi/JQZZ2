import { ASKS, SCORES } from "./questionTypes";
import type { Ask, Score } from "./questionTypes";

/*
 * Making a quiz with a chat AI: a guide to copy into it, and what to do with
 * its answer. The guide is plain ASCII and says one way to write each thing,
 * so even a weak AI writes a script the reader takes; the reader forgives the
 * rest (docs/script.md, "What the reader forgives"). Its lists of asks and
 * scores come from the registry, so a new one can't be left out of it.
 */

/** the party quiz the guide shows off: earlier answers, a vote, a guess and a roster */
export const AI_EXAMPLE = `# Yesterday - JQzz Script v3

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
ShowResult(Q5, time: 10)`;

/** a plain quiz, the way the app writes one */
export const AI_BASIC_EXAMPLE = `# Space quiz - JQzz Script v3

NewQuestion Q1 (
  ask: "pick", score: "right",
  prompt: "Which planet is the biggest?",
  elaboration: "Jupiter is more than twice the mass of all the others together.",
  answers: [
    { text: "Jupiter", value: 100 },
    { text: "Saturn", value: 0 },
    { text: "Mars", value: 0 },
  ],
)

NewQuestion Q2 (
  ask: "type-in", score: "right",
  prompt: "Which planet is closest to the Sun?",
  answers: [
    { text: "Mercury", value: 100 },
  ],
)

NewQuestion Q3 (
  ask: "number", score: "right",
  prompt: "How many moons does Mars have?",
  min: 0,
  max: 10,
  answers: [
    { text: "2", value: 100 },
  ],
)

speed {
  ShowWaiting(Q1, time: 5)
  ShowQuestion(Q1, time: 20)
  ShowAnswers(Q1, time: 10)
  ShowElaboration(Q1, time: 8)
}
ShowQuestion(Q2, time: 25)
ShowAnswers(Q2, time: 10)
ShowQuestion(Q3, time: 20)
ShowAnswers(Q3, time: 10)
ShowResult(Q3, time: 8)`;

/** what each ask is, for the AI; typed, so a new ask without wording fails tsc */
const AI_ASK: Record<Ask, string> = {
  pick: 'pick one option. answers: the options, the right one value: 100, the rest value: 0. With from it takes no answers and scores "votes"',
  "pick-many": "pick any number of options. answers: the options, right ones value: 100, wrong ones value: 0",
  "type-in": "type a known right answer. answers: the accepted spellings, value: 100 each. Not for free text",
  order: "put the items in order. answers: the items in the right order, value: 50 each",
  number: 'guess a number. answers: one, the right number as text: { text: "195", value: 1000 }. Add min: 0, max: 400 for a slider',
  match: 'pair things up. answers: { text: "Gold", match: "Au", value: 100 }',
  rank: "rank the items from S to D. answers: the items, value: 0",
  write: 'everyone writes something, free text. No answers, except with score "secret": then answers are the secret words',
  draw: 'everyone draws something. No answers, except with score "secret": then answers are the secret words',
  chain: "telephone: write, draw what you get, describe that, and on. No answers",
  person: 'everyone picks a player from a list. No answers. With score "right" it needs from: "Qn", a question people vote on',
};

/** what each score means, the same way */
const AI_SCORE: Record<Score, string> = {
  right: "points for the right answer",
  crowd: "points for siding with most people",
  votes: "100 points per vote to whoever made it",
  authors: "points for guessing who made what",
  secret: "everyone gets a secret word from the answers to write about or draw, and the others guess it",
  knockout: "answers battle two at a time until one is left",
  none: "no points",
};

/**
 * The guide to paste into a chat AI. With `current`, it asks for changes to
 * that quiz instead of a new one; `request` says what the quiz should be, or
 * what to change.
 */
export function aiReference(request?: string, current?: string): string {
  const asks = ASKS.map((a) => `- ${a.id}: ${AI_ASK[a.id]}. score: ${a.scores.map((s) => `"${s}"`).join(", ")}`).join("\n");
  const scores = SCORES.map((s) => `- ${s.id}: ${AI_SCORE[s.id]}`).join("\n");
  const wanted = request?.trim();
  const last = current?.trim()
    ? `== THE QUIZ SO FAR ==\n${current.trim()}\n\n== WHAT TO CHANGE ==\n${wanted || "(say what to change)"}`
    : `== THE QUIZ I WANT ==\n${wanted || "(say what the quiz should be about)"}`;
  return `You are writing a quiz for JQZZ, a party quiz app played on phones with one big shared screen, in its script language.
Reply with ONE code block that holds only the script. Write nothing before or after it.

== THE SHAPE ==
# Pub night - JQzz Script v3

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

== RULES ==
1. Line 1 is the title: # <title> - JQzz Script v3
2. Define every question first. Put all the Show lines after them, in the order they play.
3. A question starts with a line that is exactly NewQuestion Q1 ( and ends with a line that is only ). Number them Q1, Q2, Q3 with a capital Q.
4. Inside, write key: value, one per line. Text goes in straight "double quotes" on one line. Numbers have no quotes. There is no true or false.
5. The only keys are ask, score, prompt, elaboration, answers, from, picks, overflow, unit, min, max, rounds. No title, points, image, correct or time keys.
6. A step is one line, exactly like ShowQuestion(Q1, time: 20). time is whole seconds.
7. A question with no ShowQuestion line is never played.
8. No comments, no numbering, no bullets and no Markdown inside the script.

== STEPS ==
ShowWaiting: get ready. ShowQuestion: everyone answers on their phone. ShowAnswers: the reveal (for write and draw with score "votes", the voting happens here). ShowElaboration: shows the elaboration. ShowResult: the scoreboard.

== WHAT PLAYERS DO (ask) AND HOW IT SCORES (score) ==
If you leave score out, the question gets the first score listed.
${asks}
score means:
${scores}
For an open question where people write anything, use ask "write", not "type-in". type-in is only for typing a known right answer.

== USING EARLIER ANSWERS ==
- from: "Q1" makes a question use what players wrote or drew in Q1. All of Q1's Show lines must come before the first Show line of the question that uses it.
- ask: "pick", score: "votes", from: "Q1": everyone votes for the best answer to Q1, never their own. 100 points per vote to whoever wrote it. The voting happens in ShowQuestion; ShowAnswers shows the winner. Give it no answers.
- picks: 2 lets everyone vote for up to 2 (on any question people vote on).
- overflow: 6 on that pick: nobody sees more than 6 answers. Each player gets their own mix, never their own answer, and every answer gets seen. The big screen then hides the answers. Use it when more than 7 people may play.
- ask: "person", score: "right", from: "Q2": everyone picks, from a list of the players, who they think wrote Q2's winning answer. Give it no answers.
- In a prompt, {Q2.winner} is replaced by the words of Q2's winning answer. Q2 must be a question people vote on.
- ask: "draw" or "write" with from: "Q1": each player gets a different answer to Q1, never their own. In the prompt, {author} is who wrote it and {answer} is what they wrote.
- These are the only fill-ins: {Q2.winner} (with any question number), {author} and {answer}. Never invent others. Always use curly brackets.

== WHO IS COMING ==
If you know the players, put one line right under the title:
Roster("Anna", "Bence", "Csilla")
Everyone picks their name from it when they join, and two people can't pick the same name. Leave the line out if you don't know the names.

== OPTIONAL SETTINGS ==
A settings line opens a group that lasts until a line with only }:
speed {
  ShowQuestion(Q1, time: 20)
}
speed: faster answers score more. points=2: double points. shuffle: the questions inside swap places (never shuffle a question that uses from, or the one it uses).

== GOOD TIMES ==
Quiz question: ShowWaiting 5, ShowQuestion 20, ShowAnswers 10.
Writing: ShowQuestion 60. Drawing: ShowQuestion 90.
Voting on earlier answers: ShowQuestion 40, then ShowAnswers 15.
Person: ShowQuestion 20, then ShowAnswers 10.
End the quiz with ShowResult(Qn, time: 10) on the last question.

== EXAMPLE 1: A NORMAL QUIZ ==
${AI_BASIC_EXAMPLE}

== EXAMPLE 2: A PARTY QUIZ ==
${AI_EXAMPLE}

== CHECK BEFORE YOU ANSWER ==
- Every NewQuestion has a ShowQuestion line, and every Show line has time: and a whole number.
- Every pick question with score "right" has an answer with value: 100.
- Every from: names a question that is shown earlier.
- Only straight double quotes. One code block, nothing else.

If I send you errors, fix them and send the whole script again in one code block.

${last}`;
}

/** lines that only a script has */
const SCRIPT_LINE = /^\s*(new\s*question|show\w*\s*\(|roster\s*\()/i;
/** where a script starts, and where it ends, when it isn't fenced */
const SCRIPT_START = /^\s*(#|new\s*question|roster\s*\(|show\w*\s*\()/i;
const SCRIPT_END = /^\s*(\)|show\w*\s*\(.*\)|\}|---|roster\s*\(.*\))\s*[;,]?\s*$/i;

/** without the blank lines around it */
const trimLines = (lines: string[]) => {
  let a = 0;
  let b = lines.length;
  while (a < b && !lines[a].trim()) a++;
  while (b > a && !lines[b - 1].trim()) b--;
  return lines.slice(a, b).join("\n");
};

/**
 * The script in what an AI wrote back: the fenced block that looks most like
 * a script, or without fences, the lines from where a script starts to where
 * one ends. The whole text when nothing looks like one.
 */
export function extractScript(pasted: string): string {
  const text = pasted.replace(/\r\n?/g, "\n").replace(/[\uFEFF\u200B-\u200D]/g, "");
  const lines = text.split("\n");

  if (lines.some((l) => /^\s*```/.test(l))) {
    const blocks: string[][] = [];
    let open: string[] | null = null;
    for (const l of lines) {
      if (/^\s*```/.test(l)) {
        if (open) {
          blocks.push(open);
          open = null;
        } else open = [];
        continue;
      }
      open?.push(l);
    }
    // a fence never closed runs to the end
    if (open) blocks.push(open);
    const score = (b: string[]) => b.filter((l) => SCRIPT_LINE.test(l)).length;
    const best = blocks.reduce<string[] | null>(
      (top, b) => (!top || score(b) > score(top) || (score(b) === score(top) && b.length > top.length) ? b : top),
      null,
    );
    if (best) return trimLines(best);
  }

  const start = lines.findIndex((l) => SCRIPT_START.test(l));
  if (start < 0) return text;
  let end = lines.length - 1;
  while (end > start && !SCRIPT_END.test(lines[end])) end--;
  return trimLines(lines.slice(start, end > start ? end + 1 : lines.length));
}

/** "# Pub night - JQzz Script v3", "# Pub night · JQzz Script v1" */
const TITLE_LINE = /^#\s*(.+?)\s*(?:[\u00b7\-\u2013|:]\s*)?jqzz\s*script\s*v\d+\s*$/i;

/** a script's name: its title line's, or its first comment's; null when it has neither */
export function titleOf(script: string): string | null {
  const lines = script.split(/\r?\n/).map((l) => l.trim());
  const title =
    lines.map((l) => l.match(TITLE_LINE)?.[1]).find(Boolean) ??
    lines.find((l) => l.startsWith("#") && !/^#\s*(about|players|author)\s*:/i.test(l))?.replace(/^#+\s*/, "");
  const cut = title?.slice(0, 60).trim();
  return cut || null;
}

/** the problems the reader found, worded for the AI that wrote the script */
export function errorsForAI(problems: string[]): string {
  if (!problems.length) return "";
  const lineOf = (p: string) => Number(p.match(/^Line (\d+):/)?.[1] ?? Infinity);
  const sorted = problems
    .map((p, i) => ({ p, i, line: lineOf(p) }))
    .sort((a, b) => a.line - b.line || a.i - b.i);
  const seen = new Set<number>();
  const kept = sorted.filter(({ line }) => {
    if (line === Infinity) return true;
    if (seen.has(line)) return false;
    seen.add(line);
    return true;
  });
  const shown = kept.slice(0, 20).map(({ p }) => p);
  if (kept.length > 20) shown.push(`(and ${kept.length - 20} more)`);
  return `The app found problems in your script. Fix them and send the whole script again, in one code block, with nothing else.\n\n${shown.join("\n")}`;
}
