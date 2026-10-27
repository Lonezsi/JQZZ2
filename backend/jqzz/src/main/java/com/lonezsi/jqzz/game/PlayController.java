package com.lonezsi.jqzz.game;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Playing a quiz. Everything answers with the game's whole state, and the same
 * state goes out on /topic/play/{code} to everyone watching it.
 *
 * POST /play/host                 {quizId, userId}       a new game, you host it
 * POST /play/{code}/join          {userId}               you're in
 * GET  /play/{code}                                      where it is
 * POST /play/{code}/start|pause|resume|skip|end|restart  {userId}  host only
 * POST /play/{code}/kick          {userId, playerId}     host only
 * POST /play/{code}/submit        {userId, picks|text|tiers}
 * POST /play/{code}/vote          {userId, choice, match | guesses}
 * POST /play/{code}/leave         {userId}
 */
@RestController
@RequestMapping("/play")
public class PlayController {

    private final GameEngine engine;

    public PlayController(GameEngine engine) {
        this.engine = engine;
    }

    @PostMapping("/host")
    public Map<String, Object> host(@RequestBody PlayRequest r) {
        return engine.host(r.quizId, r.userId);
    }

    @GetMapping("/{code}")
    public Map<String, Object> state(@PathVariable String code) {
        return engine.state(code);
    }

    @PostMapping("/{code}/join")
    public Map<String, Object> join(@PathVariable String code, @RequestBody PlayRequest r) {
        return engine.join(code, r.userId);
    }

    @PostMapping("/{code}/leave")
    public Map<String, Object> leave(@PathVariable String code, @RequestBody PlayRequest r) {
        return engine.leave(code, r.userId);
    }

    @PostMapping("/{code}/start")
    public Map<String, Object> start(@PathVariable String code, @RequestBody PlayRequest r) {
        return engine.start(code, r.userId);
    }

    @PostMapping("/{code}/pause")
    public Map<String, Object> pause(@PathVariable String code, @RequestBody PlayRequest r) {
        return engine.pause(code, r.userId);
    }

    @PostMapping("/{code}/resume")
    public Map<String, Object> resume(@PathVariable String code, @RequestBody PlayRequest r) {
        return engine.resume(code, r.userId);
    }

    @PostMapping("/{code}/skip")
    public Map<String, Object> skip(@PathVariable String code, @RequestBody PlayRequest r) {
        return engine.skip(code, r.userId);
    }

    @PostMapping("/{code}/end")
    public Map<String, Object> end(@PathVariable String code, @RequestBody PlayRequest r) {
        return engine.end(code, r.userId);
    }

    @PostMapping("/{code}/restart")
    public Map<String, Object> restart(@PathVariable String code, @RequestBody PlayRequest r) {
        return engine.restart(code, r.userId);
    }

    @PostMapping("/{code}/kick")
    public Map<String, Object> kick(@PathVariable String code, @RequestBody PlayRequest r) {
        return engine.kick(code, r.userId, r.playerId);
    }

    @PostMapping("/{code}/submit")
    public Map<String, Object> submit(@PathVariable String code, @RequestBody PlayRequest r) {
        return engine.submit(code, r.userId, r.picks, r.text, r.tiers);
    }

    @PostMapping("/{code}/vote")
    public Map<String, Object> vote(@PathVariable String code, @RequestBody PlayRequest r) {
        return engine.vote(code, r.userId, r.choice, r.match, r.guesses);
    }

    /** One shape for every request; each endpoint reads what it needs. */
    public static class PlayRequest {
        public Long quizId;
        public String userId;
        public String playerId;
        public List<Long> picks;
        public String text;
        public Map<Long, String> tiers;
        public String choice;
        public Integer match;
        public Map<String, String> guesses;
    }
}
