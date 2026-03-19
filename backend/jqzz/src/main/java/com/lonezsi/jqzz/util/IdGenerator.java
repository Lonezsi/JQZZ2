package com.lonezsi.jqzz.util;

public class IdGenerator {

    private static final String CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

    public static String random(int length) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < length; i++) {
            int idx = (int)(Math.random() * CHARS.length());
            sb.append(CHARS.charAt(idx));
        }
        return sb.toString();
    }

    public static String generateId() {
        return random(10); // internal ID
    }

    public static String generateHandle(String base) {
        String clean = base.toLowerCase().replaceAll("[^a-z0-9]", "");
        if(clean.isEmpty()) clean = "user";
        return clean;
    }
}