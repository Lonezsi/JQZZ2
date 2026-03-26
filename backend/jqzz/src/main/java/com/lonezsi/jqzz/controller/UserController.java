package com.lonezsi.jqzz.controller;

import java.util.Map;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.http.ResponseEntity;

import com.lonezsi.jqzz.model.User;
import com.lonezsi.jqzz.repository.UserRepository;
import com.lonezsi.jqzz.util.IdGenerator;


@RestController
@RequestMapping("/users")
public class UserController {

    private final UserRepository userRepository;
    private final SimpMessagingTemplate messaging;

    public UserController(UserRepository userRepository, SimpMessagingTemplate messaging) {
        this.userRepository = userRepository;
        this.messaging = messaging;
    }

    @PostMapping("/register")
    public User register(@RequestBody RegisterRequest request) {

        String id = IdGenerator.generateId();

        String baseHandle = IdGenerator.generateHandle(request.getName());
        String handle = baseHandle;

        int attempts = 0;
        while(userRepository.existsByHandle(handle)){
            handle = baseHandle + IdGenerator.random(1);
            attempts++;
            if(attempts > 5){
                handle = baseHandle + IdGenerator.random(attempts - 4);
                break;
            }
            if(attempts > 10){
                handle = "user" + IdGenerator.random(5);
                break;
            }
        }

        User user = new User();
        user.setId(id);
        user.setName(request.getName());
        user.setHandle(handle);
        user.setOnline(true);

        User saved = userRepository.save(user);

        messaging.convertAndSend(
            "/topic/users",
            (Object) Map.of("event", "user_registered", "user", saved)
        );

        return saved;
    }

    @PostMapping("/login")
    public ResponseEntity<User> login(@RequestBody LoginRequest request) {
        return userRepository.findById(request.getId())
                .map(user -> {
                    user.setOnline(true);
                    User saved = userRepository.save(user);
                    messaging.convertAndSend(
                        "/topic/users",
                        (Object) Map.of("event", "user_logged_in", "user", saved)
                    );
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/logout")
    public void logout(@RequestBody LogoutRequest request) {
        User user = userRepository.findById(request.getId()).orElseThrow();
        user.setOnline(false);

        userRepository.save(user);

        messaging.convertAndSend(
            "/topic/users",
            (Object) Map.of("event", "user_logged_out", "user", user)
        );
    }

    @PostMapping("/{id}/handle")
    public ResponseEntity<User> updateHandle(@PathVariable String id, @RequestBody Map<String,String> body) {

        String newHandle = body.get("handle")
            .toLowerCase()
            .replaceAll("[^a-z0-9]", "");

        if(userRepository.existsByHandle(newHandle)){
            return ResponseEntity.badRequest().build();
        }

        User user = userRepository.findById(id).orElseThrow();
        user.setHandle(newHandle);

        User saved = userRepository.save(user);

        messaging.convertAndSend(
            "/topic/users",
            (Object) Map.of("event", "user_updated", "user", saved)
        );

        return ResponseEntity.ok(saved);
    }

    @PostMapping("/{id}/name")
    public ResponseEntity<User> updateName(@PathVariable String id, @RequestBody Map<String,String> body) {
        return userRepository.findById(id)
                .map(user -> {
                    user.setName(body.get("name"));
                    User saved = userRepository.save(user);
                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/update")
    public ResponseEntity<User> update(@PathVariable String id, @RequestBody Map<String, String> body) {
        return userRepository.findById(id)
                .map(user -> {
                    if (body.containsKey("name")) user.setName(body.get("name"));
                    if (body.containsKey("handle")) user.setHandle(body.get("handle"));
                    if (body.containsKey("email")) user.setEmail(body.get("email"));
                    if (body.containsKey("profilePictureUrl")) user.setProfilePictureUrl(body.get("profilePictureUrl"));

                    User saved = userRepository.save(user);

                    messaging.convertAndSend(
                        "/topic/users",
                        (Object) Map.of("event", "user_updated", "user", saved)
                    );

                    return ResponseEntity.ok(saved);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        if (!userRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        userRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public Iterable<User> getAll() {
        return userRepository.findAll();
    }

    @GetMapping("/{userId}")
    public ResponseEntity<User> getOne(@PathVariable String userId) {
        return userRepository.findById(userId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    public static class RegisterRequest {
        private String name;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }
    }

    public static class RegisterResponse {
        private String userId;

        public RegisterResponse(String userId) {
            this.userId = userId;
        }

        public String getUserId() {
            return userId;
        }

        public void setUserId(String userId) {
            this.userId = userId;
        }
    }

    public static class LoginRequest {
        private String id;

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }
    }

    public static class LogoutRequest {
        private String id;

        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }
    }
}