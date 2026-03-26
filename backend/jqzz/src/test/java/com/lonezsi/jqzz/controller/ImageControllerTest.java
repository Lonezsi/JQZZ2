package com.lonezsi.jqzz.controller;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.lonezsi.jqzz.model.Image;
import com.lonezsi.jqzz.model.ImageVisibility;
import com.lonezsi.jqzz.service.ImageService;

@ExtendWith(MockitoExtension.class)
class ImageControllerTest {

    @Mock
    private ImageService imageService;

    @InjectMocks
    private ImageController imageController;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(imageController).build();
    }

    @Test
        void uploadImage_success() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "test.png", "image/png", "image data".getBytes());
        Image mockImage = new Image("logo", null, ImageVisibility.PUBLIC, new byte[0], "image/png");
        mockImage.setId(1L); // 👈 add this line
        when(imageService.uploadImage(eq("logo"), eq(null), eq(ImageVisibility.PUBLIC), any()))
                .thenReturn(mockImage);

        mockMvc.perform(multipart("/images/upload")
                        .file(file)
                        .param("handle", "logo")
                        .param("visibility", "PUBLIC"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.handle").value("logo"));
        }

    @Test
    void uploadImage_duplicateHandle_badRequest() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "test.png", "image/png", "image data".getBytes());
        when(imageService.uploadImage(eq("logo"), eq(null), eq(ImageVisibility.PUBLIC), any()))
                .thenThrow(new IllegalArgumentException("Public image handle already exists"));

        mockMvc.perform(multipart("/images/upload")
                        .file(file)
                        .param("handle", "logo")
                        .param("visibility", "PUBLIC"))
                .andExpect(status().isBadRequest())
                .andExpect(content().string("Public image handle already exists"));
    }

    @Test
    void resolveReference_found() throws Exception {
        when(imageService.resolveReference("logo", "user123")).thenReturn(Optional.of(1L));

        mockMvc.perform(get("/images/resolve")
                        .param("ref", "logo")
                        .header("X-User-Id", "user123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    void resolveReference_notFound() throws Exception {
        when(imageService.resolveReference("logo", "user123")).thenReturn(Optional.empty());

        mockMvc.perform(get("/images/resolve")
                        .param("ref", "logo")
                        .header("X-User-Id", "user123"))
                .andExpect(status().isNotFound());
    }

    @Test
    void getImage_success() throws Exception {
        when(imageService.getImageData(1L, "user123")).thenReturn(Optional.of("image data".getBytes()));
        when(imageService.getMimeType(1L)).thenReturn("image/png");

        mockMvc.perform(get("/images/1")
                        .header("X-User-Id", "user123"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(content().bytes("image data".getBytes()));
    }

    @Test
    void getImage_notFound() throws Exception {
        when(imageService.getImageData(1L, "user123")).thenReturn(Optional.empty());

        mockMvc.perform(get("/images/1")
                        .header("X-User-Id", "user123"))
                .andExpect(status().isNotFound());
    }

    @Test
    void listAccessibleImages() throws Exception {
        mockMvc.perform(get("/images")
                        .header("X-User-Id", "user123"))
                .andExpect(status().isOk());
    }

    @Test
    void deleteImage_success() throws Exception {
        mockMvc.perform(delete("/images/1")
                        .header("X-User-Id", "user123"))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteImage_notOwner_badRequest() throws Exception {
        doThrow(new SecurityException("You can only delete your own images"))
                .when(imageService).deleteImage(1L, "user123");

        mockMvc.perform(delete("/images/1")
                        .header("X-User-Id", "user123"))
                .andExpect(status().isBadRequest());
    }
    @Test
void uploadImage_missingOwnerIdForPrivateImage_returnsBadRequest() throws Exception {
    MockMultipartFile file = new MockMultipartFile("file", "test.png", "image/png", "image data".getBytes());
    
    mockMvc.perform(multipart("/images/upload")
                    .file(file)
                    .param("handle", "mycat")
                    .param("visibility", "PRIVATE"))
            .andExpect(status().isBadRequest())
            .andExpect(content().string("Owner ID required for non-public images"));
}

@Test
void uploadImage_invalidVisibility_returnsBadRequest() throws Exception {
    MockMultipartFile file = new MockMultipartFile("file", "test.png", "image/png", "image data".getBytes());
    
    mockMvc.perform(multipart("/images/upload")
                    .file(file)
                    .param("handle", "logo")
                    .param("visibility", "INVALID")
                    .param("ownerId", "user123"))  // Add ownerId
            .andExpect(status().isBadRequest())
            .andExpect(content().string("Invalid visibility"));
}

@Test
void uploadImage_missingFile_returnsBadRequest() throws Exception {
    mockMvc.perform(multipart("/images/upload")
                    .param("handle", "logo")
                    .param("visibility", "PUBLIC"))
            .andExpect(status().isBadRequest());
}

@Test
void resolveReference_missingUserId_returnsBadRequest() throws Exception {
    mockMvc.perform(get("/images/resolve")
                    .param("ref", "logo"))
            .andExpect(status().isBadRequest())
            .andExpect(content().string("User ID required"));
}

@Test
void getImage_missingUserId_returnsBadRequest() throws Exception {
    mockMvc.perform(get("/images/1"))
            .andExpect(status().isBadRequest());
}

@Test
void deleteImage_invalidId_returnsBadRequest() throws Exception {
    doThrow(new IllegalArgumentException("Image not found"))
            .when(imageService).deleteImage(999L, "user123");
    
    mockMvc.perform(delete("/images/999")
                    .header("X-User-Id", "user123"))
            .andExpect(status().isBadRequest())
            .andExpect(content().string("Image not found"));
}
}