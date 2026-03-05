package com.lonezsi.jqzz.model;

import jakarta.persistence.*;
import java.util.List;

@Entity
public class Lobby {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private Long adminId;

    private String status = "waiting";

    private String phase = "0-0";

    @OneToMany(mappedBy = "lobby", cascade = CascadeType.ALL)
    private List<Question> questions;

    public Long getId(){return id;}
    public void setId(Long id){this.id=id;}

    public String getName(){return name;}
    public void setName(String name){this.name=name;}

    public Long getAdminId(){return adminId;}
    public void setAdminId(Long adminId){this.adminId=adminId;}

    public String getStatus(){return status;}
    public void setStatus(String status){this.status=status;}

    public String getPhase(){return phase;}
    public void setPhase(String phase){this.phase=phase;}

    public List<Question> getQuestions(){return questions;}
    public void setQuestions(List<Question> questions){this.questions=questions;}
}