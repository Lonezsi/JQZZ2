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
public class Answer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name="question_id")
    @JsonIgnore
    private Question question;

    private String text;

    @Column(name = "answer_value")
    private int value;

    private String imageUrl;

    private String userId; // for USER_GENERATED types, to track who created this answer

    public Long getId(){return id;}
    public void setId(Long id){this.id=id;}

    public String getText(){return text;}
    public void setText(String text){this.text=text;}

    public int getValue(){return value;}
    public void setValue(int value){this.value=value;}

    public String getImageUrl(){return imageUrl;}
    public void setImageUrl(String imageUrl){this.imageUrl=imageUrl;}

    public Question getQuestion(){return question;}
    public void setQuestion(Question question){this.question=question;}

    public String getUserId(){return userId;}
    public void setUserId(String userId){this.userId=userId;}
}