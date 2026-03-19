package com.lonezsi.jqzz.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.lonezsi.jqzz.model.User;

@Repository
public interface UserRepository extends JpaRepository<User, String> {
    boolean existsByHandle(String handle);
    User findByHandle(String handle);
}