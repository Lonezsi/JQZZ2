package com.lonezsi.jqzz.controller;

import com.lonezsi.jqzz.model.Quiz;
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

    public QuizController(QuizService quizService, JsonMapper json) {
        this.json = json;
        this.quizService = quizService;
    }

    @GetMapping
    public Object getAll(@RequestParam(value = "summary", required = false) Boolean summary) {
        List<Quiz> all = quizService.findAll();
        if (!Boolean.TRUE.equals(summary)) return all;
        // the sidebar's list: each step's phase and time, and its question's text
        // for searching; answers, pictures and explanations come with the quiz itself
        ArrayNode list = json.valueToTree(all);
        for (JsonNode quiz : list) {
            ((ObjectNode) quiz).put("summary", true);
            for (JsonNode action : quiz.path("actions")) {
                JsonNode q = action.get("question");
                if (q instanceof ObjectNode question) question.retain("id", "text", "type");
            }
        }
        return list;
    }

    @GetMapping("/{id}")
    public ResponseEntity<Quiz> getOne(@PathVariable Long id) {
        return quizService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Quiz create(@RequestBody Quiz quiz) {
        return quizService.create(quiz);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Quiz> update(@PathVariable Long id, @RequestBody Quiz quiz) {
        return quizService.update(id, quiz)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** Only whoever made a quiz can delete it; quizzes from before authors were kept are anyone's. */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id,
                                    @RequestHeader(value = "X-User-Id", required = false) String userId) {
        Quiz quiz = quizService.findById(id).orElse(null);
        if (quiz == null) return ResponseEntity.notFound().build();
        String author = quiz.getAuthorId();
        if (author != null && !author.isBlank() && !author.equals(userId)) {
            return ResponseEntity.status(403).body("Only its author can delete this quiz");
        }
        return quizService.delete(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}
