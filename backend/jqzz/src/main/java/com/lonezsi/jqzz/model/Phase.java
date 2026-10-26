package com.lonezsi.jqzz.model;

public enum Phase {
    WAITING,
    QUESTION,
    ANSWER,
    ELABORATION,
    RESULT,
    // editor-only blocks, skipped when a game runs through the quiz
    TEXT,
    DIVIDER;

    public boolean isPlayable() {
        return this != TEXT && this != DIVIDER;
    }

    public static Phase fromString(String phase) {
        try {
            return Phase.valueOf(phase.toUpperCase());
        } catch (IllegalArgumentException e) {
            return WAITING; // default to WAITING if unknown
        }
    }
}