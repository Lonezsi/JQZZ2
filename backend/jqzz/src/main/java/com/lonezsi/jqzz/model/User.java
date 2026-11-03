package com.lonezsi.jqzz.model;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "app_user")
public class User {
    @Id
    private String id;

    @Column(unique = true)
    private String handle;

    private String name;

    // these are actually ALL optional
    @JsonIgnore
    private String password;
    /** only ever sent to its owner: see UserController.self */
    @JsonIgnore
    private String email;
    private String profilePictureUrl;

    private boolean online;

    /** the Google account this one is tied to ("sub"); null for a guest account */
    @JsonIgnore
    @Column(unique = true)
    private String googleSub;

    /** has been told, once, that a guest account lives in one browser */
    @JsonIgnore
    private Boolean guestNoticed;

    public String getGoogleSub(){return googleSub;}
    public void setGoogleSub(String googleSub){this.googleSub=googleSub;}
    /** tied to Google: it can be signed into anywhere, not only where it was made */
    public boolean isGoogleLinked(){return googleSub != null;}
    public Boolean getGuestNoticed(){return guestNoticed;}
    public void setGuestNoticed(Boolean guestNoticed){this.guestNoticed=guestNoticed;}

    /**
     * The secret that logs this account in. The id is public (it's in the
     * people list, on quizzes and in games), so it can't be what proves who
     * you are; only the account's owner is ever sent this.
     */
    @JsonIgnore
    @Column(unique = true)
    private String loginKey;

    public String getLoginKey(){return loginKey;}
    public void setLoginKey(String loginKey){this.loginKey=loginKey;}

    /** has been given the default question types in their stash, once */
    @JsonIgnore
    private Boolean typesSeeded;

    public Boolean getTypesSeeded(){return typesSeeded;}
    public void setTypesSeeded(Boolean typesSeeded){this.typesSeeded=typesSeeded;}

    // constructors, getters, setters unchanged
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