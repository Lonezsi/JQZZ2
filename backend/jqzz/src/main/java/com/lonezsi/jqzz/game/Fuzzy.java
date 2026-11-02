package com.lonezsi.jqzz.game;

import java.text.Normalizer;
import java.util.Locale;

/**
 * Whether a typed answer counts as an accepted one: case, accents and
 * punctuation don't count, and one slip (a wrong, missing, extra or swapped
 * letter) is forgiven in answers of five letters or more.
 */
final class Fuzzy {

    static final int FORGIVING_FROM = 5;

    private Fuzzy() {}

    /** "Reykjavík!" -> "reykjavik" */
    static String normalize(String s) {
        if (s == null) return "";
        String plain = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        return plain.toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}]+", " ")
                .strip()
                .replaceAll(" +", " ");
    }

    static boolean matches(String typed, String accepted) {
        String a = normalize(typed);
        String b = normalize(accepted);
        if (a.isEmpty() || b.isEmpty()) return false;
        if (a.equals(b)) return true;
        // "the beatles" for "beatles" is close enough too
        if (a.replace(" ", "").equals(b.replace(" ", ""))) return true;
        return b.length() >= FORGIVING_FROM && distance(a, b) <= 1;
    }

    /** edits between two strings, a swap of neighbours counting as one */
    static int distance(String a, String b) {
        int n = a.length();
        int m = b.length();
        if (Math.abs(n - m) > 1) return 2; // more than we ever forgive
        int[][] d = new int[n + 1][m + 1];
        for (int i = 0; i <= n; i++) d[i][0] = i;
        for (int j = 0; j <= m; j++) d[0][j] = j;
        for (int i = 1; i <= n; i++) {
            for (int j = 1; j <= m; j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                d[i][j] = Math.min(Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1), d[i - 1][j - 1] + cost);
                if (i > 1 && j > 1 && a.charAt(i - 1) == b.charAt(j - 2) && a.charAt(i - 2) == b.charAt(j - 1)) {
                    d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
                }
            }
        }
        return d[n][m];
    }

    /** "1 234,5" -> 1234.5; null when it isn't a number */
    static Double number(String s) {
        if (s == null) return null;
        String t = s.strip().replaceAll("[\\s_ ']", "");
        if (t.indexOf(',') >= 0 && t.indexOf('.') < 0) {
            // one comma reads as a decimal comma, several as thousands
            t = t.chars().filter(c -> c == ',').count() == 1 ? t.replace(',', '.') : t.replace(",", "");
        } else {
            t = t.replace(",", "");
        }
        try {
            double x = Double.parseDouble(t);
            return Double.isFinite(x) ? x : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
