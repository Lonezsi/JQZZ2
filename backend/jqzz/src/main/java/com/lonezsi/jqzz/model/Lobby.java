package com.lonezsi.jqzz.model;

import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

@Entity
public class Lobby {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private Long adminId;

    @ManyToOne
    @JoinColumn(name="quiz_id")
    private Quiz quiz;

    private int currentActionIndex = -1;

    private int time;

    @ElementCollection
    private List<Player> players = new ArrayList<>();

    public Long getId(){return id;}
    public void setId(Long id){this.id=id;}

    public String getName(){return name;}
    public void setName(String name){this.name=name;}

    public Long getAdminId(){return adminId;}
    public void setAdminId(Long adminId){this.adminId=adminId;}

    public Quiz getQuiz(){return quiz;}
    public void setQuiz(Quiz quiz){this.quiz=quiz;}

    public int getCurrentActionIndex(){return currentActionIndex;}
    public void setCurrentActionIndex(int currentActionIndex){this.currentActionIndex=currentActionIndex;}

    public int getTime(){return time;}
    public void setTime(int time){this.time=time;}

    public List<Player> getPlayers(){return players;}
    public void setPlayers(List<Player> players){this.players=players;}

    public void addPlayer(String userId){
        players.add(new Player(userId, 0));
    }

    // logic
    public void updateScore(String userId, int score){
        for(int i=0; i<players.size(); i++){
            Player p = players.get(i);
            if(p.userId().equals(userId)){
                players.set(i, new Player(userId, p.score() + score));
                break;
            }
        }
    }

    public Action nextAction(){

        currentActionIndex++;

        if(currentActionIndex >= quiz.getActions().size())
            return null;

        Action action = quiz.getActions().get(currentActionIndex);
        time = action.getTime();

        return action;
    }

    public boolean isQuizOver(){
        if (quiz == null || quiz.getActions() == null || quiz.getActions().isEmpty()) {
            return true;
        }
        return currentActionIndex >= quiz.getActions().size() - 1;
    }

    public Action getCurrentAction(){
        if (quiz == null || quiz.getActions() == null || currentActionIndex < 0 || currentActionIndex >= quiz.getActions().size()) {
            return null;
        }
        return quiz.getActions().get(currentActionIndex);
    }

    public void reset(){
        currentActionIndex = -1;
        time = 0;
        for(int i=0; i<players.size(); i++){
            Player p = players.get(i);
            players.set(i, new Player(p.userId(), 0));
        }
    }
}