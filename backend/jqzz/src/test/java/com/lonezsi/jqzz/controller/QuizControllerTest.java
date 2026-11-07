package com.lonezsi.jqzz.controller;

import com.lonezsi.jqzz.model.Action;
import com.lonezsi.jqzz.model.Answer;
import com.lonezsi.jqzz.model.Phase;
import com.lonezsi.jqzz.model.Question;
import com.lonezsi.jqzz.model.QuestionType;
import com.lonezsi.jqzz.model.Quiz;
import tools.jackson.databind.json.JsonMapper;
import java.util.ArrayList;
import java.util.List;
import com.lonezsi.jqzz.config.LoginKeyFilter;
import com.lonezsi.jqzz.model.User;
import com.lonezsi.jqzz.repository.UserRepository;
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

    @Mock
    private UserRepository users;

    private QuizController quizController;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        quizController = new QuizController(quizService, JsonMapper.builder().build(), users, false);
        mockMvc = MockMvcBuilders.standaloneSetup(quizController).build();
    }

    @Test
    void theSummaryKeepsQuestionTextsButNotAnswers() throws Exception {
        Question q = new Question();
        q.setId(5L);
        q.setText("Longest river?");
        q.setType(QuestionType.PREWRITTEN_SINGLE);
        q.setElaborationText("the Nile");
        Answer a = new Answer();
        a.setId(9L);
        a.setText("Nile");
        q.setAnswers(List.of(a));
        Quiz quiz = new Quiz();
        quiz.setId(1L);
        quiz.setName("Rivers");
        quiz.setActions(new ArrayList<>(List.of(new Action(q, Phase.QUESTION, 30))));
        when(quizService.findAll()).thenReturn(List.of(quiz));

        mockMvc.perform(get("/quizzes").param("summary", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].summary").value(true))
                .andExpect(jsonPath("$[0].actions[0].phase").value("QUESTION"))
                .andExpect(jsonPath("$[0].actions[0].time").value(30))
                .andExpect(jsonPath("$[0].actions[0].question.text").value("Longest river?"))
                .andExpect(jsonPath("$[0].actions[0].question.answers").doesNotExist())
                .andExpect(jsonPath("$[0].actions[0].question.elaborationText").doesNotExist());
        // without asking for it, the list is whole as before
        mockMvc.perform(get("/quizzes"))
                .andExpect(jsonPath("$[0].actions[0].question.answers[0].text").value("Nile"));
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
        Quiz quiz = new Quiz();
        quiz.setAuthorId("abc");
        when(quizService.findById(1L)).thenReturn(Optional.of(quiz));
        when(quizService.delete(1L)).thenReturn(true);

        mockMvc.perform(delete("/quizzes/1").header("X-User-Id", "abc"))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteQuiz_onlyByItsAuthor() throws Exception {
        Quiz quiz = new Quiz();
        quiz.setAuthorId("abc");
        when(quizService.findById(1L)).thenReturn(Optional.of(quiz));

        mockMvc.perform(delete("/quizzes/1").header("X-User-Id", "someone"))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/quizzes/1"))
                .andExpect(status().isForbidden());
    }

    /** a quiz by "anna" with who's coming in its first step */
    private static Quiz withRoster(String author) {
        Action roster = new Action(null, Phase.ROSTER, 0);
        roster.setPreview("{\"names\":[\"Anna\",\"Bence\"],\"unique\":true}");
        Question q = new Question();
        q.setId(5L);
        q.setText("What did you do yesterday?");
        Quiz quiz = new Quiz();
        quiz.setId(1L);
        quiz.setName("Yesterday");
        quiz.setAuthorId(author);
        quiz.setActions(new ArrayList<>(List.of(roster, new Action(q, Phase.QUESTION, 60))));
        return quiz;
    }

    @Test
    void theListNeverShowsARoster() throws Exception {
        when(quizService.findAll()).thenReturn(List.of(withRoster("anna")));
        for (String summary : new String[] { "true", "false" }) {
            mockMvc.perform(get("/quizzes").param("summary", summary).requestAttr(LoginKeyFilter.USER, "anna"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].actions.length()").value(1))
                    .andExpect(jsonPath("$[0].actions[0].phase").value("QUESTION"));
        }
        mockMvc.perform(get("/quizzes"))
                .andExpect(jsonPath("$[0].actions.length()").value(1));
    }

    @Test
    void onlyTheAuthorAndTheAdminGetTheRoster() throws Exception {
        when(quizService.findById(1L)).thenReturn(Optional.of(withRoster("anna")));
        User admin = new User();
        admin.setId("boss");
        admin.setAdmin(true);
        User someone = new User();
        someone.setId("bob");
        when(users.findById("boss")).thenReturn(Optional.of(admin));
        when(users.findById("bob")).thenReturn(Optional.of(someone));

        mockMvc.perform(get("/quizzes/1").requestAttr(LoginKeyFilter.USER, "anna"))
                .andExpect(jsonPath("$.actions.length()").value(2))
                .andExpect(jsonPath("$.actions[0].phase").value("ROSTER"))
                .andExpect(jsonPath("$.actions[0].preview").value("{\"names\":[\"Anna\",\"Bence\"],\"unique\":true}"));
        mockMvc.perform(get("/quizzes/1").requestAttr(LoginKeyFilter.USER, "boss"))
                .andExpect(jsonPath("$.actions.length()").value(2));
        mockMvc.perform(get("/quizzes/1").requestAttr(LoginKeyFilter.USER, "bob"))
                .andExpect(jsonPath("$.actions.length()").value(1))
                .andExpect(jsonPath("$.actions[0].phase").value("QUESTION"));
        // a quiz from before authors were kept is anyone's, roster and all
        when(quizService.findById(2L)).thenReturn(Optional.of(withRoster(null)));
        mockMvc.perform(get("/quizzes/2").requestAttr(LoginKeyFilter.USER, "bob"))
                .andExpect(jsonPath("$.actions.length()").value(2));
    }

    @Test
    void getOne_withoutAKey_stillWorks() throws Exception {
        when(quizService.findById(1L)).thenReturn(Optional.of(withRoster("anna")));
        mockMvc.perform(get("/quizzes/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Yesterday"))
                .andExpect(jsonPath("$.actions.length()").value(1));
    }
}
