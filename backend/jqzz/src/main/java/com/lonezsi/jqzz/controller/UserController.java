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
import com.lonezsi.jqzz.service.LoginKeys;
import com.lonezsi.jqzz.model.User;
import com.lonezsi.jqzz.repository.UserRepository;
import com.lonezsi.jqzz.util.IdGenerator;


@RestController
@RequestMapping("/users")
public class UserController {

    private final UserRepository userRepository;
    private final SimpMessagingTemplate messaging;
    private final LoginKeys keys;
    private final com.lonezsi.jqzz.service.AccountEraser eraser;

    private final com.lonezsi.jqzz.config.KeyCookie cookie;
    /** field-injected (not in the constructor) so a plain unit test builds it with keys off */
    @org.springframework.beans.factory.annotation.Value("${jqzz.auth.enforce-login-key:true}")
    private boolean enforced;

    public UserController(UserRepository userRepository, SimpMessagingTemplate messaging, LoginKeys keys,
            com.lonezsi.jqzz.service.AccountEraser eraser, com.lonezsi.jqzz.config.KeyCookie cookie) {
        this.eraser = eraser;
        this.cookie = cookie;
        this.userRepository = userRepository;
        this.messaging = messaging;
        this.keys = keys;
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

        User saved = userRepository.save(user);
        String key = keys.issue(saved.getId());

        messaging.convertAndSend(
            "/topic/users",
            (Object) Map.of("event", "user_registered", "user", saved)
        );

        cookie.set(response, key);
        return self(saved, key);
    }

    /**
     * Logging in takes the login key, and only that: an id is public, so it
     * never gets anyone a key. An account from before keys existed gets its
     * key from the admin panel (POST /admin/users/{id}/key).
     */
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody LoginRequest request, HttpServletResponse response) {
        User user;
        String key = null;
        if (request.getKey() != null && !request.getKey().isBlank()) {
            key = request.getKey().trim();
            user = keys.owner(key).flatMap(userRepository::findById).orElse(null);
        } else if (request.getId() != null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                    "log in with your login key; an account from before keys gets one from the admin");
        } else {
            user = null;
        }
        if (user == null) return ResponseEntity.notFound().build();
        user.setOnline(true);
        User saved = userRepository.save(user);
        if (!saved.isAdmin()) {
            messaging.convertAndSend(
                "/topic/users",
                (Object) Map.of("event", "user_logged_in", "user", saved)
            );
        }
        cookie.set(response, key);
        return ResponseEntity.ok(self(saved, key));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestBody LogoutRequest request, HttpServletResponse response) {
        if (request.getId() == null) {
            return ResponseEntity.badRequest().build();
        }
        cookie.clear(response);
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
        eraser.erase(id);
        messaging.convertAndSend(
            "/topic/users",
            (Object) Map.of("event", "user_deleted", "user", Map.of("id", id))
        );
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public Iterable<User> getAll(@org.springframework.web.bind.annotation.RequestAttribute(value = LoginKeyFilter.USER, required = false) String me) {
        needKey(me);
        // the admin account isn't one of the people
        return userRepository.findAll().stream().filter(u -> !u.isAdmin()).toList();
    }

    /** who the login key in this request's cookie is, with the key: how a page load finds its account without keeping the key */
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(jakarta.servlet.http.HttpServletRequest request,
            @org.springframework.web.bind.annotation.RequestAttribute(value = LoginKeyFilter.USER, required = false) String me) {
        if (me == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "no login key");
        return userRepository.findById(me).map(user -> {
            user.setOnline(true);
            return ResponseEntity.ok(self(userRepository.save(user), LoginKeyFilter.keyOf(request)));
        }).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{userId}")
    public ResponseEntity<User> getOne(@PathVariable String userId,
            @org.springframework.web.bind.annotation.RequestAttribute(value = LoginKeyFilter.USER, required = false) String me) {
        needKey(me);
        return userRepository.findById(userId)
                .filter(u -> !u.isAdmin())
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** the people list is for people with a key (every visitor has a guest one), not for the whole internet */
    private void needKey(String me) {
        if (enforced && me == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "log in again: this needs your login key");
    }

    static Map<String, Object> self(User u) {
        return self(u, null);
    }

    /**
     * The account as its owner sees it: the public record plus the email, which
     * nobody else is sent. The login key only when there is one to hand over:
     * the server keeps its hash, so it can repeat a key it was just given, or
     * one it just made, and never any other.
     */
    static Map<String, Object> self(User u, String key) {
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("id", u.getId());
        m.put("handle", u.getHandle());
        m.put("name", u.getName());
        m.put("email", u.getEmail());
        m.put("profilePictureUrl", u.getProfilePictureUrl());
        m.put("online", u.isOnline());
        m.put("googleLinked", u.isGoogleLinked());
        m.put("foyerLinked", u.isFoyerLinked());
        if (key != null) m.put("loginKey", key);
        if (u.isAdmin()) m.put("admin", true);
        return m;
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