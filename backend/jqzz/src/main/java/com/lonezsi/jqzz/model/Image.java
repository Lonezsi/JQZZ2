package com.lonezsi.jqzz.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "app_image",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"owner_id", "handle"}, name = "uk_owner_handle")
    })
public class Image {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String handle;

    @Column(name = "owner_id")
    private String ownerId;  // null = public

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ImageVisibility visibility;

    @Lob
    @Column(columnDefinition = "BLOB")
    private byte[] data;

    private String mimeType;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    // Constructors, getters, setters (unchanged)
    public Image() {}

    public Image(String handle, String ownerId, ImageVisibility visibility, byte[] data, String mimeType) {
        this.handle = handle;
        this.ownerId = ownerId;
        this.visibility = visibility;
        this.data = data;
        this.mimeType = mimeType;
        this.createdAt = LocalDateTime.now();
    }

    // getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getHandle() { return handle; }
    public void setHandle(String handle) { this.handle = handle; }

    public String getOwnerId() { return ownerId; }
    public void setOwnerId(String ownerId) { this.ownerId = ownerId; }

    public ImageVisibility getVisibility() { return visibility; }
    public void setVisibility(ImageVisibility visibility) { this.visibility = visibility; }

    public byte[] getData() { return data; }
    public void setData(byte[] data) { this.data = data; }

    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}