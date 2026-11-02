package com.lonezsi.jqzz.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

/**
 * A drawing from a finished game, kept with its history: a game holds its
 * drawings in memory by a random key, and the record's content points at them
 * by that key.
 */
@Entity
@Table(name = "drawing", indexes = @Index(name = "ix_drawing_record", columnList = "record_id, art_key"))
public class Drawing {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "record_id", nullable = false)
    private Long recordId;

    @Column(name = "art_key", nullable = false, length = 32)
    private String artKey;

    @Column(nullable = false, length = 40)
    private String contentType;

    @Lob
    @Column(length = 4 * 1024 * 1024)
    private byte[] data;

    public Drawing() {}

    public Drawing(Long recordId, String artKey, String contentType, byte[] data) {
        this.recordId = recordId;
        this.artKey = artKey;
        this.contentType = contentType;
        this.data = data;
    }

    public Long getId() { return id; }
    public Long getRecordId() { return recordId; }
    public String getArtKey() { return artKey; }
    public String getContentType() { return contentType; }
    public byte[] getData() { return data; }
}
