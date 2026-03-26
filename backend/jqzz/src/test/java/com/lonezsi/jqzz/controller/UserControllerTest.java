package com.lonezsi.jqzz.controller;

import com.lonezsi.jqzz.model.User;
import com.lonezsi.jqzz.repository.UserRepository;
import com.lonezsi.jqzz.util.IdGenerator;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Arrays;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class UserControllerTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private SimpMessagingTemplate messaging;

    @InjectMocks
    private UserController userController;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(userController).build();
    }

    @Test
    void register_success() throws Exception {
        User user = new User();
        user.setId("test123");
        user.setName("Test User");
        user.setHandle("testuser");
        user.setOnline(true);

        when(userRepository.existsByHandle(any())).thenReturn(false);
        when(userRepository.save(any(User.class))).thenReturn(user);

        mockMvc.perform(post("/users/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Test User\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("test123"))
                .andExpect(jsonPath("$.name").value("Test User"))
                .andExpect(jsonPath("$.handle").value("testuser"))
                .andExpect(jsonPath("$.online").value(true));
    }

    @Test
    void login_success() throws Exception {
        User user = new User();
        user.setId("test123");
        user.setName("Test User");
        user.setHandle("testuser");
        user.setOnline(false);

        when(userRepository.findById("test123")).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenReturn(user);

        mockMvc.perform(post("/users/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"test123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("test123"))
                .andExpect(jsonPath("$.online").value(true));
    }

    @Test
    void login_userNotFound_throwsException() throws Exception {
        when(userRepository.findById("nonexistent")).thenReturn(Optional.empty());

        mockMvc.perform(post("/users/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"nonexistent\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void logout_success() throws Exception {
        User user = new User();
        user.setId("test123");
        user.setOnline(true);

        when(userRepository.findById("test123")).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenReturn(user);

        mockMvc.perform(post("/users/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":\"test123\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void updateHandle_success() throws Exception {
        User user = new User();
        user.setId("test123");
        user.setHandle("oldhandle");
        user.setName("Test User");

        when(userRepository.findById("test123")).thenReturn(Optional.of(user));
        when(userRepository.existsByHandle("newhandle")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenReturn(user);

        mockMvc.perform(post("/users/test123/handle")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"handle\":\"newhandle\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.handle").value("newhandle"));
    }

    @Test
    void updateHandle_duplicate_throwsException() throws Exception {
        User user = new User();
        user.setId("test123");
        user.setHandle("oldhandle");

        // Use lenient() to avoid unnecessary stubbing error
        lenient().when(userRepository.findById("test123")).thenReturn(Optional.of(user));
        when(userRepository.existsByHandle("existing")).thenReturn(true);

        mockMvc.perform(post("/users/test123/handle")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"handle\":\"existing\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getAllUsers_returnsList() throws Exception {
        User user1 = new User();
        user1.setId("user1");
        user1.setName("User One");
        
        User user2 = new User();
        user2.setId("user2");
        user2.setName("User Two");

        when(userRepository.findAll()).thenReturn(Arrays.asList(user1, user2));

        mockMvc.perform(get("/users"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value("user1"))
                .andExpect(jsonPath("$[1].id").value("user2"));
    }

    @Test
    void getUserById_success() throws Exception {
        User user = new User();
        user.setId("test123");
        user.setName("Test User");

        when(userRepository.findById("test123")).thenReturn(Optional.of(user));

        mockMvc.perform(get("/users/test123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("test123"))
                .andExpect(jsonPath("$.name").value("Test User"));
    }

    @Test
    void getUserById_notFound_throwsException() throws Exception {
        when(userRepository.findById("nonexistent")).thenReturn(Optional.empty());

        mockMvc.perform(get("/users/nonexistent"))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteUser_success() throws Exception {
        // First, mock that the user exists
        when(userRepository.existsById("test123")).thenReturn(true);
        
        mockMvc.perform(delete("/users/test123"))
                .andExpect(status().isNoContent());  // Change from 200 to 204
    }
}