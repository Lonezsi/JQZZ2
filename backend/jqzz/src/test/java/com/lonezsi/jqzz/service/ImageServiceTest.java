package com.lonezsi.jqzz.service;

import java.io.IOException;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.multipart.MultipartFile;

import com.lonezsi.jqzz.model.Image;
import com.lonezsi.jqzz.model.ImageVisibility;
import com.lonezsi.jqzz.repository.ImageRepository;

import java.util.List;
import java.util.Arrays;

@ExtendWith(MockitoExtension.class)
class ImageServiceTest {

    @Mock
    private ImageRepository imageRepository;

    @InjectMocks
    private ImageService imageService;

    private MultipartFile mockFile;

    @BeforeEach
    void setUp() throws IOException {
        mockFile = mock(MultipartFile.class);
        // Use lenient stubs that won't cause failures if not used
        lenient().when(mockFile.getBytes()).thenReturn("fake image data".getBytes());
        lenient().when(mockFile.getContentType()).thenReturn("image/png");
    }

    @Test
    void uploadPublicImage_success() throws IOException {
        String handle = "logo";
        String ownerId = null;
        ImageVisibility visibility = ImageVisibility.PUBLIC;

        when(imageRepository.existsByHandleAndOwnerIdIsNull(handle)).thenReturn(false);
        when(imageRepository.save(any(Image.class))).thenAnswer(inv -> inv.getArgument(0));

        Image result = imageService.uploadImage(handle, ownerId, visibility, mockFile);

        assertThat(result.getHandle()).isEqualTo(handle);
        assertThat(result.getOwnerId()).isNull();
        assertThat(result.getVisibility()).isEqualTo(ImageVisibility.PUBLIC);
        verify(imageRepository).save(any());
    }

    @Test
    void uploadPublicImage_handleAlreadyExists_throwsException() {
        String handle = "logo";
        when(imageRepository.existsByHandleAndOwnerIdIsNull(handle)).thenReturn(true);

        assertThatThrownBy(() -> imageService.uploadImage(handle, null, ImageVisibility.PUBLIC, mockFile))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already exists");
    }

    @Test
    void uploadPrivateImage_success() throws IOException {
        String handle = "mycat";
        String ownerId = "user123";
        ImageVisibility visibility = ImageVisibility.PRIVATE;

        when(imageRepository.existsByOwnerIdAndHandle(ownerId, handle)).thenReturn(false);
        when(imageRepository.save(any(Image.class))).thenAnswer(inv -> inv.getArgument(0));

        Image result = imageService.uploadImage(handle, ownerId, visibility, mockFile);

        assertThat(result.getHandle()).isEqualTo(handle);
        assertThat(result.getOwnerId()).isEqualTo(ownerId);
        assertThat(result.getVisibility()).isEqualTo(ImageVisibility.PRIVATE);
    }

    @Test
    void resolveReference_publicImage() {
        String ref = "logo";
        String currentUserId = "user123";
        Image publicImage = new Image("logo", null, ImageVisibility.PUBLIC, new byte[0], "image/png");
        publicImage.setId(1L);
        when(imageRepository.findByHandleAndOwnerIdIsNull("logo")).thenReturn(Optional.of(publicImage));

        Optional<Long> result = imageService.resolveReference(ref, currentUserId);

        assertThat(result).contains(1L);
    }

    @Test
    void resolveReference_currentUserImage() {
        String ref = ":mycat";
        String currentUserId = "user123";
        Image privateImage = new Image("mycat", currentUserId, ImageVisibility.PRIVATE, new byte[0], "image/png");
        privateImage.setId(2L);
        when(imageRepository.findByOwnerIdAndHandle(currentUserId, "mycat")).thenReturn(Optional.of(privateImage));

        Optional<Long> result = imageService.resolveReference(ref, currentUserId);

        assertThat(result).contains(2L);
    }

    @Test
    void resolveReference_otherUserSemiPrivateImage() {
        String ref = "other:cat";
        String currentUserId = "user123";
        Image semiPrivate = new Image("cat", "other", ImageVisibility.SEMI_PRIVATE, new byte[0], "image/png");
        semiPrivate.setId(3L);
        when(imageRepository.findByOwnerIdAndHandle("other", "cat")).thenReturn(Optional.of(semiPrivate));

        Optional<Long> result = imageService.resolveReference(ref, currentUserId);

        assertThat(result).contains(3L);
    }

    @Test
    void resolveReference_otherUserPrivateImage_denied() {
        String ref = "other:secret";
        String currentUserId = "user123";
        Image privateImage = new Image("secret", "other", ImageVisibility.PRIVATE, new byte[0], "image/png");
        privateImage.setId(4L);
        when(imageRepository.findByOwnerIdAndHandle("other", "secret")).thenReturn(Optional.of(privateImage));

        Optional<Long> result = imageService.resolveReference(ref, currentUserId);

        assertThat(result).isEmpty();
    }

