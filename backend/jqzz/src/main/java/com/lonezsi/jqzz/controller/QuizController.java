package com.lonezsi.jqzz.controller;

import com.lonezsi.jqzz.model.Lobby;
import com.lonezsi.jqzz.repository.LobbyRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins="*")
public class QuizController {

    @Autowired
    private LobbyRepository lobbyRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @GetMapping("/lobbies")
    public List<Lobby> getLobbies(){
        return lobbyRepository.findAll();
    }

    @GetMapping("/lobbies/{id}")
    public Lobby getLobby(@PathVariable Long id){
        return lobbyRepository.findById(id).orElseThrow();
    }

    @PostMapping("/lobbies")
    public Lobby createLobby(@RequestBody Lobby lobby){
        return lobbyRepository.save(lobby);
    }

    @PostMapping("/quiz/{lobbyId}/action")
    public Map<String,Object> action(@PathVariable Long lobbyId, @RequestBody Map<String,String> payload){

        String action = payload.get("action");
        Lobby lobby = lobbyRepository.findById(lobbyId).orElseThrow();

        // Flipped the equals check to be null-safe
        if("start".equals(action)){
            lobby.setStatus("started");
            lobbyRepository.save(lobby);

            String destination = "/topic/lobby/" + lobbyId;
            
            // Renamed 'payload' to 'eventData' here to avoid the conflict
            Object eventData = Map.of("event", "quizStarted", "lobby", lobby); 
            messagingTemplate.convertAndSend(destination, eventData);
        }

        return Map.of("success", true);
    }
}