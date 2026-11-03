package com.lonezsi.jqzz.util;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.spec.KeySpec;
import java.util.Base64;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/**
 * The admin's second question, "name of your first pet". Its answer is no pet:
 * a long random string with symbols in it, made once and only ever kept here as
 * a salted PBKDF2 hash, so a copy of the database doesn't give it away.
 */
public final class AdminSecret {

    private static final SecureRandom SECURE = new SecureRandom();
    private static final String LETTERS = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final String SYMBOLS = "!#$%&*+-=?@^_~.:;()[]{}<>";
    private static final int ROUNDS = 210_000;

    private AdminSecret() {}

    /** 24 characters, at least 5 of them symbols */
    public static String answer() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 24; i++) {
            String from = i % 4 == 1 ? SYMBOLS : LETTERS + SYMBOLS;
            sb.append(from.charAt(SECURE.nextInt(from.length())));
        }
        return sb.toString();
    }

    /** "pbkdf2$rounds$salt$hash" */
    public static String hash(String answer) {
        byte[] salt = new byte[16];
        SECURE.nextBytes(salt);
        return "pbkdf2$" + ROUNDS + "$" + b64(salt) + "$" + b64(derive(answer, salt, ROUNDS));
    }

    public static boolean matches(String answer, String stored) {
        if (answer == null || stored == null) return false;
        String[] parts = stored.split("\\$");
        if (parts.length != 4 || !"pbkdf2".equals(parts[0])) return false;
        byte[] salt = Base64.getDecoder().decode(parts[2]);
        byte[] want = Base64.getDecoder().decode(parts[3]);
        return MessageDigest.isEqual(want, derive(answer, salt, Integer.parseInt(parts[1])));
    }

    private static byte[] derive(String answer, byte[] salt, int rounds) {
        try {
            KeySpec spec = new PBEKeySpec(answer.toCharArray(), salt, rounds, 256);
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        } catch (Exception e) {
            throw new IllegalStateException("PBKDF2 is missing", e);
        }
    }

    private static String b64(byte[] bytes) {
        return Base64.getEncoder().encodeToString(bytes);
    }
}
