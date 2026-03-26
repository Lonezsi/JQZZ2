package com.lonezsi.jqzz.service;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.lonezsi.jqzz.model.Image;
import com.lonezsi.jqzz.model.ImageVisibility;
import com.lonezsi.jqzz.repository.ImageRepository;

@Service
public class ImageService {

    private final ImageRepository imageRepository;

    public ImageService(ImageRepository imageRepository) {
        this.imageRepository = imageRepository;
    }

    /**
     * Upload an image. Validates uniqueness of handle based on visibility.
     */
    public Image uploadImage(String handle, String ownerId, ImageVisibility visibility, MultipartFile file) throws IOException {
        // Validate handle format (alphanumeric, no colons)
        if (!handle.matches("^[a-zA-Z0-9_]+$")) {
            throw new IllegalArgumentException("Handle must contain only letters, numbers, and underscores");
        }

        // Check uniqueness
        if (visibility == ImageVisibility.PUBLIC) {
            if (imageRepository.existsByHandleAndOwnerIdIsNull(handle)) {
                throw new IllegalArgumentException("Public image handle already exists");
            }
        } else {
            // private or semi-private
            if (imageRepository.existsByOwnerIdAndHandle(ownerId, handle)) {
                throw new IllegalArgumentException("You already have an image with that handle");
            }
        }

        byte[] data = file.getBytes();
        String mimeType = file.getContentType();
        if (mimeType == null || !mimeType.startsWith("image/")) {
            throw new IllegalArgumentException("File must be an image");
        }

        Image image = new Image(handle, ownerId, visibility, data, mimeType);
        return imageRepository.save(image);
    }

    /**
     * Resolve a reference string to an image ID (or URL). The reference can be:
     * - "handle" (public)
     * - ":handle" (current user's private/semi-private)
     * - "username:handle" (other user's private/semi-private)
     * Returns the image ID or null if not found/accessible.
     */
    public Optional<Long> resolveReference(String ref, String currentUserId) {
        if (ref == null || ref.isBlank()) return Optional.empty();

        String[] parts = ref.split(":", 2);
        if (parts.length == 2) {
            // username:handle
            String username = parts[0];
            String handle = parts[1];
            if (username.isEmpty()) {
                // ":handle" case – current user
                return imageRepository.findByOwnerIdAndHandle(currentUserId, handle)
                        .map(Image::getId);
            } else {
                // other user
                // For other users, we should allow access only if the image is semi-private? Actually private images shouldn't be accessible to others.
                // Let's assume: other users can only see semi-private images.
                Optional<Image> opt = imageRepository.findByOwnerIdAndHandle(username, handle);
                if (opt.isPresent()) {
                    Image img = opt.get();
                    if (img.getVisibility() == ImageVisibility.PRIVATE && !img.getOwnerId().equals(currentUserId)) {
                        return Optional.empty(); // not accessible
                    }
                    return opt.map(Image::getId);
                }
                return Optional.empty();
            }
        } else {
            // public handle
            return imageRepository.findByHandleAndOwnerIdIsNull(ref).map(Image::getId);
        }
    }

    /**
     * Get image data by ID, checking access rights.
     */
    public Optional<byte[]> getImageData(Long id, String currentUserId) {
        Optional<Image> opt = imageRepository.findById(id);
        if (opt.isEmpty()) return Optional.empty();

        Image img = opt.get();
        if (img.getOwnerId() != null && !img.getOwnerId().equals(currentUserId)
                && img.getVisibility() == ImageVisibility.PRIVATE) {
            return Optional.empty(); // not accessible
        }
        return Optional.of(img.getData());
    }

    public String getMimeType(Long id) {
        return imageRepository.findById(id).map(Image::getMimeType).orElse(null);
    }

    public List<Image> listAccessibleImages(String currentUserId) {
        return imageRepository.findAllAccessibleByUser(currentUserId);
    }

    public void deleteImage(Long id, String currentUserId) {
        Image img = imageRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Image not found"));
        if (!img.getOwnerId().equals(currentUserId)) {
            throw new SecurityException("You can only delete your own images");
        }
        imageRepository.deleteById(id);
    }
}