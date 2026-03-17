package com.lonezsi.jqzz.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;

@Entity
public class User {
    @Id
    private String id;

    private String name;

    private String password;

    private String email;

    private String profilePictureUrl;

    public String getId(){return id;}
    public void setId(String id){this.id=id;}

    public String getName(){return name;}
    public void setName(String name){this.name=name;}

    public String getPassword(){return password;}
    public void setPassword(String password){this.password=password;}

    public String getEmail(){return email;}
    public void setEmail(String email){this.email=email;}

    public String getProfilePictureUrl(){return profilePictureUrl;}
    public void setProfilePictureUrl(String profilePictureUrl){this.profilePictureUrl=profilePictureUrl;}
}