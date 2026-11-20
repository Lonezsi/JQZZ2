package com.lonezsi.jqzz.service;

/**
 * What a picture really is, read from its first bytes rather than taken from whoever sent it.
 *
 * <p>Only PNG, JPEG, WebP and GIF are pictures here. The type a browser claims is ignored: an
 * SVG is a document that can carry a script, and served from this address it would run as
 * the whole site (JQZZ, Foyer and JR!TER share it), so a file that isn't one of these four
 * is not kept, and not served as anything a browser would run. (Condom report, finding 1.)
 */
public final class PictureType {
    private PictureType() {}

    /** The picture's type, or {@code null} when it isn't one of the four. */
    public static String of(byte[] b) {
        if (b == null || b.length < 12) return null;
        if ((b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return "image/png";
        if ((b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return "image/jpeg";
        if (b[0] == 'G' && b[1] == 'I' && b[2] == 'F' && b[3] == '8') return "image/gif";
        if (b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return "image/webp";
        return null;
    }

    /** The picture's type, or an error saying what is accepted. */
    public static String require(byte[] b) {
        String type = of(b);
        if (type == null) throw new IllegalArgumentException("Only PNG, JPEG, WebP or GIF pictures");
        return type;
    }
}
