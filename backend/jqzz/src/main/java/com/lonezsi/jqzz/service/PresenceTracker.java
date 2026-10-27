package com.lonezsi.jqzz.service;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import com.lonezsi.jqzz.model.User;
import com.lonezsi.jqzz.repository.UserRepository;

/**
 * Derives the online flag from open WebSocket sessions. Clients send their user
 * id as a "userId" STOMP CONNECT header; a user stays online while at least one
 * of their sessions (tabs) is connected. This also covers crashed browsers and
 * closed laptops, where no logout request would ever arrive.
 */
@Component
public class PresenceTracker {

    private final UserRepository userRepository;
    private final SimpMessagingTemplate messaging;

    private final Map<String, String> userBySession = new HashMap<>();
    private final Map<String, Set<String>> sessionsByUser = new HashMap<>();

    public PresenceTracker(UserRepository userRepository, SimpMessagingTemplate messaging) {
        this.userRepository = userRepository;
        this.messaging = messaging;
    }

    /** Nobody is connected right after startup, whatever the database says. */
    @EventListener(ApplicationReadyEvent.class)
    public void resetPresence() {
        List<User> stale = userRepository.findAll().stream().filter(User::isOnline).toList();
        stale.forEach(user -> user.setOnline(false));
        userRepository.saveAll(stale);
    }

    @EventListener
    public synchronized void onConnect(SessionConnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String userId = accessor.getFirstNativeHeader("userId");
        String sessionId = accessor.getSessionId();
        if (userId == null || userId.isBlank() || sessionId == null) return;

        userBySession.put(sessionId, userId);
        Set<String> sessions = sessionsByUser.computeIfAbsent(userId, k -> new HashSet<>());
        sessions.add(sessionId);
        if (sessions.size() == 1) setOnline(userId, true);
    }

    @EventListener
    public synchronized void onDisconnect(SessionDisconnectEvent event) {
        String userId = userBySession.remove(event.getSessionId());
        if (userId == null) return;

        Set<String> sessions = sessionsByUser.get(userId);
        if (sessions != null) {
            sessions.remove(event.getSessionId());
            if (!sessions.isEmpty()) return;
            sessionsByUser.remove(userId);
        }
        setOnline(userId, false);
    }

    /** Whether this user has at least one tab connected right now. */
    public synchronized boolean isOnline(String userId) {
        Set<String> sessions = sessionsByUser.get(userId);
        return sessions != null && !sessions.isEmpty();
    }

    private void setOnline(String userId, boolean online) {
        userRepository.findById(userId).ifPresent(user -> {
            if (user.isOnline() == online) return;
            user.setOnline(online);
            User saved = userRepository.save(user);
            messaging.convertAndSend(
                "/topic/users",
                (Object) Map.of("event", online ? "user_logged_in" : "user_logged_out", "user", saved)
            );
        });
    }
}
