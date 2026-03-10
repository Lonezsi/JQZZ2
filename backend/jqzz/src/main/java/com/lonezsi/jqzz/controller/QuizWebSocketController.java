package com.lonezsi.jqzz.controller;

import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.lonezsi.jqzz.ScriptRunner;

import tools.jackson.databind.ObjectMapper;

@Component
public class QuizWebSocketController extends TextWebSocketHandler {

    private final ObjectMapper mapper = new ObjectMapper();
    private final ConcurrentHashMap<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, ScriptRunner> runners = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String lobbyId = getLobbyIdFromSession(session);
        sessions.put(session.getId(), session);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        // Expect JSON: { action: "next", lobbyId: "abc123" }
        var node = mapper.readTree(message.getPayload());
        String action = node.get("action").asText();
        String lobbyId = node.get("lobbyId").asText();

        ScriptRunner runner = runners.get(lobbyId);
        if (runner == null) return;

        if ("next".equals(action) && runner.hasNext()) {
            var event = runner.nextEvent();
            session.sendMessage(new TextMessage(mapper.writeValueAsString(event)));
        }
    }

    private String getLobbyIdFromSession(WebSocketSession session) {
        // extract lobbyId from query param
        String uri = session.getUri().toString();
        return uri.split("lobbyId=")[1];
    }

    public ConcurrentHashMap<String, WebSocketSession> getSessions() {
        return sessions;
    }
}