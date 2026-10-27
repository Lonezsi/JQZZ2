package com.lonezsi.jqzz.game;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import org.junit.jupiter.api.Test;

import com.lonezsi.jqzz.model.Action;
import com.lonezsi.jqzz.model.Answer;
import com.lonezsi.jqzz.model.Phase;
import com.lonezsi.jqzz.model.Question;
import com.lonezsi.jqzz.model.QuestionType;
import com.lonezsi.jqzz.model.Quiz;

/** SETTING blocks change how the questions after them play, until the next one. */
class SettingsTest {

    private static Question question(long id) {
        Question q = new Question();
        q.setId(id);
        q.setText("Q" + id);
        q.setType(QuestionType.PREWRITTEN_SINGLE);
        List<Answer> answers = new ArrayList<>();
        for (int i = 1; i <= 4; i++) {
            Answer a = new Answer();
            a.setId(id * 10 + i);
            a.setText("a" + i);
            a.setValue(i == 1 ? 100 : 0);
            answers.add(a);
        }
        q.setAnswers(answers);
        return q;
    }

    private static Quiz quiz(Object... items) {
        Quiz quiz = new Quiz();
        List<Action> actions = new ArrayList<>();
        for (Object item : items) {
            if (item instanceof String setting) {
                Action a = new Action(null, Phase.SETTING, 0);
                a.setPreview(setting);
                actions.add(a);
            } else {
                Question q = question((Long) item);
                actions.add(new Action(q, Phase.QUESTION, 20));
                actions.add(new Action(q, Phase.ANSWER, 5));
            }
        }
        quiz.setActions(actions);
        return quiz;
    }

    private static List<Long> order(List<Game.Step> steps) {
        List<Long> ids = new ArrayList<>();
        for (Game.Step s : steps) if (!ids.contains(s.question().id())) ids.add(s.question().id());
        return ids;
    }

    @Test
    void shuffleOnlyMovesTheQuestionsInsideItsGroup() {
        Quiz quiz = quiz(1L, 2L, "shuffle=on", 3L, 4L, 5L, 6L, 7L, "shuffle=off", 8L);
        boolean moved = false;
        for (int seed = 0; seed < 20; seed++) {
            List<Game.Step> steps = GameEngine.snapshot(quiz, new Random(seed));
            List<Long> ids = order(steps);
            assertThat(ids.subList(0, 2)).containsExactly(1L, 2L);
            assertThat(ids.subList(2, 7)).containsExactlyInAnyOrder(3L, 4L, 5L, 6L, 7L);
            assertThat(ids.get(7)).isEqualTo(8L);
            moved |= !ids.subList(2, 7).equals(List.of(3L, 4L, 5L, 6L, 7L));
            // each question keeps its own steps together, in order
            for (int i = 0; i < steps.size(); i += 2) {
                assertThat(steps.get(i).phase()).isEqualTo(Phase.QUESTION);
                assertThat(steps.get(i + 1).question().id()).isEqualTo(steps.get(i).question().id());
            }
        }
        assertThat(moved).isTrue();
    }

    @Test
    void gradeAndPointsWeighTheQuestionsUntilChanged() {
        List<Game.Step> steps = GameEngine.snapshot(
                quiz(1L, "grade=off", 2L, "grade=on, points=2", 3L, "points=1", 4L), new Random(1));
        List<Integer> weights = new ArrayList<>();
        for (int i = 0; i < steps.size(); i += 2) weights.add(steps.get(i).question().weight());
        assertThat(weights).containsExactly(100, 0, 200, 100);
    }

    @Test
    void mixShufflesAnswersButKeepsThemTheSameForEveryStep() {
        List<Game.Step> steps = GameEngine.snapshot(quiz("mix", 1L), new Random(3));
        assertThat(steps.get(0).question()).isSameAs(steps.get(1).question());
        assertThat(steps.get(0).question().answers()).extracting(Game.AnswerSnap::id)
                .containsExactlyInAnyOrder(11L, 12L, 13L, 14L);
    }

    @Test
    void doublePointsDoubleTheScore() {
        Game.QuestionSnap q = new Game.QuestionSnap(1, "Q", null, QuestionType.PREWRITTEN_SINGLE, null, null,
                List.of(new Game.AnswerSnap(11, "right", null, 100), new Game.AnswerSnap(12, "wrong", null, 0)), 200);
        Game g = new Game("ABCDE", "host", "quiz",
                List.of(new Game.Step(Phase.QUESTION, 20, q), new Game.Step(Phase.ANSWER, 5, q)), new Random(1), 0);
        g.addPlayer("p", "p", null, 0);
        g.start(0);
        g.submit("p", List.of(11L), null, null, 1, id -> true);
        g.skip(2);
        g.skip(3);
        assertThat(g.players.get("p").score).isEqualTo(200);
    }
}
