package com.lonezsi.jqzz.service;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.InputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.Test;

/** The server fetches pictures for people: only from the open internet, never from this machine or its networks. */
class WebPictureTest {

    private static void refused(String address) {
        assertThatThrownBy(() -> WebPicture.check(URI.create(address))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void thisMachineAndItsNetworksAreOutOfReach() {
        refused("http://127.0.0.1/x.png");
        refused("http://localhost:7900/");
        refused("http://10.0.0.5/a.png");
        refused("http://192.168.1.10/a.png");
        refused("http://172.16.0.1/a.png");
        refused("http://169.254.169.254/latest/meta-data");
        refused("http://100.100.100.100/"); // the tailnet's range
        refused("http://0.0.0.0/");
        refused("http://[::1]/");
        refused("http://[fd7a:115c:a1e0::1]/"); // tailnet IPv6
        refused("http://[::ffff:127.0.0.1]/");
    }

    @Test
    void onlyTheWebsOwnWaysIn() {
        refused("ftp://1.1.1.1/a.png");
        refused("file:///C:/JQZZ/data/devdb.mv.db");
        refused("http://1.1.1.1:7400/a.png");
    }

    @Test
    void aPublicAddressIsFine() {
        assertThatCode(() -> WebPicture.check(URI.create("https://1.1.1.1/a.png"))).doesNotThrowAnyException();
        assertThatCode(() -> WebPicture.check(URI.create("http://8.8.8.8:80/a.png"))).doesNotThrowAnyException();
    }

    @Test
    void itConnectsToTheCheckedAddressAndNeverLooksTheNameUpAgain() throws Exception {
        AtomicReference<String> seen = new AtomicReference<>("");
        try (ServerSocket server = new ServerSocket(0, 1, InetAddress.getLoopbackAddress())) {
            Thread t = new Thread(() -> {
                try (Socket s = server.accept()) {
                    InputStream in = s.getInputStream();
                    StringBuilder b = new StringBuilder();
                    while (!b.toString().endsWith("\r\n\r\n")) b.append((char) in.read());
                    seen.set(b.toString());
                    s.getOutputStream().write("HTTP/1.0 200 OK\r\nContent-Type: image/png\r\n\r\nPNGDATA".getBytes(StandardCharsets.ISO_8859_1));
                } catch (Exception ignored) {
                    // the assertions below will fail
                }
            });
            t.start();
            // ".invalid" can never resolve: only the pinned address can have been used
            WebPicture.Answer a = WebPicture.get(URI.create("http://name.invalid:" + server.getLocalPort() + "/a.png?x=1"),
                    InetAddress.getLoopbackAddress());
            assertThat(a.status()).isEqualTo(200);
            assertThat(a.headers().get("content-type")).isEqualTo("image/png");
            assertThat(new String(a.body().readAllBytes(), StandardCharsets.ISO_8859_1)).isEqualTo("PNGDATA");
            a.socket().close();
            t.join(2000);
        }
        assertThat(seen.get()).startsWith("GET /a.png?x=1 HTTP/1.0\r\n").contains("Host: name.invalid:");
    }
}
