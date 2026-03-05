package com.jqzz.repository;

import com.jqzz.model.Lobby;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LobbyRepository extends JpaRepository<Lobby, Long> {
}