package com.lonezsi.jqzz.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/**
 * Something someone did that you should hear about: a friend request, a
 * friend saying yes, an invite to a game. Kept until read, and after, so your
 * profile can list them all; it waits for you if you weren't there.
 *
 * kind is plain text rather than an enum column, so a new kind never needs
 * the table changed (H2 keeps enum columns to the values they started with).
 */
@Entity
@Table(name = "notification", indexes = @Index(columnList = "user_id"))
public class Notification {

    public static final String FRIEND_REQUEST = "FRIEND_REQUEST";
    public static final String FRIEND_ACCEPTED = "FRIEND_ACCEPTED";
    /** your first finished game on an account only this browser can get back into */
    public static final String GUEST_ACCOUNT = "GUEST_ACCOUNT";
    public static final String INVITE = "INVITE";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** whose it is */
    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(nullable = false, length = 32)
    private String kind;

    /** who it's from */
    private String fromId;

    /** anything the kind needs, as JSON: an invite's game code and quiz name */
    @Column(length = 2000)
    private String payload;

    private LocalDateTime createdAt;

    /** null while unread */
    private LocalDateTime readAt;

    public Notification() {}

    public Notification(String userId, String kind, String fromId, String payload) {
        this.userId = userId;
        this.kind = kind;
        this.fromId = fromId;
        this.payload = payload;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getUserId() { return userId; }
    public String getKind() { return kind; }
    public String getFromId() { return fromId; }
    public String getPayload() { return payload; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getReadAt() { return readAt; }
    public boolean isRead() { return readAt != null; }
    public void markRead() { if (readAt == null) readAt = LocalDateTime.now(); }
}
