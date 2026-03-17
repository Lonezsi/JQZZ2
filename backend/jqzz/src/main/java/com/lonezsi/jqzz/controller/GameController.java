package com.lonezsi.jqzz.controller;

import java.util.Map;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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

    @PostMapping("/{lobbyId}/start")
    public void start(@PathVariable Long lobbyId){

        Lobby lobby = lobbyRepository.findById(lobbyId).orElseThrow();

        lobby.reset();
        lobbyRepository.save(lobby);

        messaging.convertAndSend(
            "/topic/lobby/" + lobbyId,
            (Object) Map.of("event","quiz_started")
        );
    }

    @PostMapping("/{lobbyId}/next")
    public void next(@PathVariable Long lobbyId){

        Lobby lobby = lobbyRepository.findById(lobbyId).orElseThrow();

        Action action = lobby.nextAction();

        lobbyRepository.save(lobby);

        messaging.convertAndSend(
            "/topic/lobby/" + lobbyId,
            (Object) Map.of(
                "event","action",
                "action", action
            )
        );
    }

    @MessageMapping("/lobby/{lobbyId}/timer")
    public void timerUpdate(@DestinationVariable Long lobbyId, @Payload TimerUpdate update) {
        if (update == null || update.getAdminId() == null || update.getRemaining() == null) {
            return;
        }

        Lobby lobby = lobbyRepository.findById(lobbyId).orElseThrow();

        if (lobby.getAdminId() == null || !lobby.getAdminId().equals(update.getAdminId())) {
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
        private Long adminId;
        private Integer remaining;

        public Long getAdminId() {
            return adminId;
        }

        public void setAdminId(Long adminId) {
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