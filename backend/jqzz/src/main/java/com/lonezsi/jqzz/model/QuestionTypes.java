package com.lonezsi.jqzz.model;

public enum QuestionTypes {
    PREWRITTEN_SINGLE,       // 1: prewritten answers, each gives points = value
    PREWRITTEN_MULTIPLE,     // 2: prewritten answers, multiple selectable, points = value
    USER_GENERATED,          // 3: no answers, user adds text/image
    USER_GENERATED_VOTE,     // 4: user adds answers, next question votes for favourite
    USER_GENERATED_IDENTIFY, // 5: user adds answers, next question asks who answered this
    TIERLIST,                // 6: tierlist, drag squares into tiers, updating values
    KNOCKOUT_BATTLE          // 7: user adds answers, next questions form knockout battle tree
}