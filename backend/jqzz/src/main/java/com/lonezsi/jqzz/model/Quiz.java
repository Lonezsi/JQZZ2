package com.lonezsi.jqzz.model;

import java.util.List;
import java.util.ArrayList;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.JoinColumn;

@Entity
public class Quiz {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private String authorId;

    @OneToMany(cascade = CascadeType.ALL)
    @JoinColumn(name="quiz_id")
    private List<Action> actions = new ArrayList<>();

    public Long getId(){return id;}
    public void setId(Long id){this.id=id;}

    public List<Action> getActions(){return actions;}
    public void setActions(List<Action> actions){this.actions=actions;}

    public String getName(){return name;}
    public void setName(String name){this.name=name;}

    public String getAuthorId(){return authorId;}
    public void setAuthorId(String authorId){this.authorId=authorId;}

    public void concat(Quiz other){
        this.actions.addAll(other.getActions());
    }
}