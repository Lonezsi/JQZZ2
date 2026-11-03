package com.lonezsi.jqzz.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.lonezsi.jqzz.model.LoginKey;

public interface LoginKeyRepository extends JpaRepository<LoginKey, String> {

    List<LoginKey> findByUserId(String userId);

    boolean existsByUserId(String userId);
}
