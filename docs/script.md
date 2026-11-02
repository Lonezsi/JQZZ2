# JQzz Script v2

The script is the quiz. The visual editor, the game engine, the sample game
modes and the stash all read and write what this document describes; when
something here and the code disagree, the code is wrong. The registry of
question types lives in `frontend/src/utils/questionTypes.ts`, the parser in
`scriptParser.ts`, the writer in `scriptSerializer.ts`, and the engine's side
in `backend/.../game/Game.java`.

v1 scripts still read: every old type name is kept as an alias.

## Shape

```
# Anything after # is a comment

NewQuestion Q1 (
  type: "single",
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
| `ShowAnswers` | the reveal; for some types the voting or guessing happens here |
| `ShowElaboration` | the explanation |
| `ShowResult` | the scoreboard |

`---` is a divider. Any other line is a note on the timeline.

## Fields of a question

| field | value | for |
| --- | --- | --- |
| `type` | a type name, below | every question; `single` if left out |
| `prompt` | string | every question |
| `elaboration` | string | shown by `ShowElaboration` |
| `answers` | list of answers, below | what the type says they mean |
| `unit` | string, e.g. `"m"` | `number` |
| `min`, `max` | numbers | `number`: the ends of the slider |
| `rounds` | number | `telephone`: how many turns, the first write included (default: one per player, 3 to 8) |

Strings are double quoted with JSON escapes (`"say \"hi\""`). Numbers are
plain (`100`, `-3`, `2.5`). A trailing comma after a field is fine.

## Answers

```
{ text: "Gold", match: "Au", value: 100 },
```

| key | value |
| --- | --- |
| `text` | string, always |
| `value` | number: points, as the type defines them |
| `match` | string: the other half of a pair (`match` type) |

## Question types

| type | plays like | answers mean | scoring |
| --- | --- | --- | --- |
| `single` | pick one (Kahoot) | the options | `value` of the pick |
| `multiple` | pick any | the options | sum of the picks' `value` |
| `typed` | type it (Quizlet) | the accepted spellings | `value` of the best match; case, accents and punctuation don't count, one typo is forgiven in words of 5+ letters |
| `order` | put in order (Kahoot puzzle) | the items, in the right order | `value` of each item placed right |
| `number` | estimate | one: `text` the right number | up to `value`, less the further off; the closest always gets at least half |
| `match` | match pairs (Quizlet) | pairs: `text` and `match` | `value` of each pair matched right |
| `poll` | everyone votes | the options | `value` of the most picked option(s) to everyone who picked it; `0` for a plain poll |
| `tierlist` | rank into S to D | the items | 50 per item placed where the group put it |
| `write` | write an answer | none | none: the answers go on a wall |
| `write-vote` | write, then vote (Quiplash) | none | 100 per vote your answer gets |
| `who-wrote` | write, then guess who wrote what | none | 100 per right guess |
| `knockout` | write, then knockout battles | none | 100 per battle won, 200 for the champion |
| `draw` | draw the prompt | none | none: the drawings go on a wall |
| `draw-vote` | draw, then vote | none | 100 per vote your drawing gets |
| `draw-guess` | draw a secret word, then guess (Pictionary) | the secret words | a right guess earns its word's `value`; the artist earns half of it per right guesser |
| `draw-knockout` | draw, then knockout battles | none | as `knockout` |
| `telephone` | write, draw, describe, draw... (Gartic Phone) | none | none: the chains are revealed |

Old names still read: `prewritten-single` (`single`), `prewritten-multiple`
(`multiple`), `user-generated` (`write`), `user-generated-vote`
(`write-vote`), `user-generated-identify` (`who-wrote`), `knockout-battle`
(`knockout`).

Where the voting, guessing or battling happens:

- `write-vote`, `who-wrote`, `knockout`, `draw-vote`, `draw-guess`,
  `draw-knockout`: during `ShowAnswers`, so give it time.
- `telephone`: the turns all happen during `ShowQuestion`, its time split
  between them, drawing turns getting twice what writing turns get;
  `ShowAnswers` shows the chains. Someone who joins after it started watches.
  Alone, you hand it on to yourself.

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

`speed` counts for `single`, `multiple`, `typed`, `order`, `number` and
`match`.
