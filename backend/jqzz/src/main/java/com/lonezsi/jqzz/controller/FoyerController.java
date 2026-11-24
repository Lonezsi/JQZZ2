package com.lonezsi.jqzz.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.lonezsi.jqzz.model.User;
import com.lonezsi.jqzz.repository.UserRepository;
import com.lonezsi.jqzz.service.FoyerAuth;
import com.lonezsi.jqzz.service.LoginKeys;
import com.lonezsi.jqzz.util.IdGenerator;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Signing in with Foyer, the home server's one sign-in (FoyerAuth). The same shape as
 * Google: an account tied to a Foyer account opens with it, and a new face gets an account
 * made from it. Opened from Foyer, nobody has to log in here at all.
 *
 * GET    /users/foyer          {foyer: {handle, name}} or {foyer: null}: who Foyer says it is
 * POST   /users/foyer/login    the account tied to that Foyer account, or a new one
 * POST   /users/{id}/foyer     tie this account to the Foyer account signed in now
 * DELETE /users/{id}/foyer     untie it
 */
@RestController
@RequestMapping("/users")
public class FoyerController {

    private final FoyerAuth foyer;
    private final UserRepository users;
    private final SimpMessagingTemplate messaging;
    private final LoginKeys keys;

    private final com.lonezsi.jqzz.config.KeyCookie cookie;

    public FoyerController(FoyerAuth foyer, UserRepository users, SimpMessagingTemplate messaging, LoginKeys keys,
            com.lonezsi.jqzz.config.KeyCookie cookie) {
        this.cookie = cookie;
        this.foyer = foyer;
        this.users = users;
        this.messaging = messaging;
        this.keys = keys;
    }

    private FoyerAuth.Account signedIn(HttpServletRequest request) {
        return foyer.who(request).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not signed in on Foyer"));
    }

    @GetMapping("/foyer")
    public Map<String, Object> who(HttpServletRequest request) {
        Map<String, Object> out = new HashMap<>();
        out.put("foyer", foyer.who(request).map(a -> Map.of("handle", a.handle(), "name", a.name())).orElse(null));
        return out;
    }

    /** Signed in on Foyer: the account tied to it, or a fresh one made from it. */
    @PostMapping("/foyer/login")
    @Transactional
    public Map<String, Object> login(HttpServletRequest request, HttpServletResponse response) {
        FoyerAuth.Account account = signedIn(request);
        User user = users.findByFoyerId(account.id()).orElse(null);
        boolean fresh = user == null;
        if (fresh) {
            user = new User();
            user.setId(IdGenerator.generateId());
            String name = account.name() == null || account.name().isBlank() ? account.handle() : account.name().trim();
            user.setName(name);
            user.setHandle(freeHandle(account.handle().isBlank() ? name : account.handle()));
            user.setFoyerId(account.id());
        }
        user.setOnline(true);
        User saved = users.save(user);
        // a key of its own for this browser: the others stay signed in
        String key = keys.issue(saved.getId());
        messaging.convertAndSend("/topic/users",
                (Object) Map.of("event", fresh ? "user_registered" : "user_logged_in", "user", saved));
        cookie.set(response, key);
        return UserController.self(saved, key);
    }

    /** This account, tied to whoever is signed in on Foyer. */
    @PostMapping("/{id}/foyer")
    @Transactional
    public Map<String, Object> link(@PathVariable String id, HttpServletRequest request) {
        User user = users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such user"));
        FoyerAuth.Account account = signedIn(request);
        users.findByFoyerId(account.id()).filter(other -> !other.getId().equals(id)).ifPresent(other -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "That Foyer account is already tied to " + other.getName());
        });
        user.setFoyerId(account.id());
        // a made-up guest name gives way to their own
        if (user.getName() != null && user.getName().endsWith("(guest)") && !account.name().isBlank()) {
            user.setName(account.name().trim());
        }
        User saved = users.save(user);
        messaging.convertAndSend("/topic/users", (Object) Map.of("event", "user_updated", "user", saved));
        return UserController.self(saved);
    }

    @DeleteMapping("/{id}/foyer")
    @Transactional
    public Map<String, Object> unlink(@PathVariable String id) {
        User user = users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such user"));
        user.setFoyerId(null);
        return UserController.self(users.save(user));
    }

    private String freeHandle(String name) {
        String base = IdGenerator.generateHandle(name);
        String handle = base;
        for (int i = 1; users.existsByHandle(handle); i++) {
            handle = i > 6 ? "user" + IdGenerator.random(5) : base + IdGenerator.random(Math.min(i, 3));
        }
        return handle;
    }
}
