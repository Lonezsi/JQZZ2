package com.lonezsi.jqzz.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.lonezsi.jqzz.model.ImageVisibility;
import com.lonezsi.jqzz.model.Quiz;
import com.lonezsi.jqzz.model.StashItem;
import com.lonezsi.jqzz.model.StashKind;
import com.lonezsi.jqzz.service.ImageService;
import com.lonezsi.jqzz.service.StashService;

/** Your stash. Who you are comes from the X-User-Id header, like the image library. */
@RestController
@RequestMapping("/stash")
public class StashController {

    private final StashService stash;
    private final ImageService images;

    public StashController(StashService stash, ImageService images) {
        this.stash = stash;
        this.images = images;
    }

    /** Everything you saved, plus the pictures you uploaded yourself. */
    @GetMapping
    public Map<String, Object> list(@RequestHeader(value = "X-User-Id", required = false) String userId) {
        return Map.of("items", stash.list(userId), "images", images.listMine(userId));
    }

    /** {recordId, questionKey?}: one question of a game you were in, or the whole quiz. */
    @PostMapping("/from-game")
    public List<StashItem> fromGame(@RequestHeader(value = "X-User-Id", required = false) String userId,
                                    @RequestBody Map<String, Object> body) {
        return stash.fromGame(asLong(body.get("recordId")), asLong(body.get("questionKey")), userId);
    }

    /** {quizId}: a quiz from the editor as it is now. */
    @PostMapping("/from-quiz")
    public List<StashItem> fromQuiz(@RequestHeader(value = "X-User-Id", required = false) String userId,
                                    @RequestBody Map<String, Object> body) {
        return stash.fromQuiz(asLong(body.get("quizId")), userId);
    }

    /** {kind, ref}: a copy of someone's public or semi-private item. */
    @PostMapping("/from-ref")
    public StashItem fromReference(@RequestHeader(value = "X-User-Id", required = false) String userId,
                                   @RequestBody Map<String, Object> body) {
        return stash.fromReference(kind(body.get("kind")), String.valueOf(body.get("ref")), userId);
    }

    /** ?kind=QUIZ&q=words: public items anyone can copy in */
    @GetMapping("/public")
    public List<StashItem> browse(@RequestParam("kind") String kind,
                                  @RequestParam(value = "q", required = false) String q) {
        return stash.browse(kind(kind), q);
    }

    @GetMapping("/resolve")
    public ResponseEntity<StashItem> resolve(@RequestHeader(value = "X-User-Id", required = false) String userId,
                                             @RequestParam("kind") String kind,
                                             @RequestParam("ref") String ref) {
        return stash.resolve(kind(kind), ref, userId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}")
    public StashItem get(@RequestHeader(value = "X-User-Id", required = false) String userId,
                         @PathVariable Long id) {
        return stash.get(id, userId);
    }

    /** {handle?, visibility?, title?} */
    @PatchMapping("/{id}")
    public StashItem update(@RequestHeader(value = "X-User-Id", required = false) String userId,
                            @PathVariable Long id,
                            @RequestBody Map<String, Object> body) {
        Object v = body.get("visibility");
        ImageVisibility visibility = null;
        if (v != null) {
            try {
                visibility = ImageVisibility.valueOf(String.valueOf(v).toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid visibility");
            }
        }
        Object payload = body.get("payload");
        return stash.update(id, userId, (String) body.get("handle"), visibility, (String) body.get("title"),
                payload == null ? null : String.valueOf(payload));
    }

    /** {mode: "full" | "add"}: your question types back to the defaults, or the missing defaults added */
    @PostMapping("/types/reset")
    public List<StashItem> resetTypes(@RequestHeader(value = "X-User-Id", required = false) String userId,
                                      @RequestBody Map<String, Object> body) {
        return stash.resetTypes(userId, "full".equals(body.get("mode")));
    }

    /** {name, questionType, answers, steps}: a type made from a question in the editor */
    @PostMapping("/types")
    public StashItem addType(@RequestHeader(value = "X-User-Id", required = false) String userId,
                             @RequestBody Map<String, Object> body) {
        return stash.addType(userId, body);
    }

    /** {recordId, questionKey} or {itemId}, and a title: a question's shape as a new type */
    @PostMapping("/as-type")
    public StashItem asType(@RequestHeader(value = "X-User-Id", required = false) String userId,
                            @RequestBody Map<String, Object> body) {
        return stash.asType(userId, asLong(body.get("recordId")), asLong(body.get("questionKey")),
                asLong(body.get("itemId")), (String) body.get("title"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@RequestHeader(value = "X-User-Id", required = false) String userId,
                                       @PathVariable Long id) {
        stash.delete(id, userId);
        return ResponseEntity.noContent().build();
    }

    /** A stashed quiz as a new quiz of yours. */
    @PostMapping("/{id}/open")
    public Quiz open(@RequestHeader(value = "X-User-Id", required = false) String userId,
                     @PathVariable Long id) {
        return stash.open(id, userId);
    }

    private static StashKind kind(Object kind) {
        try {
            return StashKind.valueOf(String.valueOf(kind).toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "kind is QUIZ, QUESTION or IMAGE");
        }
    }

    private static Long asLong(Object o) {
        if (o instanceof Number n) return n.longValue();
        if (o instanceof String s && s.matches("-?\\d+")) return Long.parseLong(s);
        return null;
    }
}
