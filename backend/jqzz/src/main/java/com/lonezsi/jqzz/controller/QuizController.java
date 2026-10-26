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

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        return quizService.delete(id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}
