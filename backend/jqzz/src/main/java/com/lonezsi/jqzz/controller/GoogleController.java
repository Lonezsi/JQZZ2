package com.lonezsi.jqzz.controller;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.lonezsi.jqzz.model.Notification;
import com.lonezsi.jqzz.model.User;
import com.lonezsi.jqzz.repository.UserRepository;
import com.lonezsi.jqzz.service.GoogleAuth;
import com.lonezsi.jqzz.service.NotificationService;
import com.lonezsi.jqzz.util.IdGenerator;

/**
 * Tying an account to Google, so it isn't only reachable from the browser it
 * was made in.
 *
 * GET    /users/google/config          {clientId}: empty when Google sign-in is off
 * POST   /users/google/login           {credential}  the account tied to it, or a new one
 * POST   /users/{id}/google            {credential}  tie this account to that Google account
 * DELETE /users/{id}/google                           untie it (back to a guest account)
 */
@RestController
@RequestMapping("/users")
public class GoogleController {

    private final GoogleAuth google;
    private final UserRepository users;
    private final NotificationService notifications;
    private final SimpMessagingTemplate messaging;

    public GoogleController(GoogleAuth google, UserRepository users, NotificationService notifications,
            SimpMessagingTemplate messaging) {
        this.google = google;
        this.users = users;
        this.notifications = notifications;
        this.messaging = messaging;
    }

    @GetMapping("/google/config")
    public Map<String, Object> config() {
        return Map.of("clientId", google.clientId());
    }

    /** Signed in with Google: the account tied to it, or a fresh one made from it. */
    @PostMapping("/google/login")
    @Transactional
    public User login(@RequestBody Map<String, String> body) {
        GoogleAuth.Account account = google.verify(body.get("credential"));
        User user = users.findByGoogleSub(account.sub()).orElse(null);
        boolean fresh = user == null;
        if (fresh) {
            user = new User();
            user.setId(IdGenerator.generateId());
            String name = account.name() == null || account.name().isBlank() ? "player" : account.name().trim();
            user.setName(name);
            user.setHandle(freeHandle(name));
            user.setGoogleSub(account.sub());
            user.setEmail(account.email());
            user.setProfilePictureUrl(account.picture());
        }
        user.setOnline(true);
        User saved = users.save(user);
        messaging.convertAndSend("/topic/users",
                (Object) Map.of("event", fresh ? "user_registered" : "user_logged_in", "user", saved));
        return saved;
    }

    /** This account, tied to the Google account that just signed in. */
    @PostMapping("/{id}/google")
    @Transactional
    public User link(@PathVariable String id, @RequestBody Map<String, String> body) {
        User user = users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such user"));
        GoogleAuth.Account account = google.verify(body.get("credential"));
        users.findByGoogleSub(account.sub()).filter(other -> !other.getId().equals(id)).ifPresent(other -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "That Google account is already tied to " + other.getName() + ". Log in with Google to use it");
        });
        user.setGoogleSub(account.sub());
        if (user.getEmail() == null || user.getEmail().isBlank()) user.setEmail(account.email());
        // a made-up guest name gives way to their own
        if (user.getName() != null && user.getName().endsWith("(guest)") && account.name() != null && !account.name().isBlank()) {
            user.setName(account.name().trim());
        }
        User saved = users.save(user);
        // nothing left to warn them about
        notifications.settle(id, Notification.GUEST_ACCOUNT, null);
        messaging.convertAndSend("/topic/users", (Object) Map.of("event", "user_updated", "user", saved));
        return saved;
    }

    @DeleteMapping("/{id}/google")
    @Transactional
    public User unlink(@PathVariable String id) {
        User user = users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such user"));
        user.setGoogleSub(null);
        return users.save(user);
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
