package com.lonezsi.jqzz.model;

import jakarta.persistence.Embeddable;

@Embeddable
public record Player(String userId, int score){}