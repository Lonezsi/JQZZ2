package com.lonezsi.jqzz.model;

import jakarta.persistence.Embeddable;

/** One player's result in a finished game. "ranking", not "rank": RANK is reserved in MySQL. */
@Embeddable
public record PlayerResult(String userId, String name, int score, int ranking) {}
