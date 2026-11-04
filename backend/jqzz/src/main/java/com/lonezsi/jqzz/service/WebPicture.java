package com.lonezsi.jqzz.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

import org.springframework.stereotype.Service;

/**
 * A picture from a web address, fetched by the server for someone's stash.
 *
 * The server sits on a machine with other things listening on it and on the
 * tailnet, so an address has to be a public one: http or https, a host that
 * resolves only to public addresses (not this machine, the local network, the
 * tailnet's 100.64/10, link-local or the like), every redirect checked the
 * same way before it's followed, an image by its content type, and no more
 * than MAX_BYTES of it.
 */
@Service
public class WebPicture {

    static final int MAX_BYTES = 10 * 1024 * 1024;
    private static final int MAX_REDIRECTS = 3;

    public record Fetched(byte[] data, String mimeType, String name) {}

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(8))
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();

    public Fetched fetch(String address) {
        URI uri = parse(address);
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            check(uri);
            HttpResponse<InputStream> res;
            try {
                res = http.send(HttpRequest.newBuilder(uri)
                        .timeout(Duration.ofSeconds(12))
                        .header("User-Agent", "jqzz (a picture for someone's stash)")
                        .header("Accept", "image/*")
                        .GET().build(), HttpResponse.BodyHandlers.ofInputStream());
            } catch (IOException e) {
                throw new IllegalArgumentException("Couldn't reach that address");
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalArgumentException("Couldn't reach that address");
            }
            int status = res.statusCode();
            if (status >= 300 && status < 400) {
                close(res);
                String to = res.headers().firstValue("Location")
                        .orElseThrow(() -> new IllegalArgumentException("That address sent us nowhere"));
                uri = uri.resolve(to);
                continue;
            }
            if (status != 200) {
                close(res);
                throw new IllegalArgumentException("That address answered " + status);
            }
            String type = res.headers().firstValue("Content-Type").orElse("").split(";")[0].trim().toLowerCase();
            if (!type.startsWith("image/") || type.equals("image/svg+xml")) {
                close(res);
                throw new IllegalArgumentException("That address isn't a picture");
            }
            long length = res.headers().firstValueAsLong("Content-Length").orElse(-1);
            if (length > MAX_BYTES) {
                close(res);
                throw new IllegalArgumentException("That picture is over 10 MB");
            }
            return new Fetched(read(res.body()), type, nameOf(uri));
        }
        throw new IllegalArgumentException("That address sent us round too many times");
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
    static void check(URI uri) {
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

    private static void close(HttpResponse<InputStream> res) {
        try {
            res.body().close();
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
