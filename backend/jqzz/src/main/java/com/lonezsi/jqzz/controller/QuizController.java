package com.lonezsi.jqzz.controller;

import com.lonezsi.jqzz.model.Quiz;
import com.lonezsi.jqzz.service.QuizService;

import org.springframework.web.bind.annotation.*;

import java.util.List;

import org.springframework.http.ResponseEntity;

@RestController
@RequestMapping("/quizzes")
public class QuizController {

    private final QuizService quizService;

    public QuizController(QuizService quizService) {
        this.quizService = quizService;
    }

    @GetMapping
    public List<Quiz> getAll() {
        return quizService.findAll();
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
