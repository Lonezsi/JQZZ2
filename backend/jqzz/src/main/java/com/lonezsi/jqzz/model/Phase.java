package com.lonezsi.jqzz.model;

public enum Phase {
    WAITING,
    QUESTION,
    ANSWER,
    ELABORATION,
    RESULT;
    public static Phase fromString(String phase) {
        try {
            return Phase.valueOf(phase.toUpperCase());
        } catch (IllegalArgumentException e) {
            return WAITING; // default to WAITING if unknown
        }
    }
}