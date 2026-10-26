package com.lonezsi.jqzz.controller;

import com.lonezsi.jqzz.model.Quiz;
import com.lonezsi.jqzz.service.QuizService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.Arrays;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class QuizControllerTest {

    @Mock
    private QuizService quizService;

    @InjectMocks
    private QuizController quizController;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(quizController).build();
    }

    @Test
    void getAllQuizzes_returnsList() throws Exception {
        Quiz quiz1 = new Quiz();
        quiz1.setId(1L);
        quiz1.setName("Quiz 1");
        
        Quiz quiz2 = new Quiz();
        quiz2.setId(2L);
        quiz2.setName("Quiz 2");

        when(quizService.findAll()).thenReturn(Arrays.asList(quiz1, quiz2));

        mockMvc.perform(get("/quizzes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[1].id").value(2));
    }

    @Test
    void getQuizById_success() throws Exception {
        Quiz quiz = new Quiz();
        quiz.setId(1L);
        quiz.setName("Test Quiz");

        when(quizService.findById(1L)).thenReturn(Optional.of(quiz));

        mockMvc.perform(get("/quizzes/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.name").value("Test Quiz"));
    }

    @Test
    void getQuizById_notFound_throwsException() throws Exception {
        when(quizService.findById(999L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/quizzes/999"))
                .andExpect(status().isNotFound());
    }

    @Test
    void createQuiz_success() throws Exception {
        Quiz quiz = new Quiz();
        quiz.setId(1L);
        quiz.setName("New Quiz");

        when(quizService.create(any(Quiz.class))).thenReturn(quiz);

        mockMvc.perform(post("/quizzes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"New Quiz\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.name").value("New Quiz"));
    }

    @Test
    void updateQuiz_success() throws Exception {
        Quiz existingQuiz = new Quiz();
        existingQuiz.setId(1L);
        existingQuiz.setName("Old Name");
        
        Quiz updatedQuiz = new Quiz();
        updatedQuiz.setId(1L);
        updatedQuiz.setName("New Name");

        when(quizService.update(eq(1L), any(Quiz.class))).thenReturn(Optional.of(updatedQuiz));

        mockMvc.perform(put("/quizzes/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"New Name\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.name").value("New Name"));
    }

    @Test
    void updateQuiz_notFound() throws Exception {
        when(quizService.update(eq(999L), any(Quiz.class))).thenReturn(Optional.empty());

        mockMvc.perform(put("/quizzes/999")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"New Name\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void deleteQuiz_success() throws Exception {
        when(quizService.delete(1L)).thenReturn(true);

        mockMvc.perform(delete("/quizzes/1"))
                .andExpect(status().isNoContent());
    }
}