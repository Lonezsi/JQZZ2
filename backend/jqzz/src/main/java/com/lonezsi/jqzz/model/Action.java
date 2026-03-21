package com.lonezsi.jqzz.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

@Entity
public class Action {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @SuppressWarnings("unused")
    private Long id;

    @ManyToOne (cascade = CascadeType.ALL)
    @JoinColumn(name="question_id")
    private Question question;

    private Phase phase;

    private int time;

    @SuppressWarnings("unused")
    private int orderIndex;

    public Action(){}

    public Action(Question question, Phase phase, int time){
        this.question = question;
        this.phase = phase;
        this.time = time;
    }

    public Question getQuestion(){return question;}
    public Phase getPhase(){return phase;}
    public int getTime(){return time;}
}