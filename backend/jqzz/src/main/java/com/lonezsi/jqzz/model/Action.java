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

    public Long getId(){return id;}
    public void setId(Long id){this.id=id;}

    public Question getQuestion(){return question;}
    public void setQuestion(Question question){this.question=question;}

    public Phase getPhase(){return phase;}
    public void setPhase(Phase phase){this.phase=phase;}

    public int getTime(){return time;}
    public void setTime(int time){this.time=time;}

    public int getOrderIndex(){return orderIndex;}
    public void setOrderIndex(int orderIndex){this.orderIndex=orderIndex;}
}