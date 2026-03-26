package com.lonezsi.jqzz.model;

public enum ImageVisibility {
    PUBLIC,          // anyone can use, handle globally unique
    PRIVATE,         // only owner can use, handle unique per owner
    SEMI_PRIVATE     // owner can use, others can also use (but attributed)
}