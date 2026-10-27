package com.lonezsi.jqzz.model;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.OrderColumn;

/**
 * A finished game, kept for everyone who was in it: who played, how they did,
 * and what was asked (a frozen copy, so editing or deleting the quiz later
 * changes nothing here). History reads these; the stash copies out of them.
 */
@Entity
public class GameRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String code;
    private Long quizId;
    private String quizName;
    private String hostId;
    private String authorId;
    private LocalDateTime finishedAt;

    /** the steps and questions as played, as JSON (see GameEngine.recordContent) */
    @Lob
    @Column(length = 4 * 1024 * 1024)
    @JsonIgnore
    private String content;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "game_record_player", joinColumns = @JoinColumn(name = "record_id"))
    @OrderColumn(name = "position")
    private List<PlayerResult> players = new ArrayList<>();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public Long getQuizId() { return quizId; }
    public void setQuizId(Long quizId) { this.quizId = quizId; }

    public String getQuizName() { return quizName; }
    public void setQuizName(String quizName) { this.quizName = quizName; }

    public String getHostId() { return hostId; }
    public void setHostId(String hostId) { this.hostId = hostId; }

    public String getAuthorId() { return authorId; }
    public void setAuthorId(String authorId) { this.authorId = authorId; }

    public LocalDateTime getFinishedAt() { return finishedAt; }
    public void setFinishedAt(LocalDateTime finishedAt) { this.finishedAt = finishedAt; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public List<PlayerResult> getPlayers() { return players; }
    public void setPlayers(List<PlayerResult> players) { this.players = players; }

    /** Was this person in it, playing or hosting? */
    public boolean involves(String userId) {
        return userId != null
            && (userId.equals(hostId) || players.stream().anyMatch(p -> userId.equals(p.userId())));
    }
}
