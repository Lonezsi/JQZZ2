package com.lonezsi.jqzz.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.lonezsi.jqzz.model.Action;
import com.lonezsi.jqzz.model.Lobby;
import com.lonezsi.jqzz.repository.LobbyRepository;

@RestController
@RequestMapping("/game")
public class GameController {

    private final LobbyRepository lobbyRepository;
    private final SimpMessagingTemplate messaging;

    public GameController(
        LobbyRepository lobbyRepository,
        SimpMessagingTemplate messaging
    ){
        this.lobbyRepository = lobbyRepository;
        this.messaging = messaging;
    }

    private Lobby findLobbyWithQuiz(Long lobbyId) {
        Lobby lobby = lobbyRepository.findById(lobbyId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lobby not found"));
        if (lobby.getQuiz() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Lobby has no quiz");
        }
        return lobby;
    }

    @PostMapping("/{lobbyId}/start")
    public void start(@PathVariable Long lobbyId){

        Lobby lobby = findLobbyWithQuiz(lobbyId);

        lobby.reset();
        lobbyRepository.save(lobby);

        messaging.convertAndSend(
            "/topic/lobby/" + lobbyId,
            (Object) Map.of("event","quiz_started")
        );
    }

    @PostMapping("/{lobbyId}/next")
    public void next(@PathVariable Long lobbyId){

        Lobby lobby = findLobbyWithQuiz(lobbyId);

        Action action = lobby.nextAction();

        lobbyRepository.save(lobby);

        // Map.of rejects null values, and action is null once the quiz is over
        Map<String, Object> message = new HashMap<>();
        if (action == null) {
            message.put("event", "quiz_finished");
        } else {
            message.put("event", "action");
            message.put("action", action);
        }
        messaging.convertAndSend("/topic/lobby/" + lobbyId, (Object) message);
    }

    @MessageMapping("/lobby/{lobbyId}/timer")
    public void timerUpdate(@DestinationVariable Long lobbyId, @Payload TimerUpdate update) {
        if (update == null || update.getAdminId() == null || update.getRemaining() == null) {
            return;
        }

        Lobby lobby = lobbyRepository.findById(lobbyId).orElse(null);

        if (lobby == null || lobby.getAdminId() == null || !lobby.getAdminId().equals(update.getAdminId())) {
            // ignore non-admin timer updates
            return;
        }

        int remaining = update.getRemaining();
        if (remaining < -1) {
            return;
        }

        lobby.setTime(remaining);
        lobbyRepository.save(lobby);

        messaging.convertAndSend(
            "/topic/lobby/" + lobbyId,
            (Object) Map.of(
                "event", "timer_update",
                "time", remaining
            )
        );
    }

    public static class TimerUpdate {
        private String adminId;
        private Integer remaining;

        public String getAdminId() {
            return adminId;
        }

        public void setAdminId(String adminId) {
            this.adminId = adminId;
        }

        public Integer getRemaining() {
            return remaining;
        }

        public void setRemaining(Integer remaining) {
            this.remaining = remaining;
        }
    }
}