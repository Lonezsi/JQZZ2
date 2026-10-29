package com.lonezsi.jqzz.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.lonezsi.jqzz.model.Notification;
import com.lonezsi.jqzz.model.User;
import com.lonezsi.jqzz.repository.NotificationRepository;
import com.lonezsi.jqzz.repository.UserRepository;

import tools.jackson.databind.json.JsonMapper;

/**
 * Notifications: kept, then told. Whenever someone's list changes, the server
 * says so on /topic/notify/{userId} and their app fetches the list again; whatever
 * is new slides in. Someone who wasn't there gets theirs when they next open
 * the app.
 */
@Service
public class NotificationService {

    private final NotificationRepository notifications;
    private final UserRepository users;
    private final SimpMessagingTemplate messaging;
    private final JsonMapper json;

    public NotificationService(NotificationRepository notifications, UserRepository users,
            SimpMessagingTemplate messaging, JsonMapper json) {
        this.notifications = notifications;
        this.users = users;
        this.messaging = messaging;
        this.json = json;
    }

    /** a new one for userId, from fromId */
    @Transactional
    public void notify(String userId, String kind, String fromId, Map<String, Object> payload) {
        if (userId == null || userId.equals(fromId)) return;
        String body = payload == null || payload.isEmpty() ? null : json.writeValueAsString(payload);
        notifications.save(new Notification(userId, kind, fromId, body));
        tell(userId);
    }

    /** that kind from that person no longer needs an answer: read, quietly */
    @Transactional
    public void settle(String userId, String kind, String fromId) {
        List<Notification> open = notifications.findByUserIdAndKindAndFromIdAndReadAtIsNull(userId, kind, fromId);
        if (open.isEmpty()) return;
        open.forEach(Notification::markRead);
        notifications.saveAll(open);
        tell(userId);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(String userId) {
        List<Map<String, Object>> out = new ArrayList<>();
        Map<String, Map<String, Object>> people = new LinkedHashMap<>();
        for (Notification n : notifications.findTop100ByUserIdOrderByCreatedAtDescIdDesc(userId)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", n.getId());
            m.put("kind", n.getKind());
            m.put("from", n.getFromId() == null ? null : people.computeIfAbsent(n.getFromId(), this::person));
            m.put("payload", n.getPayload() == null ? Map.of() : json.readValue(n.getPayload(), Map.class));
            m.put("createdAt", n.getCreatedAt() == null ? null : n.getCreatedAt().toString());
            m.put("read", n.isRead());
            out.add(m);
        }
        return out;
    }

    @Transactional
    public void read(String userId, Long id) {
        Notification n = notifications.findById(id == null ? -1 : id)
                .filter(x -> x.getUserId().equals(userId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such notification"));
        if (n.isRead()) return;
        n.markRead();
        notifications.save(n);
        tell(userId);
    }

    @Transactional
    public void readAll(String userId) {
        List<Notification> open = notifications.findByUserIdAndReadAtIsNull(userId);
        if (open.isEmpty()) return;
        open.forEach(Notification::markRead);
        notifications.saveAll(open);
        tell(userId);
    }

    private void tell(String userId) {
        messaging.convertAndSend("/topic/notify/" + userId, (Object) Map.of("changed", true));
    }

    /** who it's from, as the app shows people; null once they've deleted themselves */
    private Map<String, Object> person(String id) {
        User u = users.findById(id).orElse(null);
        if (u == null) return null;
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("id", u.getId());
        p.put("name", u.getName());
        p.put("handle", u.getHandle());
        p.put("profilePictureUrl", u.getProfilePictureUrl());
        p.put("online", u.isOnline());
        return p;
    }
}
