package com.lonezsi.jqzz.controller;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.lonezsi.jqzz.model.GameRecord;
import com.lonezsi.jqzz.model.PlayerResult;
import com.lonezsi.jqzz.repository.GameRecordRepository;

import tools.jackson.databind.json.JsonMapper;

/** The games you hosted or played, newest first. Only the people in a game can see it. */
@RestController
@RequestMapping("/history")
public class HistoryController {

    private final GameRecordRepository records;
    private final JsonMapper json;

    public HistoryController(GameRecordRepository records, JsonMapper json) {
        this.records = records;
        this.json = json;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(@RequestHeader(value = "X-User-Id", required = false) String userId) {
        if (userId == null || userId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId is required");
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (GameRecord r : records.findForUser(userId)) out.add(summary(r, userId));
        return out;
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public Map<String, Object> get(@RequestHeader(value = "X-User-Id", required = false) String userId,
                                   @PathVariable Long id) {
        GameRecord r = records.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such game"));
        if (userId == null || !r.involves(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You weren't in that game");
        }
        Map<String, Object> m = summary(r, userId);
        m.put("players", r.getPlayers());
        m.put("content", r.getContent() == null ? Map.of() : json.readValue(r.getContent(), Map.class));
        return m;
    }

    private static Map<String, Object> summary(GameRecord r, String userId) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("code", r.getCode());
        m.put("quizId", r.getQuizId());
        m.put("quizName", r.getQuizName());
        m.put("finishedAt", r.getFinishedAt());
        m.put("hosted", userId.equals(r.getHostId()));
        m.put("playerCount", r.getPlayers().size());
        PlayerResult you = r.getPlayers().stream().filter(p -> userId.equals(p.userId())).findFirst().orElse(null);
        m.put("you", you);
        m.put("podium", r.getPlayers().stream().filter(p -> p.ranking() <= 3).limit(5).toList());
        return m;
    }
}
