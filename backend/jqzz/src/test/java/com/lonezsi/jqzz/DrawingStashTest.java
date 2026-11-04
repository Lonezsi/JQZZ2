package com.lonezsi.jqzz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.web.server.ResponseStatusException;

import com.lonezsi.jqzz.model.ImageVisibility;
import com.lonezsi.jqzz.model.StashItem;
import com.lonezsi.jqzz.model.StashKind;
import com.lonezsi.jqzz.service.ImageService;
import com.lonezsi.jqzz.service.StashService;

/** A drawing goes in the stash as a drawing: its layers kept, its picture in the library, both changed when it's saved again. */
@SpringBootTest
class DrawingStashTest {

    @Autowired
    private StashService stash;

    @Autowired
    private ImageService images;

    private static final String LAYERS = "{\"active\":0,\"layers\":[{\"name\":\"sky\",\"image\":\"data:image/webp;base64,AAAA\"}]}";

    @Test
    void aDrawingKeepsItsLayersAndPicture() {
        String me = "drawer-" + System.nanoTime();
        StashItem drawn = stash.saveDrawing(me, null, "My cat", LAYERS, new byte[] { 1, 2, 3 }, "image/webp");
        assertThat(drawn.getKind()).isEqualTo(StashKind.DRAWING);
        assertThat(drawn.getPayload()).isEqualTo(LAYERS);
        assertThat(drawn.getHandle()).isEqualTo("my_cat");
        assertThat(images.getImageData(drawn.getImageId(), me)).hasValue(new byte[] { 1, 2, 3 });

        String more = LAYERS.replace("sky", "sea");
        StashItem again = stash.saveDrawing(me, drawn.getId(), null, more, new byte[] { 4, 5 }, "image/webp");
        assertThat(again.getId()).isEqualTo(drawn.getId());
        assertThat(again.getImageId()).isEqualTo(drawn.getImageId());
        assertThat(again.getPayload()).contains("sea");
        assertThat(again.getTitle()).isEqualTo("My cat");
        assertThat(images.getImageData(drawn.getImageId(), me)).hasValue(new byte[] { 4, 5 });
    }

    @Test
    void someoneElsesDrawingIsntYoursToSave() {
        String me = "drawer-" + System.nanoTime();
        StashItem drawn = stash.saveDrawing(me, null, null, LAYERS, new byte[] { 1 }, "image/png");
        assertThatThrownBy(() -> stash.saveDrawing("someone-else", drawn.getId(), null, LAYERS, new byte[] { 2 }, "image/png"))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void aDrawingMakesItsPicturePublicWithIt() {
        String me = "drawer-" + System.nanoTime();
        StashItem drawn = stash.saveDrawing(me, null, "public sketch " + System.nanoTime(), LAYERS, new byte[] { 1 }, "image/png");
        stash.update(drawn.getId(), me, null, ImageVisibility.PUBLIC, null);
        assertThat(images.getImageData(drawn.getImageId(), "anyone")).isPresent();
    }

    @Test
    void layersThatArentLayersAreRefused() {
        assertThatThrownBy(() -> stash.saveDrawing("x", null, null, "not json", new byte[] { 1 }, "image/png"))
                .isInstanceOf(ResponseStatusException.class);
    }
}
