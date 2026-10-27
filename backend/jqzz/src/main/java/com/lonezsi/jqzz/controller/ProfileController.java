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
import com.lonezsi.jqzz.model.User;
import com.lonezsi.jqzz.repository.GameRecordRepository;
import com.lonezsi.jqzz.repository.UserRepository;
import com.lonezsi.jqzz.service.StashService;

import tools.jackson.databind.json.JsonMapper;

/**
 * Someone's page: who they are, how they play, the games you were both in
 * (all of them when it's you), and what they made public.
 */
@RestController
@RequestMapping("/profile")
public class ProfileController {

    private final UserRepository users;
    private final GameRecordRepository records;
    private final StashService stash;
    private final FriendController friends;
    private final JsonMapper json;

    public ProfileController(UserRepository users, GameRecordRepository records, StashService stash,
            FriendController friends, JsonMapper json) {
        this.users = users;
        this.records = records;
        this.stash = stash;
        this.friends = friends;
        this.json = json;
    }

    @GetMapping("/{userId}")
    @Transactional(readOnly = true)
    public Map<String, Object> profile(@PathVariable String userId,
                                       @RequestHeader(value = "X-User-Id", required = false) String viewerId) {
        User user = users.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such person"));
        boolean self = userId.equals(viewerId);
        List<GameRecord> theirs = records.findForUser(userId);

        Map<String, Object> who = new LinkedHashMap<>();
        who.put("id", user.getId());
        who.put("name", user.getName());
        who.put("handle", user.getHandle());
        who.put("profilePictureUrl", user.getProfilePictureUrl());

        List<Map<String, Object>> games = new ArrayList<>();
        for (GameRecord r : theirs) {
            if (self || (viewerId != null && r.involves(viewerId))) games.add(HistoryController.summary(r, userId));
        }

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("user", who);
        m.put("self", self);
        m.put("stats", stats(theirs, userId));
        m.put("games", games);
        m.put("shelf", stash.publicOf(userId));
        // their friends, and how you stand with them
        m.put("friends", friends.listOf(userId).get("friends"));
        m.put("friendship", friends.status(viewerId, userId));
        m.put("joined", theirs.isEmpty() ? null : theirs.get(theirs.size() - 1).getFinishedAt());
        return m;
    }

    /**
     * Counted over every game they were in, so it means the same to everyone
     * looking. Wins and podiums only count games with somebody to beat.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> stats(List<GameRecord> theirs, String userId) {
        int hosted = 0, played = 0, wins = 0, podiums = 0, points = 0, ranked = 0, rankSum = 0;
        Map<String, int[]> byType = new LinkedHashMap<>(); // type -> {points, questions}
        for (GameRecord r : theirs) {
            if (userId.equals(r.getHostId())) hosted++;
            PlayerResult me = r.getPlayers().stream().filter(p -> userId.equals(p.userId())).findFirst().orElse(null);
            if (me == null) continue;
            played++;
            points += me.score();
            if (r.getPlayers().size() > 1) {
                ranked++;
                rankSum += me.ranking();
                if (me.ranking() == 1) wins++;
                if (me.ranking() <= 3) podiums++;
            }
            if (r.getContent() == null) continue;
            Map<String, Object> content = json.readValue(r.getContent(), Map.class);
            Map<String, Object> results = (Map<String, Object>) content.getOrDefault("results", Map.of());
            for (Map<String, Object> q : (List<Map<String, Object>>) content.getOrDefault("questions", List.of())) {
                Map<String, Object> res = (Map<String, Object>) results.get(String.valueOf(q.get("key")));
                if (res == null || res.isEmpty()) continue; // never got to it
                Map<String, Object> gains = (Map<String, Object>) res.getOrDefault("gains", Map.of());
                int[] t = byType.computeIfAbsent(String.valueOf(q.get("type")), k -> new int[2]);
                t[0] += gains.get(userId) instanceof Number n ? n.intValue() : 0;
                t[1]++;
            }
        }
        List<Map<String, Object>> types = new ArrayList<>();
        byType.forEach((type, t) -> types.add(Map.of("type", type, "points", t[0], "questions", t[1])));
        types.sort((a, b) -> Double.compare(avg(b), avg(a)));

        Map<String, Object> s = new LinkedHashMap<>();
        s.put("games", theirs.size());
        s.put("hosted", hosted);
        s.put("played", played);
        s.put("wins", wins);
        s.put("podiums", podiums);
        s.put("points", points);
        s.put("avgRank", ranked == 0 ? null : Math.round(rankSum * 10.0 / ranked) / 10.0);
        s.put("byType", types);
        return s;
    }

    private static double avg(Map<String, Object> t) {
        int q = (int) t.get("questions");
        return q == 0 ? 0 : (int) t.get("points") / (double) q;
    }
}
