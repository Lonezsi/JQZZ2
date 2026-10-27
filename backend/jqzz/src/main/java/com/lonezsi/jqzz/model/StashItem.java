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

/**
 * Something saved to a stash: a quiz, a question, or an image.
 *
 * Named and shared exactly like images. A PUBLIC item has no owner and its
 * handle is unique among public items of its kind, so it is reached by its
 * handle alone. A SEMI_PRIVATE or PRIVATE item belongs to whoever stashed it:
 * they reach it as ":handle", anyone else can reach a semi-private one as
 * "ownerId:handle", and private ones stay theirs. savedBy is always set,
 * public or not, so the item stays in their stash either way.
 */
@Entity
@Table(name = "stash_item")
public class StashItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StashKind kind;

    @Column(nullable = false)
    private String handle;

    @Column(name = "owner_id")
    private String ownerId; // null = public

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ImageVisibility visibility;

    @Column(nullable = false)
    private String savedBy;

    private String title;

    /** where it came from, e.g. the quiz a question was played in */
    private String source;

    /** QUIZ and QUESTION: the content as JSON, ready to put back into a quiz */
    @Lob
    @Column(length = 4 * 1024 * 1024)
    private String payload;

    /** IMAGE: the image itself, in the image library */
    private Long imageId;

    private LocalDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public StashKind getKind() { return kind; }
    public void setKind(StashKind kind) { this.kind = kind; }

    public String getHandle() { return handle; }
    public void setHandle(String handle) { this.handle = handle; }

    public String getOwnerId() { return ownerId; }
    public void setOwnerId(String ownerId) { this.ownerId = ownerId; }

    public ImageVisibility getVisibility() { return visibility; }
    public void setVisibility(ImageVisibility visibility) { this.visibility = visibility; }

    public String getSavedBy() { return savedBy; }
    public void setSavedBy(String savedBy) { this.savedBy = savedBy; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getPayload() { return payload; }
    public void setPayload(String payload) { this.payload = payload; }

    public Long getImageId() { return imageId; }
    public void setImageId(Long imageId) { this.imageId = imageId; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    /** How others reach it: the handle when public, "owner:handle" otherwise (":handle" for the owner). */
    public String getReference() {
        return ownerId == null ? handle : ownerId + ":" + handle;
    }
}
