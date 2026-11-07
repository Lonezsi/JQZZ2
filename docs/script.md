# JQzz Script v3

The script is the quiz. The visual editor, the game engine, the sample game
modes and the stash all read and write what this document describes; when
something here and the code disagree, the code is wrong. The registry of
what a question can be lives in `frontend/src/utils/questionTypes.ts`, the
parser in `scriptParser.ts`, the writer in `scriptSerializer.ts`, and the
engine's side in `backend/.../game/Mode.java` and `Game.java`.

v1 and v2 scripts still read: their `type:` names are kept as shorthands.

## Shape

```
# Anything after # is a comment

NewQuestion Q1 (
  ask: "pick",
  score: "right",
  prompt: "Which planet is the biggest?",
  elaboration: "Jupiter: more than twice the mass of all the others together",
  answers: [
    { text: "Jupiter", value: 100 },
    { text: "Saturn",  value: 0 },
  ],
)

ShowWaiting(Q1, time: 5)
ShowQuestion(Q1, time: 20)
ShowAnswers(Q1, time: 10)
ShowElaboration(Q1, time: 15)
ShowResult(Q1, time: 8)
```

A question is defined once with `NewQuestion Qn ( ... )` and then played by
the `Show` lines that name it, in order. A question can be shown by any number
of steps; steps of the same question are its phases.

| step | what the screens do |
| --- | --- |
| `ShowWaiting` | get ready: the question number, a countdown |
| `ShowQuestion` | everyone answers, writes, draws, or votes on an earlier question's answers |
| `ShowAnswers` | the reveal; voting, guessing and battles happen here |
| `ShowElaboration` | the explanation |
| `ShowResult` | the scoreboard |

`---` is a divider. `Roster(...)` says who's coming (see "Who's coming"). Any
other line is a note on the timeline, except a line that looks like a broken
question header, step or roster: that's an error, so a typo never quietly
turns into a note.

## A question is two choices

What players do (`ask`), and how that scores (`score`). Any pair the table
allows works, so a question is never stuck with the handful of types someone
thought of first.

### `ask`: what players do

| ask | on the phone | answers mean | scores it can take |
| --- | --- | --- | --- |
| `pick` | pick one option | the options (none with `from`) | `right`, `crowd`, `none`, `votes` (with `from`) |
| `pick-many` | pick any number | the options | `right`, `none` |
| `type-in` | type the answer | the accepted spellings | `right` |
| `order` | put the items in order | the items, in the right order | `right` |
| `number` | guess a number, on a slider when there's `min` and `max` | one: `text` the right number | `right`, `crowd` |
| `match` | pair each one with its other half | pairs: `text` and `match` | `right` |
| `rank` | rank everything from S to D | the items | `crowd`, `none` |
| `write` | write something | the secret words, for `secret` | `votes`, `authors`, `secret`, `knockout`, `none` |
| `draw` | draw something | the secret words, for `secret` | `votes`, `authors`, `secret`, `knockout`, `none` |
| `chain` | write, draw what you're handed, describe that drawing, and on (Gartic Phone) | none | `none` |
| `person` | pick someone in the game from a list | none: the options are the players | `right` (with `from`), `none` |

### `score`: how it scores

| score | who scores | how |
| --- | --- | --- |
| `right` | whoever gets it right | `pick`: the pick's `value`. `pick-many`: the picks' `value`s added up (a wrong one can cost). `type-in`: the best matching answer's `value`; case, accents and punctuation don't count, one slip is forgiven in words of 5+ letters. `order`: each item's `value` when it's in its place. `match`: each pair's `value` when it's matched. `number`: up to `value`, less the further off; the closest always gets at least half. `person`: 100 for naming whoever made the winning answer of `from` |
| `crowd` | whoever sides with the most | `pick`: the most picked option(s) give their `value` to everyone who picked them. `rank`: 50 per item placed where the group put it. `number`: scored like `right`, against the group's average instead of a right number (worth the first answer's `value`, 1000 without one) |
| `votes` | the makers of what's voted for | everyone votes for ones that aren't theirs: during `ShowAnswers` for `write` and `draw`, during `ShowQuestion` for a `pick` with `from`. One vote each, or up to `picks`. 100 per vote |
| `authors` | whoever sees through people | during `ShowAnswers` everyone guesses who made each one; 100 per right guess |
| `secret` | guessers and makers | everyone gets a secret word from the answers to write about (without saying it) or draw; during `ShowAnswers` everyone guesses the others' words. A right guess earns the word's `value`, its maker half of it per right guesser |
| `knockout` | winners | during `ShowAnswers` the entries battle two at a time until one is left: 100 per battle won, 200 for the champion |
| `none` | nobody | what was made goes on a wall, or the chains are shown, or the picks are counted |

