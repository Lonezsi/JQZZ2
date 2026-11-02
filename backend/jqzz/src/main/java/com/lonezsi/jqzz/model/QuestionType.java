package com.lonezsi.jqzz.model;

public enum QuestionType {
    PREWRITTEN_SINGLE,       // 1: prewritten answers, each gives points = value
    PREWRITTEN_MULTIPLE,     // 2: prewritten answers, multiple selectable, points = value
    USER_GENERATED,          // 3: no answers, user adds text/image
    USER_GENERATED_VOTE,     // 4: user adds answers, next question votes for favourite
    USER_GENERATED_IDENTIFY, // 5: user adds answers, next question asks who answered this
    TIERLIST,                // 6: tierlist, drag squares into tiers, updating values
    KNOCKOUT_BATTLE,         // 7: user adds answers, next questions form knockout battle tree
    // stored by position: a new type only ever goes at the end (docs/script.md has them all)
    TYPED,                   // type the answer, matched forgivingly against the accepted ones
    ORDER,                   // put the answers in order; they are written in the right one
    NUMBER,                  // guess a number: the one answer's text, closer scores more
    MATCH,                   // pair each answer with its match
    POLL,                    // pick one; the most picked option(s) score
    DRAW,                    // everyone draws, it all goes on a wall
    DRAW_VOTE,               // draw, then vote for the best drawing
    DRAW_GUESS,              // draw a secret word (the answers), then guess the others'
    DRAW_BATTLE,             // draw, then the drawings battle in a knockout
    TELEPHONE                // write, draw what you're handed, describe that, and on
}