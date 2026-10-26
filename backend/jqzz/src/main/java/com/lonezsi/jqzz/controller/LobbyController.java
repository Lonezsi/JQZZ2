package com.lonezsi.jqzz.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.lonezsi.jqzz.model.Lobby;
import com.lonezsi.jqzz.model.Player;
import com.lonezsi.jqzz.repository.LobbyRepository;
import com.lonezsi.jqzz.repository.QuizRepository;

@RestController
@RequestMapping("/lobbies")
public class LobbyController {

    private final LobbyRepository lobbyRepository;
    private final QuizRepository quizRepository;
    private final SimpMessagingTemplate messaging;

    public LobbyController(LobbyRepository lobbyRepository, QuizRepository quizRepository, SimpMessagingTemplate messaging) {
        this.lobbyRepository = lobbyRepository;
        this.quizRepository = quizRepository;
        this.messaging = messaging;
    }

    private Lobby findLobby(Long lobbyId) {
        return lobbyRepository.findById(lobbyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lobby not found"));
    }

    @GetMapping
    public List<Lobby> getAll() {
        return lobbyRepository.findAll();
    }

    @GetMapping("/{lobbyId}")
    public Lobby getOne(@PathVariable Long lobbyId) {
        return findLobby(lobbyId);
    }

    @PostMapping
    public Lobby create(@RequestBody CreateLobbyRequest request) {
        if (request.getAdminId() == null || request.getAdminId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "adminId is required");
        }

        Lobby lobby = new Lobby();
        lobby.setName(request.getName());
        lobby.setAdminId(request.getAdminId());
        lobby.setCurrentActionIndex(-1);
        lobby.setTime(0);

        if (request.getQuizId() != null) {
            lobby.setQuiz(quizRepository.findById(request.getQuizId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Quiz not found")));
        }

        Player admin = new Player(request.getAdminId(), 0);

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
        if (request.getUserId() == null || request.getUserId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId is required");
        }
        Lobby lobby = findLobby(lobbyId);

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
        Lobby lobby = findLobby(lobbyId);

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
        lobbyRepository.delete(findLobby(lobbyId));

        messaging.convertAndSend(
            "/topic/lobbies",
            (Object) Map.of("event", "lobby_deleted", "lobbyId", lobbyId)
        );
    }

    public static class CreateLobbyRequest {
        private String name;
        private String adminId;
        private Long quizId;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getAdminId() {
            return adminId;
        }

        public void setAdminId(String adminId) {
            this.adminId = adminId;
        }

        public Long getQuizId() {
            return quizId;
        }

        public void setQuizId(Long quizId) {
            this.quizId = quizId;
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