When `ask` is left out it's `pick`; when `score` is left out it's the first
one its `ask` can take.

A pick with from and no score scores votes.

`chain` hands everything round during `ShowQuestion`: its time is split
between the turns, drawing turns getting twice what writing turns get, and
`ShowAnswers` shows the chains. Someone who joins after it started watches.
Alone, you hand it on to yourself.

### `type`: a shorthand

`type:` names a common pair, and is how v1 and v2 scripts said it:

| type | is | plays like |
| --- | --- | --- |
| `single` | `pick` + `right` | Kahoot |
| `multiple` | `pick-many` + `right` | |
| `typed` | `type-in` + `right` | Quizlet |
| `order` | `order` + `right` | Kahoot puzzle |
| `number` | `number` + `right` | estimates |
| `match` | `match` + `right` | Quizlet pairs |
| `poll` | `pick` + `crowd` | hive mind |
| `tierlist` | `rank` + `crowd` | |
| `write` | `write` + `none` | a wall of answers |
| `write-vote` | `write` + `votes` | Quiplash |
| `who-wrote` | `write` + `authors` | |
| `knockout` | `write` + `knockout` | |
| `draw` | `draw` + `none` | a gallery |
| `draw-vote` | `draw` + `votes` | |
| `draw-guess` | `draw` + `secret` | Pictionary |
| `draw-knockout` | `draw` + `knockout` | |
| `telephone` | `chain` + `none` | Gartic Phone |
| `vote` | `pick` + `votes` (with `from`) | |
| `who-was-it` | `person` + `right` | |

Older names read too: `prewritten-single` (`single`), `prewritten-multiple`
(`multiple`), `user-generated` (`write`), `user-generated-vote`
(`write-vote`), `user-generated-identify` (`who-wrote`), `knockout-battle`
(`knockout`). `ask` and `score` next to a `type` win over it. The script
is always written back with `ask` and `score`.

## Fields of a question

| field | value | for |
| --- | --- | --- |
| `ask` | above | every question |
| `score` | above | every question |
| `type` | a shorthand for both, above | |
| `prompt` | string | every question |
| `elaboration` | string | shown by `ShowElaboration` |
| `answers` | list of answers, below | what the `ask` says they mean |
| `unit` | string, e.g. `"m"` | `number` |
| `min`, `max` | numbers | `number`: the ends of the slider |
| `rounds` | number | `chain`: how many turns, the first write included (default: one per player, 3 to 8) |
| `from` | `"Q1"` | `pick`, `write`, `draw`, `person`: the earlier question it uses (below) |
| `picks` | number, 1 to 10 | a `pick` with `from`, or `votes`: how many different ones each player can vote for (default 1) |
| `overflow` | number, 2 to 20, or `"off"` | a `pick` with `from`: the most answers one player sees (`"on"` is 6) |

Strings are double quoted with JSON escapes (`"say \"hi\""`). Numbers are
plain (`100`, `-3`, `2.5`). A trailing comma after a field is fine.

## Answers

```
{ text: "Gold", match: "Au", value: 100 },
```

| key | value |
| --- | --- |
| `text` | string, always |
| `value` | number: points, as the `score` uses them |
| `match` | string: the other half of a pair (`match`) |

## Using an earlier question

`from: "Q1"` makes a question use what players wrote or drew in Q1. Every
Show line of Q1 must come before the first Show line of the question using
it, and neither can be inside a `shuffle` group.

```
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
```

| question | with `from: "Q1"` |
| --- | --- |
| `pick` | the options are Q1's answers, never your own; everyone votes during `ShowQuestion`, and `ShowAnswers` shows the votes and the winner. `score` is `votes` (the default: 100 per vote to whoever made it) or `none`. No `answers` |
| `write`, `draw` | each player is dealt someone else's answer to Q1, a different one each while there are enough to go round, to write or draw about |
| `person` + `right` | the right answer is whoever made Q1's winner (Q1 has to be voted on, or a knockout) |

