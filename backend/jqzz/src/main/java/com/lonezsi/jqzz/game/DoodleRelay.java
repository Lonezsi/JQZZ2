package com.lonezsi.jqzz.game;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import com.lonezsi.jqzz.service.PresenceTracker;

/**
 * Doodles while people wait: a player drags on their screen's background and
 * the trail shows on everyone's, the host's included. Strokes are passed
 * straight through and never kept; they fade on the screens by themselves.
 *
 * SEND /app/play/{code}/doodle   {stroke, points: [[x, y], ...]}  x, y from 0 to 1
 * goes out on /topic/play/{code}/doodle as {from, stroke, points}
 */
@Controller
public class DoodleRelay {

    /** points in one message; the screens send a few every 50ms */
    static final int MAX_POINTS = 64;

    private final GameEngine engine;
    private final PresenceTracker presence;
    private final SimpMessagingTemplate messaging;

    public DoodleRelay(GameEngine engine, PresenceTracker presence, SimpMessagingTemplate messaging) {
        this.engine = engine;
        this.presence = presence;
        this.messaging = messaging;
    }

    @MessageMapping("/play/{code}/doodle")
    public void doodle(@DestinationVariable String code, @Payload Stroke stroke, SimpMessageHeaderAccessor headers) {
        // who it's from is the connection's, not whatever the message claims
        String from = presence.userOf(headers.getSessionId());
        if (from == null || stroke == null || stroke.points == null || stroke.points.isEmpty()) return;
        if (!engine.isPlayer(code, from)) return;

        List<double[]> points = new ArrayList<>();
        for (List<Double> p : stroke.points) {
            if (points.size() >= MAX_POINTS) break;
            if (p == null || p.size() < 2 || p.get(0) == null || p.get(1) == null) continue;
            points.add(new double[] { clamp(p.get(0)), clamp(p.get(1)) });
        }
        if (points.isEmpty()) return;

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("from", from);
        out.put("stroke", stroke.stroke == null ? "" : stroke.stroke.substring(0, Math.min(16, stroke.stroke.length())));
        out.put("points", points);
        messaging.convertAndSend("/topic/play/" + code.toUpperCase() + "/doodle", (Object) out);
    }

    private static double clamp(double v) {
        if (Double.isNaN(v)) return 0;
        return Math.round(Math.max(0, Math.min(1, v)) * 1000) / 1000.0;
    }

    public static class Stroke {
        public String stroke;
        public List<List<Double>> points;
    }
}
