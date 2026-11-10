import { ASKS, SCORES } from "./questionTypes";

/*
 * The script language's manual, written the way the old man pages were: a
 * name, a synopsis, then sections in capitals. It's the one source for two
 * things: the panel beside the text editor, and the explanation that fills
 * the empty script (scriptSerializer.ts EMPTY_SCRIPT, as # comments). Lists
 * of asks and scores come from the registry, so a new one shows up here by
 * itself. Keep the sections true to the reader (scriptParser.ts): when the
 * language changes, change this first.
 */

export interface DocSection {
  /** the heading, in capitals, as a man page has it */
  name: string;
  /** the lines under it, indented by the page when shown */
  text: string;
}

const asks = ASKS.map((a) => `  ${a.id.padEnd(10)} ${a.blurb}. scores: ${a.scores.join(", ")}`).join("\n");
const scores = SCORES.map((s) => `  ${s.id.padEnd(10)} ${s.blurb}`).join("\n");

export const SCRIPT_DOCS: DocSection[] = [
  {
    name: "NAME",
    text: `  jqzz script: the language a quiz is written in, version 3`,
  },
  {
    name: "SYNOPSIS",
    text: `  # Title - JQzz Script v3

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
  ShowResult(Q1, time: 8)

  Roster("Anna", "Bence")`,
  },
  {
    name: "DESCRIPTION",
    text: `  A quiz is its questions, each written once, and the steps that play them,
  in order. A question starts with a line NewQuestion Q1 ( and ends with a
  line holding only ). Each step shows one question for some seconds.

  Lines that start with # are comments and are left out of the quiz. Any
  other line is a note on the timeline, and players don't see it. Lines that
  look like a broken question, step or roster are errors instead, so a typo
  never quietly turns into a note.

  Numbers of questions don't have to be in order: the writer renumbers them
  by the order they're first shown. Only Q-numbers count, and a question with
  no step is never played.`,
  },
  {
    name: "QUESTIONS",
    text: `  Keys: ask, score, prompt, elaboration, answers, from, picks, overflow,
  unit, min, max, rounds. Nothing else is allowed.

  prompt is the text on every screen. elaboration is the explanation shown
  in its own step. answers is a list, { text: "...", value: 100 }: value is
  the points for it. A right-answer question needs one answer worth 100.

  ask: what players do.
${asks}

  score: how it's marked. Leave it out and the first score its ask allows is
  used. The scores:
${scores}

  Old names still read: type: "poll" and the other 21 shorthands of version 2.
  "vote" as an ask means pick + votes, and "who-was-it" means person + right.`,
  },
  {
    name: "STEPS",
    text: `  ShowWaiting(Q1, time: 5)        get ready
  ShowQuestion(Q1, time: 30)     everyone answers
  ShowAnswers(Q1, time: 15)      the reveal. Voting on write and draw happens here
  ShowElaboration(Q1, time: 10)  the explanation
  ShowResult(Q1, time: 8)        the scoreboard

  time is in whole seconds. Leave it out and the step gets a default: 5 for
  waiting, 30 for a question (60 for write, 90 for draw, 300 for chain), 15
  for answers, 10 for elaboration, 8 for the result.

  The reader takes any case, the arguments in any order, and the time as 30,
  30s or "30". Those lines are tidied, and the page says so.`,
  },
  {
    name: "SETTINGS",
    text: `  A settings group opens with a line like speed { and lasts until a line
  holding only }. Inside it are steps or questions. The groups:

  shuffle {        the questions inside swap places (never one that uses
                   from, or the one it uses)
  mix {            the answers come in a random order
  grade=off {      played, but nobody scores
  latejoin=off {   nobody new can join from here on
  points=2 {       every point counts double
  speed {          faster answers score more`,
  },
  {
    name: "EARLIER QUESTIONS",
    text: `  from: "Q1" makes a question use what players wrote or drew in Q1. Q1 has
  to be shown before the question that uses it, and neither can sit inside
  a shuffle group. What each kind does with it:

  pick, score votes or none
                   The options are Q1's answers. Nobody gets their own. Everyone
                   votes during ShowQuestion; ShowAnswers shows the votes and the
                   winner. Give it no answers.
  write, draw      Each player gets a different answer from Q1 (never their own)
                   to write or draw about.
  person, score right
                   The right answer is whoever made Q1's winner. Q1 has to be a
                   question people vote on, or a knockout.

  picks: 2         Each player may vote for up to 2 different ones (1 to 10).
  overflow: 6      The most answers one player sees is 6 (2 to 20, or "on" for
                   6). Each player gets their own set: never their own answer,
                   and every answer is in someone's set. The big screen hides
                   the answers then. More rounds only when one round can't
                   cover them all.

  Fill-ins, in a prompt or an elaboration:
    {Q2.winner}    the words of Q2's winning answer, the same for everyone
    {author}       on write or draw with from: who made the answer you got
    {answer}       what that person wrote
  Anything else in braces is an error. Quote marks written around {answer}
  are taken off, because the words get their own.`,
  },
  {
    name: "PERSON",
    text: `  ask: "person" gives every phone a list of the people in the game, leaving
  out the one choosing. With score "right" and from, naming whoever made the
  winner of from scores 100. Points that the earlier questions held back are
  paid when the person question ends.`,
  },
  {
    name: "WHO'S COMING",
    text: `  Roster("Anna", "Bence", "Csilla")

  One line outside the questions. Everyone who joins picks their name from
  this list. Names are unique: two people can't have the same one. Write
  Roster("Anna", "Bence", unique: off) to allow repeats. Up to 50 names of up
  to 30 letters. The names are for this game only: nobody's account changes.
  Practice games skip the list, and it stays out of the public quiz lists.`,
  },
  {
    name: "WHAT THE READER FORGIVES",
    text: `  Scripts often come from an AI, so the reader takes the usual habits as
  meant, and lists in the editor what it tidied:

    code fences and list markers, **bold** around lines
    'single' and curly quotes; // comments; = for :
    bare words for strings (ask: pick); quoted keys
    newquestion q1 (, a ( on the next line, a whole question on one line
    time as 30, 30s or "30", or left out
    answers: Q1 for from: "Q1"; ask: "vote" for pick + votes
    correct: true for value: 100
    [answer] or {name} for {author} and {answer}

  Tidied lines are not errors. Errors block the script until fixed; warnings
  never do (see ERRORS AND WARNINGS).`,
  },
  {
    name: "ERRORS AND WARNINGS",
    text: `  An error stops the script being applied until it's fixed. The first one
  is shown, with the count of the rest. "copy errors for the AI" copies
  every problem, with the script, so a model can fix them in one go.

  A warning never stops anything: a question that is never shown is left out
  of the quiz; a type-in question with no accepted answers can't score; a
  right-answer question with no answer worth 100 can't score.`,
  },
  {
    name: "EXAMPLE",
    text: `  # Yesterday - JQzz Script v3

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
  {
    name: "SEE ALSO",
    text: `  "make a quiz with AI" (key A) copies a guide with this language in it, for
  any chat assistant, and reads its answer back into a quiz.`,
  },
];

/** the manual as plain text, one string: what the empty script holds, as comments */
export function docsAsText(): string {
  return SCRIPT_DOCS.map((s) => `${s.name}\n${s.text}`).join("\n\n");
}
