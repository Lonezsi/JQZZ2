package com.lonezsi.jqzz.service;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;

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
}
