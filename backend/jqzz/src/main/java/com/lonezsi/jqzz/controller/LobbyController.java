package com.lonezsi.jqzz.controller;

import java.util.List;
import java.util.Map;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import com.lonezsi.jqzz.model.Lobby;
import com.lonezsi.jqzz.model.Player;
import com.lonezsi.jqzz.repository.LobbyRepository;

@RestController
@RequestMapping("/lobbies")
public class LobbyController {

    private final LobbyRepository lobbyRepository;
    private final SimpMessagingTemplate messaging;

    public LobbyController(LobbyRepository lobbyRepository, SimpMessagingTemplate messaging) {
        this.lobbyRepository = lobbyRepository;
        this.messaging = messaging;
    }

    @GetMapping
    public List<Lobby> getAll() {
        return lobbyRepository.findAll();
    }

    @GetMapping("/{lobbyId}")
    public Lobby getOne(@PathVariable Long lobbyId) {
        return lobbyRepository.findById(lobbyId).orElseThrow();
    }

    @PostMapping
    public Lobby create(@RequestBody CreateLobbyRequest request) {
        Lobby lobby = new Lobby();
        lobby.setName(request.getName());
        lobby.setAdminId(request.getAdminId());
        lobby.setCurrentActionIndex(-1);
        lobby.setTime(0);

        Player admin = new Player(String.valueOf(request.getAdminId()), 0);

        lobby.getPlayers().add(admin);

        Lobby saved = lobbyRepository.save(lobby);

        messaging.convertAndSend(
            "/topic/lobbies",
            (Object) Map.of("event", "lobby_created", "lobby", saved)
        );

        return saved;
    }

    @PostMapping("/{lobbyId}/join")
    public Lobby join(@PathVariable Long lobbyId, @RequestBody JoinLobbyRequest request) {
        Lobby lobby = lobbyRepository.findById(lobbyId).orElseThrow();

        boolean exists = lobby.getPlayers().stream()
            .anyMatch(p -> p.userId().equals(request.getUserId()));

        if (!exists) {
            Player player = new Player(request.getUserId(), 0);
            lobby.getPlayers().add(player);
        }

        Lobby saved = lobbyRepository.save(lobby);

        messaging.convertAndSend(
            "/topic/lobby/" + lobbyId,
            (Object) Map.of("event", "players_update", "payload", saved.getPlayers())
        );

        return saved;
    }

    @PostMapping("/{lobbyId}/leave")
    public Lobby leave(@PathVariable Long lobbyId, @RequestBody JoinLobbyRequest request) {
        Lobby lobby = lobbyRepository.findById(lobbyId).orElseThrow();

        lobby.getPlayers().removeIf(p -> p.userId().equals(request.getUserId()));

        Lobby saved = lobbyRepository.save(lobby);

        messaging.convertAndSend(
            "/topic/lobby/" + lobbyId,
            (Object) Map.of("event", "players_update", "payload", saved.getPlayers())
        );

        return saved;
    }

    @DeleteMapping("/{lobbyId}")
    public void delete(@PathVariable Long lobbyId) {
        lobbyRepository.deleteById(lobbyId);

        messaging.convertAndSend(
            "/topic/lobbies",
            (Object) Map.of("event", "lobby_deleted", "lobbyId", lobbyId)
        );
    }

    public static class CreateLobbyRequest {
        private String name;
        private Long adminId;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public Long getAdminId() {
            return adminId;
        }

        public void setAdminId(Long adminId) {
            this.adminId = adminId;
        }
    }

    public static class JoinLobbyRequest {
        private String userId;

        public String getUserId() {
            return userId;
        }

        public void setUserId(String userId) {
            this.userId = userId;
        }
    }
}