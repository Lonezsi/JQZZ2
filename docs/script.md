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
| `ShowQuestion` | everyone answers, writes or draws |
| `ShowAnswers` | the reveal; voting, guessing and battles happen here |
| `ShowElaboration` | the explanation |
| `ShowResult` | the scoreboard |

`---` is a divider. Any other line is a note on the timeline.

## A question is two choices

What players do (`ask`), and how that scores (`score`). Any pair the table
allows works, so a question is never stuck with the handful of types someone
thought of first.

### `ask`: what players do

| ask | on the phone | answers mean | scores it can take |
| --- | --- | --- | --- |
| `pick` | pick one option | the options | `right`, `crowd`, `none` |
| `pick-many` | pick any number | the options | `right`, `none` |
| `type-in` | type the answer | the accepted spellings | `right` |
| `order` | put the items in order | the items, in the right order | `right` |
| `number` | guess a number, on a slider when there's `min` and `max` | one: `text` the right number | `right`, `crowd` |
| `match` | pair each one with its other half | pairs: `text` and `match` | `right` |
| `rank` | rank everything from S to D | the items | `crowd`, `none` |
| `write` | write something | the secret words, for `secret` | `votes`, `authors`, `secret`, `knockout`, `none` |
| `draw` | draw something | the secret words, for `secret` | `votes`, `authors`, `secret`, `knockout`, `none` |
| `chain` | write, draw what you're handed, describe that drawing, and on (Gartic Phone) | none | `none` |

### `score`: how it scores

| score | who scores | how |
| --- | --- | --- |
| `right` | whoever gets it right | `pick`: the pick's `value`. `pick-many`: the picks' `value`s added up (a wrong one can cost). `type-in`: the best matching answer's `value`; case, accents and punctuation don't count, one slip is forgiven in words of 5+ letters. `order`: each item's `value` when it's in its place. `match`: each pair's `value` when it's matched. `number`: up to `value`, less the further off; the closest always gets at least half |
| `crowd` | whoever sides with the most | `pick`: the most picked option(s) give their `value` to everyone who picked them. `rank`: 50 per item placed where the group put it. `number`: scored like `right`, against the group's average instead of a right number (worth the first answer's `value`, 1000 without one) |
| `votes` | the makers of what's voted for | during `ShowAnswers` everyone votes for one that isn't theirs; 100 per vote |
| `authors` | whoever sees through people | during `ShowAnswers` everyone guesses who made each one; 100 per right guess |
| `secret` | guessers and makers | everyone gets a secret word from the answers to write about (without saying it) or draw; during `ShowAnswers` everyone guesses the others' words. A right guess earns the word's `value`, its maker half of it per right guesser |
| `knockout` | winners | during `ShowAnswers` the entries battle two at a time until one is left: 100 per battle won, 200 for the champion |
| `none` | nobody | what was made goes on a wall, or the chains are shown, or the picks are counted |

When `ask` is left out it's `pick`; when `score` is left out it's the first
one its `ask` can take.

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