    @Test
    void getImageData_ownPrivateImage_allowed() {
        Long id = 1L;
        String currentUserId = "user123";
        Image privateImage = new Image("mycat", currentUserId, ImageVisibility.PRIVATE, "data".getBytes(), "image/png");
        privateImage.setId(id);
        when(imageRepository.findById(id)).thenReturn(Optional.of(privateImage));

        Optional<byte[]> result = imageService.getImageData(id, currentUserId);

        assertThat(result).isPresent();
        assertThat(result.get()).isEqualTo("data".getBytes());
    }

    @Test
    void getImageData_otherPrivateImage_denied() {
        Long id = 1L;
        String currentUserId = "user123";
        Image privateImage = new Image("secret", "other", ImageVisibility.PRIVATE, "data".getBytes(), "image/png");
        privateImage.setId(id);
        when(imageRepository.findById(id)).thenReturn(Optional.of(privateImage));

        Optional<byte[]> result = imageService.getImageData(id, currentUserId);

        assertThat(result).isEmpty();
    }

    @Test
    void deleteImage_ownImage_success() {
        Long id = 1L;
        String currentUserId = "user123";
        Image privateImage = new Image("mycat", currentUserId, ImageVisibility.PRIVATE, new byte[0], "image/png");
        privateImage.setId(id);
        when(imageRepository.findById(id)).thenReturn(Optional.of(privateImage));
        doNothing().when(imageRepository).deleteById(id);

        imageService.deleteImage(id, currentUserId);

        verify(imageRepository).deleteById(id);
    }

    @Test
    void deleteImage_otherUsersImage_throwsSecurityException() {
        Long id = 1L;
        String currentUserId = "user123";
        Image privateImage = new Image("secret", "other", ImageVisibility.PRIVATE, new byte[0], "image/png");
        privateImage.setId(id);
        when(imageRepository.findById(id)).thenReturn(Optional.of(privateImage));

        assertThatThrownBy(() -> imageService.deleteImage(id, currentUserId))
                .isInstanceOf(SecurityException.class);
    }

    @Test
void uploadImage_invalidHandleFormat_throwsException() {
    String handle = "invalid!@#$";
    String ownerId = "user123";
    ImageVisibility visibility = ImageVisibility.PRIVATE;

    assertThatThrownBy(() -> imageService.uploadImage(handle, ownerId, visibility, mockFile))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Handle must contain only letters, numbers, and underscores");
}

@Test
void uploadImage_invalidMimeType_throwsException() throws IOException {
    String handle = "logo";
    String ownerId = null;
    ImageVisibility visibility = ImageVisibility.PUBLIC;
    
    when(mockFile.getContentType()).thenReturn("application/pdf");

    assertThatThrownBy(() -> imageService.uploadImage(handle, ownerId, visibility, mockFile))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("File must be an image");
}

@Test
void resolveReference_nullRef_returnsEmpty() {
    Optional<Long> result = imageService.resolveReference(null, "user123");
    assertThat(result).isEmpty();
}

@Test
void resolveReference_emptyRef_returnsEmpty() {
    Optional<Long> result = imageService.resolveReference("", "user123");
    assertThat(result).isEmpty();
}

@Test
void resolveReference_blankRef_returnsEmpty() {
    Optional<Long> result = imageService.resolveReference("   ", "user123");
    assertThat(result).isEmpty();
}

@Test
void getImageData_imageNotFound_returnsEmpty() {
    Long id = 999L;
    String currentUserId = "user123";
    when(imageRepository.findById(id)).thenReturn(Optional.empty());

    Optional<byte[]> result = imageService.getImageData(id, currentUserId);
    assertThat(result).isEmpty();
}

@Test
void getMimeType_imageExists_returnsMimeType() {
    Long id = 1L;
    Image image = new Image("logo", null, ImageVisibility.PUBLIC, new byte[0], "image/png");
    image.setId(id);
    when(imageRepository.findById(id)).thenReturn(Optional.of(image));

    String mimeType = imageService.getMimeType(id);
    assertThat(mimeType).isEqualTo("image/png");
}

@Test
void getMimeType_imageNotFound_returnsNull() {
    Long id = 999L;
    when(imageRepository.findById(id)).thenReturn(Optional.empty());

    String mimeType = imageService.getMimeType(id);
    assertThat(mimeType).isNull();
}

@Test
void listAccessibleImages_returnsUserAndPublicImages() {
    String currentUserId = "user123";
    List<Image> expectedImages = Arrays.asList(
        new Image("public", null, ImageVisibility.PUBLIC, new byte[0], "image/png"),
        new Image("private", currentUserId, ImageVisibility.PRIVATE, new byte[0], "image/png")
    );
    when(imageRepository.findAllAccessibleByUser(currentUserId)).thenReturn(expectedImages);

    List<Image> result = imageService.listAccessibleImages(currentUserId);
    assertThat(result).hasSize(2);
    assertThat(result).containsExactlyElementsOf(expectedImages);
}
}