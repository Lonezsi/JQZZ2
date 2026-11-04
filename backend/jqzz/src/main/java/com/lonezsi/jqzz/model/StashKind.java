package com.lonezsi.jqzz.model;

/** What a stash item holds. */
public enum StashKind {
    QUIZ,
    QUESTION,
    IMAGE,
    /** a question's shape without its content: its type, its steps, its answer slots */
    TYPE,
    /**
     * a picture drawn in the drawing frame, kept as a drawing: its layers in the
     * payload (the painter's snapshot) and the flattened picture in the image
     * library, so it can be shown and put in a quiz like any other
     */
    DRAWING
}
