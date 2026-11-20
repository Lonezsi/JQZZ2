package com.lonezsi.jqzz;

/** Test pictures: a real PNG signature, then whatever bytes a test wants to tell apart. */
public final class Pic {
    private Pic() {}

    public static byte[] png(int... tail) {
        byte[] head = { (byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n', 0, 0, 0, 13 };
        byte[] out = new byte[head.length + tail.length];
        System.arraycopy(head, 0, out, 0, head.length);
        for (int i = 0; i < tail.length; i++) out[head.length + i] = (byte) tail[i];
        return out;
    }
}
