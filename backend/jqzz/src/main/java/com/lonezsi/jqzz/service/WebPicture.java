package com.lonezsi.jqzz.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;

import org.springframework.stereotype.Service;

/**
 * A picture from a web address, fetched by the server for someone's stash.
 *
 * The server sits on a machine with other things listening on it and on the
 * tailnet, so an address has to be a public one: http or https, a host that
 * resolves only to public addresses (not this machine, the local network, the
 * tailnet's 100.64/10, link-local or the like), every redirect checked the
 * same way before it's followed, the connection made to the very address that
 * was checked (so a name can't answer differently the second time), an image
 * by its content type, and no more than MAX_BYTES of it.
 */
@Service
public class WebPicture {

    static final int MAX_BYTES = 10 * 1024 * 1024;
    private static final int MAX_REDIRECTS = 3;

    public record Fetched(byte[] data, String mimeType, String name) {}

    /** one answer: status, lower-cased headers, and the body still to be read (close it) */
    record Answer(int status, Map<String, String> headers, InputStream body, Socket socket) {}

    public Fetched fetch(String address) {
        URI uri = parse(address);
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            InetAddress at = check(uri);
            Answer res;
            try {
                res = get(uri, at);
            } catch (IOException e) {
                throw new IllegalArgumentException("Couldn't reach that address");
            }
            int status = res.status();
            if (status >= 300 && status < 400) {
                close(res);
                String to = res.headers().get("location");
                if (to == null) throw new IllegalArgumentException("That address sent us nowhere");
                uri = uri.resolve(to);
                continue;
            }
            if (status != 200) {
                close(res);
                throw new IllegalArgumentException("That address answered " + status);
            }
            String encoding = res.headers().getOrDefault("transfer-encoding", "").trim();
            if (!encoding.isEmpty() && !encoding.equalsIgnoreCase("identity")) {
                close(res);
                throw new IllegalArgumentException("Couldn't read the picture from there");
            }
            String type = res.headers().getOrDefault("content-type", "").split(";")[0].trim().toLowerCase();
            if (!type.startsWith("image/") || type.equals("image/svg+xml")) {
                close(res);
                throw new IllegalArgumentException("That address isn't a picture");
            }
            long length = -1;
            try {
                length = Long.parseLong(res.headers().getOrDefault("content-length", "-1").trim());
            } catch (NumberFormatException ignored) {
                // no usable length; the read below still caps it
            }
            if (length > MAX_BYTES) {
                close(res);
                throw new IllegalArgumentException("That picture is over 10 MB");
            }
            try {
                return new Fetched(read(res.body()), type, nameOf(uri));
            } finally {
                close(res);
            }
        }
        throw new IllegalArgumentException("That address sent us round too many times");
    }

    /**
     * GET over a socket opened to {@code at} itself, so the name is never looked up again.
     * https still checks the certificate against the host name. HTTP/1.0 keeps the body plain
     * (no chunking): it runs to the end of the stream.
     */
    static Answer get(URI uri, InetAddress at) throws IOException {
        boolean https = "https".equalsIgnoreCase(uri.getScheme());
        int port = uri.getPort() != -1 ? uri.getPort() : (https ? 443 : 80);
        String host = uri.getHost();
        Socket raw = new Socket();
        try {
            raw.connect(new InetSocketAddress(at, port), 8000);
            raw.setSoTimeout(12000);
            Socket s = raw;
            if (https) {
                SSLSocket ssl = (SSLSocket) ((SSLSocketFactory) SSLSocketFactory.getDefault()).createSocket(raw, host, port, true);
                SSLParameters p = ssl.getSSLParameters();
                p.setEndpointIdentificationAlgorithm("HTTPS");
                ssl.setSSLParameters(p);
                ssl.startHandshake();
                s = ssl;
            }
            String path = uri.getRawPath() == null || uri.getRawPath().isEmpty() ? "/" : uri.getRawPath();
            if (uri.getRawQuery() != null) path += "?" + uri.getRawQuery();
            boolean usual = uri.getPort() == -1 || port == (https ? 443 : 80);
            String request = "GET " + path + " HTTP/1.0\r\n"
                    + "Host: " + host + (usual ? "" : ":" + port) + "\r\n"
                    + "User-Agent: jqzz (a picture for someone's stash)\r\n"
                    + "Accept: image/*\r\nConnection: close\r\n\r\n";
            s.getOutputStream().write(request.getBytes(StandardCharsets.ISO_8859_1));
            s.getOutputStream().flush();

            InputStream in = new java.io.BufferedInputStream(s.getInputStream(), 8192);
            ByteArrayOutputStream head = new ByteArrayOutputStream();
            int last4 = 0, c;
            while ((c = in.read()) != -1) {
                head.write(c);
                last4 = (last4 << 8) | c;
                if (last4 == 0x0d0a0d0a) break;
                if (head.size() > 64 * 1024) throw new IOException("head too long");
            }
            String[] lines = head.toString(StandardCharsets.ISO_8859_1).split("\r\n");
            String[] first = lines[0].split(" ");
            if (first.length < 2) throw new IOException("odd answer");
            int status = Integer.parseInt(first[1].trim());
            Map<String, String> headers = new HashMap<>();
            for (int i = 1; i < lines.length; i++) {
                int colon = lines[i].indexOf(':');
                if (colon > 0) headers.put(lines[i].substring(0, colon).trim().toLowerCase(), lines[i].substring(colon + 1).trim());
            }
            return new Answer(status, headers, in, s);
        } catch (IOException | RuntimeException e) {
            try {
                raw.close();
            } catch (IOException ignored) {
                // already failing
            }
            if (e instanceof IOException io) throw io;
            throw new IOException("odd answer", e);
        }
    }

    private static URI parse(String address) {
        try {
            URI uri = URI.create(address == null ? "" : address.trim());
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
            if (!scheme.equals("http") && !scheme.equals("https")) throw new IllegalArgumentException();
            if (uri.getHost() == null || uri.getUserInfo() != null) throw new IllegalArgumentException();
            return uri;
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("That isn't a web address (http:// or https://)");
        }
    }

    /** Only somewhere on the open internet, by every address the name has. */
    static InetAddress check(URI uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if (!scheme.equals("http") && !scheme.equals("https")) throw new IllegalArgumentException("Only http and https addresses");
        int port = uri.getPort();
        if (port != -1 && port != 80 && port != 443) throw new IllegalArgumentException("Only the usual web ports");
        InetAddress[] all;
        try {
            all = InetAddress.getAllByName(uri.getHost());
        } catch (UnknownHostException e) {
            throw new IllegalArgumentException("There's no such address");
        }
        for (InetAddress a : all) {
            if (!isPublic(a)) throw new IllegalArgumentException("That address isn't on the open internet");
        }
        return all[0];
    }

    static boolean isPublic(InetAddress a) {
        if (a.isAnyLocalAddress() || a.isLoopbackAddress() || a.isLinkLocalAddress() || a.isSiteLocalAddress()
                || a.isMulticastAddress()) return false;
        byte[] b = a.getAddress();
        if (a instanceof Inet4Address) {
            int x = b[0] & 0xff, y = b[1] & 0xff;
            if (x == 0) return false; // "this network"
            if (x == 100 && y >= 64 && y <= 127) return false; // shared space: the tailnet lives here
            if (x == 192 && y == 0 && (b[2] & 0xff) == 0) return false; // protocol assignments
            if (x == 198 && (y == 18 || y == 19)) return false; // benchmarking
            if (x >= 224) return false; // multicast and reserved
            return true;
        }
        if (a instanceof Inet6Address) {
            int x = b[0] & 0xff;
            if ((x & 0xfe) == 0xfc) return false; // unique local (fc00::/7), the tailnet's too
            // an IPv4 address dressed as IPv6: judge the IPv4 one
            boolean mapped = true;
            for (int i = 0; i < 10; i++) mapped &= b[i] == 0;
            mapped &= (b[10] & 0xff) == 0xff && (b[11] & 0xff) == 0xff;
            if (mapped) {
                try {
                    return isPublic(InetAddress.getByAddress(new byte[] { b[12], b[13], b[14], b[15] }));
                } catch (UnknownHostException e) {
                    return false;
                }
            }
            return true;
        }
        return false;
    }

    private static byte[] read(InputStream in) {
        try (in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16 * 1024];
            int n;
            while ((n = in.read(buf)) != -1) {
                out.write(buf, 0, n);
                if (out.size() > MAX_BYTES) throw new IllegalArgumentException("That picture is over 10 MB");
            }
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalArgumentException("Couldn't read the picture from there");
        }
    }

    private static void close(Answer res) {
        try {
            res.socket().close();
        } catch (IOException ignored) {
            // it's being let go anyway
        }
    }

    /** a name for it from the address's last part, before any extension */
    private static String nameOf(URI uri) {
        String path = uri.getPath() == null ? "" : uri.getPath();
        String last = path.substring(path.lastIndexOf('/') + 1);
        int dot = last.lastIndexOf('.');
        return dot > 0 ? last.substring(0, dot) : last;
    }
}
