package com.lonezsi.jqzz.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Column;

@Entity
public class User {
    @Id
    private String id;

    @Column(unique=true)
    private String handle;

    private String name;

    // these are actually ALL optional
    private String password;
    private String email;
    private String profilePictureUrl;

    private boolean online;

    public User() {}

    public String getId(){return id;}
    public void setId(String id){this.id=id;}

    public String getHandle(){return handle;}
    public void setHandle(String handle){this.handle=handle;}

    public String getName(){return name;}
    public void setName(String name){this.name=name;}

    public String getPassword(){return password;}
    public void setPassword(String password){this.password=password;}

    public String getEmail(){return email;}
    public void setEmail(String email){this.email=email;}

    public String getProfilePictureUrl(){return profilePictureUrl;}
    public void setProfilePictureUrl(String profilePictureUrl){this.profilePictureUrl=profilePictureUrl;}

    public boolean isOnline(){return online;}
    public void setOnline(boolean online){this.online=online;}
}