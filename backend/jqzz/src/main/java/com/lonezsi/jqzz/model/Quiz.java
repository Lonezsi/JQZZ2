package com.lonezsi.jqzz.model;

import java.util.List;
import java.util.ArrayList;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;

@Entity
public class Quiz {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private String authorId;

    @OneToMany(mappedBy = "quiz", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    private List<Action> actions = new ArrayList<>();

    // serialized inline through actions[].question instead
    @OneToMany(mappedBy = "quiz", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<Question> questions = new ArrayList<>();

    public Long getId(){return id;}
    public void setId(Long id){this.id=id;}

    public List<Action> getActions(){return actions;}
    public void setActions(List<Action> actions){this.actions=actions;}

    public List<Question> getQuestions(){return questions;}
    public void setQuestions(List<Question> questions){this.questions=questions;}

    public String getName(){return name;}
    public void setName(String name){this.name=name;}

    public String getAuthorId(){return authorId;}
    public void setAuthorId(String authorId){this.authorId=authorId;}
}
