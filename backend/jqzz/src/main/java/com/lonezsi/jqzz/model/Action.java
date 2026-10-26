package com.lonezsi.jqzz.model;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.Column;
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
    private Long id;

    @ManyToOne
    @JoinColumn(name="quiz_id")
    @JsonIgnore
    private Quiz quiz;

    // questions are owned by the quiz; several actions can show the same question
    @ManyToOne
    @JoinColumn(name="question_id")
    private Question question;

    private Phase phase;

    private int time;

    // card label in the editor; the note content for TEXT actions
    @Column(length = 2000)
    private String preview;

    private int orderIndex;

    public Action(){}

    public Action(Question question, Phase phase, int time){
        this.question = question;
        this.phase = phase;
        this.time = time;
    }

    public Long getId(){return id;}
    public void setId(Long id){this.id=id;}

    public Quiz getQuiz(){return quiz;}
    public void setQuiz(Quiz quiz){this.quiz=quiz;}

    public Question getQuestion(){return question;}
    public void setQuestion(Question question){this.question=question;}

    public Phase getPhase(){return phase;}
    public void setPhase(Phase phase){this.phase=phase;}

    public int getTime(){return time;}
    public void setTime(int time){this.time=time;}

    public String getPreview(){return preview;}
    public void setPreview(String preview){this.preview=preview;}

    public int getOrderIndex(){return orderIndex;}
    public void setOrderIndex(int orderIndex){this.orderIndex=orderIndex;}
}
