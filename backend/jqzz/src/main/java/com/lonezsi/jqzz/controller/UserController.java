package com.lonezsi.jqzz.controller;

import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import jakarta.servlet.http.HttpServletResponse;

import com.lonezsi.jqzz.config.LoginKeyFilter;
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
    public Map<String, Object> register(@RequestBody RegisterRequest request, HttpServletResponse response) {

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
        user.setLoginKey(IdGenerator.loginKey());

        User saved = userRepository.save(user);

        messaging.convertAndSend(
            "/topic/users",
            (Object) Map.of("event", "user_registered", "user", saved)
        );

        keyCookie(response, saved.getLoginKey());
        return self(saved);
    }

    /**
     * Logging in takes the login key. Accounts made before there were keys
     * have none yet: the first login by their id gets one made, and from then
     * on only the key works. (The browser that made the account still holds
     * its id, so that's who gets there first.)
     */
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody LoginRequest request, HttpServletResponse response) {
        User user;
        if (request.getKey() != null && !request.getKey().isBlank()) {
            user = userRepository.findByLoginKey(request.getKey().trim()).orElse(null);
        } else if (request.getId() != null) {
            user = userRepository.findById(request.getId()).orElse(null);
            if (user != null && user.getLoginKey() != null) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "log in with your login key");
            }
            if (user != null) user.setLoginKey(IdGenerator.loginKey());
        } else {
            user = null;
        }
        if (user == null) return ResponseEntity.notFound().build();
        user.setOnline(true);
        User saved = userRepository.save(user);
        messaging.convertAndSend(
            "/topic/users",
            (Object) Map.of("event", "user_logged_in", "user", saved)
        );
        keyCookie(response, saved.getLoginKey());
        return ResponseEntity.ok(self(saved));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestBody LogoutRequest request) {
        if (request.getId() == null) {
            return ResponseEntity.badRequest().build();
        }
        return userRepository.findById(request.getId())
                .map(user -> {
                    user.setOnline(false);
                    userRepository.save(user);
                    messaging.convertAndSend(
                        "/topic/users",
                        (Object) Map.of("event", "user_logged_out", "user", user)
                    );
                    return ResponseEntity.ok().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/handle")
    public ResponseEntity<Map<String, Object>> updateHandle(@PathVariable String id, @RequestBody Map<String,String> body) {

        User user = userRepository.findById(id).orElse(null);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        String newHandle = sanitizeHandle(body.get("handle"));
        if (newHandle == null || isHandleTakenByOther(newHandle, id)) {
            return ResponseEntity.badRequest().build();
        }

        user.setHandle(newHandle);

        User saved = userRepository.save(user);

        messaging.convertAndSend(
            "/topic/users",
            (Object) Map.of("event", "user_updated", "user", saved)
        );

        return ResponseEntity.ok(self(saved));
    }

    @PostMapping("/{id}/name")
    public ResponseEntity<Map<String, Object>> updateName(@PathVariable String id, @RequestBody Map<String,String> body) {
        return userRepository.findById(id)
                .map(user -> {
                    user.setName(body.get("name"));
                    User saved = userRepository.save(user);
                    return ResponseEntity.ok(self(saved));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/update")
    public ResponseEntity<Map<String, Object>> update(@PathVariable String id, @RequestBody Map<String, String> body) {
        return userRepository.findById(id)
                .map(user -> {
                    if (body.containsKey("name")) user.setName(body.get("name"));
                    if (body.containsKey("handle")) {
                        String newHandle = sanitizeHandle(body.get("handle"));
                        if (newHandle == null) {
                            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Handle must contain letters or numbers");
                        }
                        if (isHandleTakenByOther(newHandle, id)) {
                            throw new ResponseStatusException(HttpStatus.CONFLICT, "Handle @" + newHandle + " is already taken");
                        }
                        user.setHandle(newHandle);
                    }
                    if (body.containsKey("email")) user.setEmail(body.get("email"));
                    if (body.containsKey("profilePictureUrl")) user.setProfilePictureUrl(body.get("profilePictureUrl"));

                    User saved = userRepository.save(user);

                    messaging.convertAndSend(
                        "/topic/users",
                        (Object) Map.of("event", "user_updated", "user", saved)
                    );

                    return ResponseEntity.ok(self(saved));
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id,
            @RequestHeader(value = "X-User-Id", required = false) String caller) {
        if (caller == null || !caller.equals(id)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only you can delete your account");
        }
        if (!userRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        userRepository.deleteById(id);
        messaging.convertAndSend(
            "/topic/users",
            (Object) Map.of("event", "user_deleted", "user", Map.of("id", id))
        );
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

    /**
     * The account as its owner sees it: the public record plus the email, which
     * nobody else is sent.
     */
    static Map<String, Object> self(User u) {
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("id", u.getId());
        m.put("handle", u.getHandle());
        m.put("name", u.getName());
        m.put("email", u.getEmail());
        m.put("profilePictureUrl", u.getProfilePictureUrl());
        m.put("online", u.isOnline());
        m.put("googleLinked", u.isGoogleLinked());
        m.put("loginKey", u.getLoginKey());
        return m;
    }

    /**
     * The key as a cookie too, for the requests that can't carry a header:
     * pictures in &lt;img&gt; tags. Script can't read it, and other sites can't
     * make a browser send it with anything but a plain GET.
     */
    static void keyCookie(HttpServletResponse response, String key) {
        if (key == null) return;
        ResponseCookie cookie = ResponseCookie.from(LoginKeyFilter.COOKIE, key)
                .httpOnly(true)
                .sameSite("Lax")
                .path("/")
                .maxAge(java.time.Duration.ofDays(400))
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private static String sanitizeHandle(String raw) {
        if (raw == null) return null;
        String handle = raw.toLowerCase().replaceAll("[^a-z0-9]", "");
        return handle.isEmpty() ? null : handle;
    }

    private boolean isHandleTakenByOther(String handle, String userId) {
        User owner = userRepository.findByHandle(handle);
        return owner != null && !owner.getId().equals(userId);
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
        private String key;
        /** only for accounts from before login keys, once (see login) */
        private String id;

        public String getKey() {
            return key;
        }

        public void setKey(String key) {
            this.key = key;
        }

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