`answers: "Q1"` means the same as `from: "Q1"`. The script says `Q1`, but the
quiz keeps a hidden label of its own, so moving questions around never points
a `from` at the wrong one.

### Fill-ins

| in a prompt or elaboration | becomes |
| --- | --- |
| `{Q2.winner}` | the words of Q2's winning answer, in quotes, the same for everyone. Q2 is voted on or a knockout, its answers are written, and it's over first |
| `{author}` | on `write` or `draw` with `from`: who made the answer you were dealt |
| `{answer}` | the same: what they wrote, in quotes |

Each phone gets its own `{author}` and `{answer}`; the big screen shows ___.
A winner is decided once, when its question is scored: the most votes (with
`overflow`, the most votes for the times it was seen), a tie settled at random.
Every screen and every later question agree on it. Anything else in braces
that looks like a fill-in, like `{player}` or `{Q2.answer}`, is an error.

### `picks` and `overflow`

`picks: 2` lets everyone vote for up to 2 different ones, never their own,
100 points each. `overflow: 6` on a `pick` with `from` caps what one player
sees. When there are more answers than that, each player gets their own set
of at most 6: nobody gets their own, every answer is in someone's set, and the
big screen shows only how many there are. When one round can't show every
answer (people left, or very many answers), the vote takes more rounds, at
most 5, sharing `ShowQuestion`'s time. When everyone can see all but their own
anyway, there's nothing to split, and the big screen shows them all.

### `person`: pick someone

`ask: "person"` gives every phone a list of the people in the game, leaving
out the one choosing. With `score: "right"` and `from`, naming whoever made
the winner of `from` scores 100. They pick too, so nobody can tell. With
`score: "none"` nobody scores, and the reveal shows who got picked.

### Keeping it a secret

While a `person` question still asks who made an answer, who made what stays
off every screen for the questions it comes from, and the points those
questions gave wait. They land when the `person` question is over, or when the
game ends. A question that deals `{author}` from them has to come after it.

## Who's coming

```
Roster("Anna", "Bence", "Csilla")
```

One line, outside the questions; it's written back under the title. Everyone
who joins picks their name from the list. That's their name in this game
only: their account keeps its own. Nobody off the list can join, and a name on
it can join even after `latejoin=off`. Two people can't have the same name;
`Roster("Anna", "Bence", unique: off)` lets them. Up to 50 names of up to 30
letters. Practice games skip it, copies saved to the stash leave it out, and
only the quiz's author sees it in the quiz lists. A name changes only
in the lobby: someone back on a new phone mid-game asks the host to take the
old one out, which frees the name.

## Settings

A settings line opens a group that lasts until its `}`:

```
speed, points=2 {
  ShowQuestion(Q1, time: 20)
}
```

| setting | meaning |
| --- | --- |
| `shuffle` | the questions inside swap places |
| `mix` | each question's options come in a random order |
| `grade=off` | played, but nobody scores |
| `points=2` | points multiplied (0 to 10) |
| `latejoin=off` | nobody new can join from here |
| `speed` | the faster you answer, the more you get: the last moment is worth half |

`speed` counts when `score` is `right` and `ask` is `pick`, `pick-many`,
`type-in`, `order`, `number` or `match`.

## What the reader forgives

Scripts often come from an AI, so the reader takes these as meant, and says
which lines it tidied:
- Markdown code fences, list markers before lines, `**bold**` around them
- `'single'` and curly quotes, and `"` inside a string when the line makes it clear
- `//` comments, bare words (`ask: pick`), quoted keys, `=` for `:`
- `newquestion q1 (`, a `(` on the next line, a whole question on one line, a comment after `(`, `),` or a `)` at the end of the last field
- Show lines in any case, the arguments in any order, the time as `30`, `30s`, `"30"` or `time=30`, or left out (5, 30, 15, 10, 8 seconds by step; 60 to write, 90 to draw)
- `answers: Q1` for `from: "Q1"`, `ask: "vote"` for a pick scored by votes, `correct: true` for `value: 100`
- `[answer]` and `{name}` for `{author}`-style fill-ins, and quotes around `{answer}`

A line that looks like a question, a step or a roster but can't be read is an
error, never a note. A question that's never shown, a `type-in` with nothing
to accept and a choice where no answer scores are warnings: the quiz still
saves, but nobody can score on them.
