package com.lonezsi.jqzz.controller;

import com.lonezsi.jqzz.config.LoginKeyFilter;
import com.lonezsi.jqzz.model.Phase;
import com.lonezsi.jqzz.model.Quiz;
import com.lonezsi.jqzz.model.User;
import com.lonezsi.jqzz.repository.UserRepository;
import com.lonezsi.jqzz.service.QuizService;

import org.springframework.web.bind.annotation.*;

import java.util.List;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import org.springframework.http.ResponseEntity;

@RestController
@RequestMapping("/quizzes")
public class QuizController {

    private final QuizService quizService;

    private final JsonMapper json;

    private final boolean enforced;

    private final UserRepository users;

    public QuizController(QuizService quizService, JsonMapper json, UserRepository users,
                          @org.springframework.beans.factory.annotation.Value("${jqzz.auth.enforce-login-key:true}") boolean enforced) {
        this.json = json;
        this.users = users;
        this.quizService = quizService;
        this.enforced = enforced;
    }

    @GetMapping
    public Object getAll(@RequestParam(value = "summary", required = false) Boolean summary) {
        List<Quiz> all = quizService.findAll();
        ArrayNode list = json.valueToTree(all);
        for (JsonNode quiz : list) {
            // who's coming names real friends, and this list is everyone's
            withoutRoster(quiz);
            if (!Boolean.TRUE.equals(summary)) continue;
            // the sidebar's list: each step's phase and time, and its question's text
            // for searching; answers, pictures and explanations come with the quiz itself
            ((ObjectNode) quiz).put("summary", true);
            for (JsonNode action : quiz.path("actions")) {
                JsonNode q = action.get("question");
                if (q instanceof ObjectNode question) question.retain("id", "text", "type");
            }
        }
        return list;
    }

    /** the roster only for whoever made the quiz and the admin (whose script editor reads it here); quizzes from before authors are anyone's */
    @GetMapping("/{id}")
    public ResponseEntity<JsonNode> getOne(@PathVariable Long id,
                                           @RequestAttribute(value = LoginKeyFilter.USER, required = false) String me) {
        Quiz quiz = quizService.findById(id).orElse(null);
        if (quiz == null) return ResponseEntity.notFound().build();
        JsonNode tree = json.valueToTree(quiz);
        String author = quiz.getAuthorId();
        boolean theirs = (author == null || author.isBlank() ? !enforced : author.equals(me)) || isAdmin(me);
        if (!theirs) withoutRoster(tree);
        return ResponseEntity.ok(tree);
    }

    /** drops the ROSTER steps from a quiz as JSON; the stored quiz is never touched */
    private static void withoutRoster(JsonNode quiz) {
        if (!(quiz.get("actions") instanceof ArrayNode actions)) return;
        for (int i = actions.size() - 1; i >= 0; i--) {
            if (Phase.ROSTER.name().equals(actions.get(i).path("phase").asString(""))) actions.remove(i);
        }
    }

    @PostMapping
    public ResponseEntity<Quiz> create(@RequestBody Quiz quiz,
                                       @RequestAttribute(value = LoginKeyFilter.USER, required = false) String me) {
        // a quiz always has an author, and it is whoever the login key proves
        if (enforced) {
            if (me == null) return ResponseEntity.status(org.springframework.http.HttpStatus.UNAUTHORIZED).build();
            quiz.setAuthorId(me);
        }
        return ResponseEntity.ok(quizService.create(quiz));
    }

    private boolean isAdmin(String id) {
        return id != null && users.findById(id).map(User::isAdmin).orElse(false);
    }

    /** a quiz with no author is the admin's; with keys off, anyone's (the tests) */
    private boolean mayChange(String author, String me) {
        if (!enforced) return true;
        if (author == null || author.isBlank()) return isAdmin(me);
        return author.equals(me);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Quiz> update(@PathVariable Long id, @RequestBody Quiz quiz,
                                       @RequestAttribute(value = LoginKeyFilter.USER, required = false) String me) {
        // only whoever made it saves over it (its login key proved who that is)
        String author = quizService.findById(id).map(Quiz::getAuthorId).orElse(null);
        if (enforced && !mayChange(author, me)) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.FORBIDDEN).build();
        }
        return quizService.update(id, quiz)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** Only whoever made a quiz can delete it; quizzes from before authors were kept are anyone's. */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id,
                                    @RequestHeader(value = "X-User-Id", required = false) String header,
                                    @RequestAttribute(value = LoginKeyFilter.USER, required = false) String me) {
        Quiz quiz = quizService.findById(id).orElse(null);
        if (quiz == null) return ResponseEntity.notFound().build();
        String author = quiz.getAuthorId();
        String userId = enforced ? me : header;
        boolean authorless = author == null || author.isBlank();
        if (enforced ? !mayChange(author, userId) : (!authorless && !author.equals(userId))) {
            return ResponseEntity.status(403).body("Only its author can delete this quiz");
        }
        return quizService.delete(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}
