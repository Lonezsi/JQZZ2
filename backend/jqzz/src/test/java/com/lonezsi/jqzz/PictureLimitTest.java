package com.lonezsi.jqzz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.server.ResponseStatusException;

import com.lonezsi.jqzz.model.Image;
import com.lonezsi.jqzz.service.ImageService;

/** Picture limits (Condom 2): a few an hour, a few MB an account, and someone to own them. */
@SpringBootTest
@TestPropertySource(properties = {"jqzz.pictures.per-hour=3", "jqzz.pictures.per-account-mb=1"})
class PictureLimitTest {

    @Autowired
    private ImageService images;

    private static byte[] big(int kb) {
        byte[] head = Pic.png();
        byte[] out = new byte[kb * 1024];
        System.arraycopy(head, 0, out, 0, head.length);
        return out;
    }

    private static int status(Throwable t) {
        return ((ResponseStatusException) t).getStatusCode().value();
    }

    @Test
    void aFourthPictureInAnHourIsTooMany() {
        String me = "limit-" + System.nanoTime();
        for (int i = 0; i < 3; i++) images.keep(me, "p", Pic.png(i), "image/png");
        assertThatThrownBy(() -> images.keep(me, "p", Pic.png(9), "image/png"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(t -> assertThat(status(t)).isEqualTo(429));
        assertThat(images.keep("other-" + System.nanoTime(), "p", Pic.png(1), "image/png")).isNotNull();
    }

    @Test
    void anAccountMayKeepOnlySoMuch() {
        String me = "limit-" + System.nanoTime();
        images.keep(me, "a", big(600), "image/png");
        assertThatThrownBy(() -> images.keep(me, "b", big(600), "image/png"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(t -> assertThat(status(t)).isEqualTo(413));
    }

    @Test
    void replacingGivesTheOldPictureBack() {
        String me = "limit-" + System.nanoTime();
        Image first = images.keep(me, "a", big(600), "image/png");
        Image again = images.replace(first.getId(), me, big(700), "image/png");
        assertThat(again.getId()).isEqualTo(first.getId());
    }

    @Test
    void nobodyCantKeepAPicture() {
        assertThatThrownBy(() -> images.keep(null, "a", Pic.png(1), "image/png"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
