package com.lonezsi.jqzz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.lonezsi.jqzz.model.Action;
import com.lonezsi.jqzz.model.Answer;
import com.lonezsi.jqzz.model.Image;
import com.lonezsi.jqzz.model.ImageVisibility;
import com.lonezsi.jqzz.model.Phase;
import com.lonezsi.jqzz.model.Question;
import com.lonezsi.jqzz.model.Quiz;
import com.lonezsi.jqzz.repository.ImageRepository;
import com.lonezsi.jqzz.game.GameEngine;
import com.lonezsi.jqzz.service.QuizPictures;
import com.lonezsi.jqzz.service.QuizService;
import com.lonezsi.jqzz.service.WebPicture;

/** Outside pictures are fetched once when a quiz is saved; games never load an outside address (Condom 6). */
@SpringBootTest
class QuizPicturesTest {

    private static final String LINK = "https://example.com/cat.png";

    @MockitoBean
    private WebPicture web;

    @Autowired
    private QuizService quizzes;

    @Autowired
    private ImageRepository images;

    private static Quiz quizWith(String author, String link) {
        Question q = new Question();
        q.setText("What is this?");
        q.setImageUrl(link);
        Answer a = new Answer();
        a.setText("cat");
        a.setValue(1);
        a.setImageUrl(link);
        q.setAnswers(new ArrayList<>(List.of(a)));
        Action action = new Action();
        action.setPhase(Phase.QUESTION);
        action.setQuestion(q);
        Quiz quiz = new Quiz();
        quiz.setName("pics");
        quiz.setAuthorId(author);
        quiz.setActions(new ArrayList<>(List.of(action)));
        return quiz;
    }

    @Test
    void aLinkIsFetchedOnceAndKeptAsTheAuthorsSharedPicture() {
        String me = "pics-" + System.nanoTime();
        when(web.fetch(anyString())).thenReturn(new WebPicture.Fetched(Pic.png(1), "image/png", "cat"));

        Quiz saved = quizzes.create(quizWith(me, LINK));
        Question q = saved.getQuestions().get(0);
        assertThat(q.getImageUrl()).startsWith(":");
        assertThat(q.getAnswers().get(0).getImageUrl()).isEqualTo(q.getImageUrl());

        List<Image> mine = images.findMine(me);
        assertThat(mine).hasSize(1);
        assertThat(mine.get(0).getVisibility()).isEqualTo(ImageVisibility.SEMI_PRIVATE);
        assertThat(mine.get(0).getSourceUrl()).isEqualTo(LINK);
        verify(web, times(1)).fetch(LINK);

        // an autosave sends the same link again: no second fetch, no second picture
        quizzes.update(saved.getId(), quizWith(me, LINK));
        verify(web, times(1)).fetch(LINK);
        assertThat(images.findMine(me)).hasSize(1);
    }

    @Test
    void aFailedFetchStillSavesTheQuiz() {
        String me = "pics-" + System.nanoTime();
        when(web.fetch(anyString())).thenThrow(new IllegalArgumentException("That address isn't a picture"));
        Quiz saved = quizzes.create(quizWith(me, LINK));
        assertThat(saved.getQuestions().get(0).getImageUrl()).isEqualTo(LINK);
    }

    @Test
    void whichReferencesAreOutside() {
        assertThat(QuizPictures.isOutside("https://a/b.png")).isTrue();
        assertThat(QuizPictures.isOutside("http://x")).isTrue();
        assertThat(QuizPictures.isOutside("//x/y")).isTrue();
        assertThat(QuizPictures.isOutside(":cat")).isFalse();
        assertThat(QuizPictures.isOutside("anna:dog")).isFalse();
        assertThat(QuizPictures.isOutside("cat")).isFalse();
        assertThat(QuizPictures.isOutside(null)).isFalse();
    }

    @Test
    void aGameDropsALeftoverOutsideLink() {
        assertThat(GameEngine.kept(LINK)).isNull();
        assertThat(GameEngine.kept(":cat")).isEqualTo(":cat");
    }
}
