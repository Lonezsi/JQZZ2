package com.lonezsi.jqzz.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * Two people, once. userA is always the smaller id, so a pair has one row
 * however it started. Pending until the one who didn't ask accepts.
 */
@Entity
@Table(name = "friendship", uniqueConstraints = @UniqueConstraint(columnNames = {"user_a", "user_b"}))
public class Friendship {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_a", nullable = false)
    private String userA;

    @Column(name = "user_b", nullable = false)
    private String userB;

    /** who sent the request */
    @Column(nullable = false)
    private String requestedBy;

    private boolean accepted;

    private LocalDateTime createdAt;

    public Friendship() {}

    public Friendship(String one, String other, String requestedBy) {
        boolean first = one.compareTo(other) < 0;
        this.userA = first ? one : other;
        this.userB = first ? other : one;
        this.requestedBy = requestedBy;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getUserA() { return userA; }
    public String getUserB() { return userB; }
    public String getRequestedBy() { return requestedBy; }
    public boolean isAccepted() { return accepted; }
    public void setAccepted(boolean accepted) { this.accepted = accepted; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    /** the one who isn't you */
    public String other(String userId) {
        return userA.equals(userId) ? userB : userA;
    }
}
