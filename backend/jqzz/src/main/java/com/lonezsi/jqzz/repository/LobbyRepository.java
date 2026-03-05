package com.lonezsi.jqzz.repository;

import com.lonezsi.jqzz.model.Lobby;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LobbyRepository extends JpaRepository<Lobby, Long> {
}