package com.lonezsi.jqzz.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.util.List;

@Entity
public class Question {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name="lobby_id")
    @JsonIgnore
    private Lobby lobby;

    private String text;

    private Integer timeLimit = 20;

    @OneToMany(mappedBy="question", cascade = CascadeType.ALL)
    private List<Answer> answers;

    public Long getId(){return id;}
    public void setId(Long id){this.id=id;}

    public String getText(){return text;}
    public void setText(String text){this.text=text;}

    public Integer getTimeLimit(){return timeLimit;}
    public void setTimeLimit(Integer timeLimit){this.timeLimit=timeLimit;}

    public Lobby getLobby(){return lobby;}
    public void setLobby(Lobby lobby){this.lobby=lobby;}

    public List<Answer> getAnswers(){return answers;}
    public void setAnswers(List<Answer> answers){this.answers=answers;}
}