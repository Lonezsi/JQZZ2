package com.lonezsi.jqzz.controller;

import com.lonezsi.jqzz.model.Quiz;
import com.lonezsi.jqzz.repository.QuizRepository;

import org.springframework.web.bind.annotation.*;

import java.util.List;

import org.springframework.http.ResponseEntity;

@RestController
@RequestMapping("/quizzes")
public class QuizController {

    private final QuizRepository quizRepository;

    public QuizController(QuizRepository quizRepository) {
        this.quizRepository = quizRepository;
    }

    @GetMapping
    public List<Quiz> getAll() {
        return quizRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Quiz> getOne(@PathVariable Long id) {
        return quizRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Quiz create(@RequestBody Quiz quiz) {
        return quizRepository.save(quiz);
    }

    @PutMapping("/{id}")
    public Quiz update(@PathVariable Long id, @RequestBody Quiz quiz) {
        quiz.setId(id);
        return quizRepository.save(quiz);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        quizRepository.deleteById(id);
    }
}