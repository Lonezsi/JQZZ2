package com.lonezsi.jqzz.service;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.BiConsumer;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;
import org.springframework.web.socket.messaging.SessionUnsubscribeEvent;

import com.lonezsi.jqzz.model.User;
import com.lonezsi.jqzz.repository.UserRepository;

/**
 * Derives the online flag from open WebSocket sessions. Clients send their user
 * id as a "userId" STOMP CONNECT header; a user stays online while at least one
 * of their sessions (tabs) is connected. This also covers crashed browsers and
 * closed laptops, where no logout request would ever arrive.
 *
 * It also knows who is watching which game: a tab subscribed to
 * /topic/play/{code} is someone at that game. Being online elsewhere in the
 * app (the editor, a profile) doesn't count as being at the game.
 */
@Component
public class PresenceTracker {

    private final UserRepository userRepository;
    private final SimpMessagingTemplate messaging;

    private final Map<String, String> userBySession = new HashMap<>();
    private final Map<String, Set<String>> sessionsByUser = new HashMap<>();
    /** session -> subscription id -> game code */
    private final Map<String, Map<String, String>> watchesBySession = new HashMap<>();
    private final List<BiConsumer<String, String>> watchListeners = new CopyOnWriteArrayList<>();

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
    public void onDisconnect(SessionDisconnectEvent event) {
        String userId;
        Map<String, String> watched;
        synchronized (this) {
            userId = userBySession.remove(event.getSessionId());
            watched = watchesBySession.remove(event.getSessionId());
            if (userId == null) return;
            Set<String> sessions = sessionsByUser.get(userId);
            boolean last = true;
            if (sessions != null) {
                sessions.remove(event.getSessionId());
                last = sessions.isEmpty();
                if (last) sessionsByUser.remove(userId);
            }
            if (last) setOnline(userId, false);
        }
        if (watched != null) watched.values().stream().distinct().forEach(code -> tell(code, userId));
    }

    /** A tab started watching a game. */
    @EventListener
    public void onSubscribe(SessionSubscribeEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String code = gameOf(accessor.getDestination());
        if (code == null) return;
        String userId;
        synchronized (this) {
            userId = userBySession.get(accessor.getSessionId());
            if (userId == null) return;
            watchesBySession.computeIfAbsent(accessor.getSessionId(), k -> new HashMap<>())
                    .put(accessor.getSubscriptionId(), code);
        }
        tell(code, userId);
    }

    /** A tab stopped watching (left the game's screen without closing). */
    @EventListener
    public void onUnsubscribe(SessionUnsubscribeEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String code;
        String userId;
        synchronized (this) {
            Map<String, String> watches = watchesBySession.get(accessor.getSessionId());
            code = watches == null ? null : watches.remove(accessor.getSubscriptionId());
            userId = userBySession.get(accessor.getSessionId());
        }
        if (code != null && userId != null) tell(code, userId);
    }

    /** Whether this user has a tab on this game right now. */
    public synchronized boolean isWatching(String userId, String code) {
        Set<String> sessions = sessionsByUser.get(userId);
        if (sessions == null) return false;
        for (String session : sessions) {
            Map<String, String> watches = watchesBySession.get(session);
            if (watches != null && watches.containsValue(code)) return true;
        }
        return false;
    }

    /** Called with (game code, user id) whenever someone starts or stops watching a game. */
    public void onWatchChange(BiConsumer<String, String> listener) {
        watchListeners.add(listener);
    }

    private void tell(String code, String userId) {
        for (BiConsumer<String, String> l : watchListeners) {
            try {
                l.accept(code, userId);
            } catch (RuntimeException e) {
                System.err.println("presence: a watcher failed for " + code + ": " + e);
            }
        }
    }

    private static String gameOf(String destination) {
        String prefix = "/topic/play/";
        if (destination == null || !destination.startsWith(prefix)) return null;
        String code = destination.substring(prefix.length()).trim().toUpperCase();
        // /topic/play/{code} only: a game's side channels (its doodles) aren't watching it
        return code.isEmpty() || code.contains("/") ? null : code;
    }

    /** Who a connection belongs to, from its CONNECT; null if it never said. */
    public synchronized String userOf(String sessionId) {
        return sessionId == null ? null : userBySession.get(sessionId);
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
