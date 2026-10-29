package com.lonezsi.jqzz.controller;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.lonezsi.jqzz.model.Friendship;
import com.lonezsi.jqzz.model.Notification;
import com.lonezsi.jqzz.model.User;
import com.lonezsi.jqzz.repository.FriendshipRepository;
import com.lonezsi.jqzz.repository.UserRepository;
import com.lonezsi.jqzz.service.NotificationService;

/**
 * Friends. Asking someone who already asked you makes you friends; removing
 * works for friends, requests you sent, and requests you got. Both sides hear
 * about every change on /topic/friends/{userId}.
 */
@RestController
@RequestMapping("/friends")
public class FriendController {

    private final FriendshipRepository friendships;
    private final UserRepository users;
    private final SimpMessagingTemplate messaging;
    private final NotificationService notifications;

    public FriendController(FriendshipRepository friendships, UserRepository users, SimpMessagingTemplate messaging,
            NotificationService notifications) {
        this.friendships = friendships;
        this.users = users;
        this.messaging = messaging;
        this.notifications = notifications;
    }

    /** {friends, incoming, outgoing}: people, with whether they're online */
    @GetMapping
    @Transactional(readOnly = true)
    public Map<String, Object> list(@RequestHeader(value = "X-User-Id", required = false) String userId) {
        return listOf(require(userId));
    }

    Map<String, Object> listOf(String userId) {
        List<Map<String, Object>> friends = new ArrayList<>(), incoming = new ArrayList<>(), outgoing = new ArrayList<>();
        for (Friendship f : friendships.involving(userId)) {
            String other = f.other(userId);
            Map<String, Object> person = person(other);
            if (person == null) continue; // they deleted their account
            if (f.isAccepted()) friends.add(person);
            else if (f.getRequestedBy().equals(userId)) outgoing.add(person);
            else incoming.add(person);
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("friends", friends);
        m.put("incoming", incoming);
        m.put("outgoing", outgoing);
        return m;
    }

    /** Ask, or accept when they asked first. */
    @PostMapping("/{otherId}")
    @Transactional
    public Map<String, Object> add(@RequestHeader(value = "X-User-Id", required = false) String userId,
                                   @PathVariable String otherId) {
        require(userId);
        if (userId.equals(otherId)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That's you");
        if (!users.existsById(otherId)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No such person");
        Friendship f = friendships.between(userId, otherId).orElse(null);
        if (f == null) {
            friendships.save(new Friendship(userId, otherId, userId));
            notifications.notify(otherId, Notification.FRIEND_REQUEST, userId, null);
        } else if (!f.isAccepted() && !f.getRequestedBy().equals(userId)) {
            f.setAccepted(true);
            friendships.save(f);
            // their request is answered, and they hear that it was a yes
            notifications.settle(userId, Notification.FRIEND_REQUEST, otherId);
            notifications.notify(otherId, Notification.FRIEND_ACCEPTED, userId, null);
        }
        tell(userId, otherId);
        return listOf(userId);
    }

    /** Unfriend, take back a request, or turn one down. */
    @DeleteMapping("/{otherId}")
    @Transactional
    public Map<String, Object> remove(@RequestHeader(value = "X-User-Id", required = false) String userId,
                                      @PathVariable String otherId) {
        require(userId);
        friendships.between(userId, otherId).ifPresent(friendships::delete);
        // a request taken back or turned down needs no answer any more, on either side
        notifications.settle(userId, Notification.FRIEND_REQUEST, otherId);
        notifications.settle(otherId, Notification.FRIEND_REQUEST, userId);
        tell(userId, otherId);
        return listOf(userId);
    }

    /** "friends", "incoming", "outgoing" or "none": how two people stand */
    String status(String viewerId, String userId) {
        if (viewerId == null || viewerId.equals(userId)) return "self";
        return friendships.between(viewerId, userId)
                .map(f -> f.isAccepted() ? "friends" : f.getRequestedBy().equals(viewerId) ? "outgoing" : "incoming")
                .orElse("none");
    }

    private void tell(String... userIds) {
        for (String id : userIds) messaging.convertAndSend("/topic/friends/" + id, (Object) Map.of("changed", true));
    }

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

    private static String require(String userId) {
        if (userId == null || userId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId is required");
        }
        return userId;
    }
}
