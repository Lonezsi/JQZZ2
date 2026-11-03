package com.lonezsi.jqzz.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/**
 * One way into an account: the hash of a login key, never the key. An account
 * can have several (a new one each time Google signs it in somewhere), and any
 * of them works, so signing in on one device doesn't sign out another.
 */
@Entity
@Table(name = "login_key", indexes = @Index(columnList = "user_id"))
public class LoginKey {

    /** see service.LoginKeys.hash */
    @Id
    @Column(length = 80)
    private String hash;

    @Column(name = "user_id", nullable = false)
    private String userId;

    private LocalDateTime createdAt;

    public LoginKey() {}

    public LoginKey(String hash, String userId) {
        this.hash = hash;
        this.userId = userId;
        this.createdAt = LocalDateTime.now();
    }

    public String getHash() { return hash; }
    public String getUserId() { return userId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
