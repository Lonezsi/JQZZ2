package com.lonezsi.jqzz.controller;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.lonezsi.jqzz.ScriptRunner;
import com.lonezsi.jqzz.model.Lobby;
import com.lonezsi.jqzz.repository.LobbyRepository;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins="*")
public class QuizController {

    @Autowired
    private LobbyRepository lobbyRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    // Keep per-lobby script runners so REST actions can advance the script
    private final ConcurrentHashMap<Long, ScriptRunner> runners = new ConcurrentHashMap<>();

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
        String destination = "/topic/lobby/" + lobbyId;

        if("start".equals(action)){
            lobby.setStatus("started");
            lobbyRepository.save(lobby);

            // initialize runner for this lobby
            runners.computeIfAbsent(lobbyId, id -> {
                ScriptRunner r = new ScriptRunner();
                try { r.parseScript(loadScriptForLobby(String.valueOf(id))); } catch(Exception e) { }
                return r;
            });

            Object eventData = Map.of("event", "quizStarted", "lobby", lobby);
            messagingTemplate.convertAndSend(destination, eventData);
        } else if ("next".equals(action)) {
            // Advance script runner and broadcast the resulting script event
            ScriptRunner runner = runners.computeIfAbsent(lobbyId, id -> {
                ScriptRunner r = new ScriptRunner();
                try { r.parseScript(loadScriptForLobby(String.valueOf(id))); } catch(Exception e) { }
                return r;
            });

            if (runner.hasNext()) {
                var ev = runner.nextEvent();
                Object eventData = Map.of("event", "script_event", "payload", ev.getPayload());
                messagingTemplate.convertAndSend(destination, eventData);
            }
        }

        return Map.of("success", true);
    }

    private String loadScriptForLobby(String lobbyId) {
        try {
            var is = getClass().getResourceAsStream("./default.txt");
            if (is == null) return "";
            return new String(is.readAllBytes());
        } catch (Exception e) {
        }
        return "";
    }
}