package com.lonezsi.jqzz.model;

/** What a stash item holds. */
public enum StashKind {
    QUIZ,
    QUESTION,
    IMAGE,
    /** a question's shape without its content: its type, its steps, its answer slots */
    TYPE
}
