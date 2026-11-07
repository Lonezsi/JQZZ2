package com.lonezsi.jqzz.game;

import java.util.List;
import java.util.Map;

import java.util.concurrent.TimeUnit;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.lonezsi.jqzz.service.StashService;

/**
 * Playing a quiz. Everything answers with the game's whole state, and the same
 * state goes out on /topic/play/{code} to everyone watching it.
 *
 * POST /play/host                 {quizId, userId}       a new game, you host it
 * POST /play/{code}/join          {userId, name?}        you're in; name: who you are, when the quiz has a roster
 * GET  /play/{code}                                      where it is
 * GET  /play/live                                        {live}: games under way (a deploy waits for none)
 * POST /play/{code}/start|pause|resume|skip|end|restart  {userId}  host only
 * POST /play/{code}/kick          {userId, playerId}     host only
 * POST /play/{code}/invite        {userId, playerId}     host only: playerId gets a notification
 * POST /play/{code}/submit        {userId, picks|text|tiers|pairs|choices}
 * POST /play/{code}/draw          the image itself (PNG/WebP/JPEG), X-User-Id: who drew it
 * GET  /play/{code}/task          X-User-Id: what only you see now (secret word, what you're handed)
 * GET  /play/{code}/art/{id}      a drawing from the game
 * POST /play/{code}/vote          {userId, choice|choices, match | guesses}
 * POST /play/{code}/leave         {userId}
 * POST /play/{code}/hurry         {userId}               done: nudge the host to move on
 * POST /play/rematch              {recordId, userId}     that game's quiz again, everyone invited
 * POST /play/practice             {userId, quizId | stashId}  alone, started at once
 */
@RestController
@RequestMapping("/play")
public class PlayController {

    private final GameEngine engine;
    private final StashService stash;

    public PlayController(GameEngine engine, StashService stash) {
        this.engine = engine;
        this.stash = stash;
    }

    /** ?userId: games you host or play that haven't finished */
    @GetMapping("/mine")
    public List<Map<String, Object>> mine(@org.springframework.web.bind.annotation.RequestParam("userId") String userId) {
        return engine.mine(userId);
    }

    @GetMapping("/live")
    public Map<String, Integer> live() {
        return Map.of("live", engine.liveGames());
    }

    @PostMapping("/host")
    public Map<String, Object> host(@RequestBody PlayRequest r) {
        return engine.host(r.quizId, r.userId);
    }

    @GetMapping("/{code}")
    public Map<String, Object> state(@PathVariable String code) {
        return engine.state(code);
    }

    /** {recordId, userId}: the same quiz again, everyone from that game invited */
    @PostMapping("/rematch")
    public Map<String, Object> rematch(@RequestBody PlayRequest r) {
        return engine.rematch(r.recordId, r.userId);
    }

    /** {userId, quizId | stashId}: play it alone, straight away */
    @PostMapping("/practice")
    public Map<String, Object> practice(@RequestBody PlayRequest r) {
        return r.stashId != null
                ? engine.practice(stash.practiceQuiz(r.stashId, r.userId), r.userId)
                : engine.practice(r.quizId, r.userId);
    }

    @PostMapping("/{code}/join")
    public Map<String, Object> join(@PathVariable String code, @RequestBody PlayRequest r) {
        return engine.join(code, r.userId, r.name);
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

    @PostMapping("/{code}/invite")
    public Map<String, Object> invite(@PathVariable String code, @RequestBody PlayRequest r) {
        return engine.invite(code, r.userId, r.playerId);
    }

    @PostMapping("/{code}/kick")
    public Map<String, Object> kick(@PathVariable String code, @RequestBody PlayRequest r) {
        return engine.kick(code, r.userId, r.playerId);
    }

    @PostMapping("/{code}/submit")
    public Map<String, Object> submit(@PathVariable String code, @RequestBody PlayRequest r) {
        return engine.submit(code, r.userId, r.picks, r.text, r.tiers, r.pairs, r.choices);
    }

    /** the body is the drawing, sent as the file it is; who drew it rides in a header, not the address */
    @PostMapping(value = "/{code}/draw", consumes = { "image/png", "image/webp", "image/jpeg", "application/octet-stream" })
    public Map<String, Object> draw(@PathVariable String code,
            @RequestHeader(value = "X-User-Id", required = false) String userId, @RequestBody byte[] image) {
        return engine.draw(code, userId, image);
    }

    @GetMapping("/{code}/task")
    public Map<String, Object> task(@PathVariable String code,
            @RequestHeader(value = "X-User-Id", required = false) String userId) {
        return engine.task(code, userId);
    }

    /** ids are random and a drawing never changes under one, so it can be kept a long time */
    @GetMapping("/{code}/art/{id}")
    public ResponseEntity<byte[]> art(@PathVariable String code, @PathVariable String id) {
        Game.Art a = engine.art(code, id);
        if (a == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No such drawing");
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(a.contentType()))
                .cacheControl(CacheControl.maxAge(1, TimeUnit.DAYS).cachePrivate().immutable())
                .header("X-Content-Type-Options", "nosniff")
                .body(a.bytes());
    }

    @PostMapping("/{code}/vote")
    public Map<String, Object> vote(@PathVariable String code, @RequestBody PlayRequest r) {
        return engine.vote(code, r.userId, r.choice, r.choices, r.match, r.guesses);
    }

    @PostMapping("/{code}/hurry")
    public Map<String, Object> hurry(@PathVariable String code, @RequestBody PlayRequest r) {
        return engine.hurry(code, r.userId);
    }

    /** One shape for every request; each endpoint reads what it needs. */
    public static class PlayRequest {
        public Long quizId;
        public Long recordId;
        public Long stashId;
        public String userId;
        public String playerId;
        public List<Long> picks;
        public String text;
        public Map<Long, String> tiers;
        public Map<Long, String> pairs;
        public String choice;
        public Integer match;
        public Map<String, String> guesses;
        /** who you are, in a game whose quiz has a roster */
        public String name;
        /** what you chose: entry keys, or one player for a person question */
        public List<String> choices;
    }
}
