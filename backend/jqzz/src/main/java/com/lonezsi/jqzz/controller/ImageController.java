package com.lonezsi.jqzz.controller;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.lonezsi.jqzz.model.Image;
import com.lonezsi.jqzz.model.ImageVisibility;
import com.lonezsi.jqzz.service.ImageService;

@RestController
@RequestMapping("/images")
public class ImageController {

    private final ImageService imageService;

    public ImageController(ImageService imageService) {
        this.imageService = imageService;
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadImage(
            @RequestParam("handle") String handle,
            @RequestParam(value = "ownerId", required = false) String ownerId,
            @RequestParam("visibility") String visibility,
            @RequestParam("file") MultipartFile file) throws IOException {

        if (ownerId == null && !visibility.equalsIgnoreCase("PUBLIC")) {
            return ResponseEntity.badRequest().body("Owner ID required for non-public images");
        }

        ImageVisibility vis;
        try {
            vis = ImageVisibility.valueOf(visibility.toUpperCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("Invalid visibility");
        }

        try {
            Image image = imageService.uploadImage(handle, ownerId, vis, file);
            return ResponseEntity.ok(Map.of("id", image.getId(), "handle", image.getHandle()));
        } catch (IllegalArgumentException | SecurityException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/resolve")
    public ResponseEntity<?> resolveReference(@RequestParam("ref") String ref,
                                               @RequestHeader(value = "X-User-Id", required = false) String currentUserId) {
        // In a real app, you'd get the user ID from the security context. For simplicity, we use a header.
        if (currentUserId == null) {
            return ResponseEntity.badRequest().body("User ID required");
        }
        Optional<Long> imageId = imageService.resolveReference(ref, currentUserId);
        return imageId.map(id -> ResponseEntity.ok(Map.of("id", id)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}")
    public ResponseEntity<byte[]> getImage(@PathVariable Long id,
                                           @RequestHeader(value = "X-User-Id", required = false) String currentUserId) {
        if (currentUserId == null) {
            return ResponseEntity.badRequest().build();
        }
        Optional<byte[]> data = imageService.getImageData(id, currentUserId);
        if (data.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        String mimeType = imageService.getMimeType(id);
        if (mimeType == null) mimeType = "image/jpeg";
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(mimeType))
                .body(data.get());
    }

    @GetMapping
    public ResponseEntity<?> listAccessibleImages(@RequestHeader("X-User-Id") String currentUserId) {
        return ResponseEntity.ok(imageService.listAccessibleImages(currentUserId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteImage(@PathVariable Long id,
                                         @RequestHeader("X-User-Id") String currentUserId) {
        try {
            imageService.deleteImage(id, currentUserId);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException | SecurityException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}