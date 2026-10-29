package com.lonezsi.jqzz.game;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import com.lonezsi.jqzz.model.Action;
import com.lonezsi.jqzz.model.Answer;
import com.lonezsi.jqzz.model.Phase;
import com.lonezsi.jqzz.model.Question;
import com.lonezsi.jqzz.model.QuestionType;
import com.lonezsi.jqzz.model.Quiz;
import com.lonezsi.jqzz.model.User;
import com.lonezsi.jqzz.repository.GameRecordRepository;
import com.lonezsi.jqzz.repository.QuizRepository;
import com.lonezsi.jqzz.repository.UserRepository;
import com.lonezsi.jqzz.service.NotificationService;
import com.lonezsi.jqzz.service.PresenceTracker;

import tools.jackson.databind.json.JsonMapper;

/** What happens when people leave a game and come back. */
class ComingAndGoingTest {

    private PresenceTracker presence;
    private GameEngine engine;
    private boolean hostWatching;
    private Quiz quiz;
    private Question q;

    @BeforeEach
    void setUp() {
        q = new Question();
        q.setId(1L);
        q.setText("Q");
        q.setType(QuestionType.PREWRITTEN_SINGLE);
        Answer a = new Answer();
        a.setId(11L);
        a.setText("a");
        a.setValue(100);
        q.setAnswers(List.of(a));
        quiz = new Quiz();
        quiz.setId(7L);
        quiz.setName("quiz");
        quiz.setActions(new ArrayList<>(List.of(new Action(q, Phase.QUESTION, 600))));

        QuizRepository quizzes = mock(QuizRepository.class);
        when(quizzes.findById(7L)).thenReturn(Optional.of(quiz));
        UserRepository users = mock(UserRepository.class);
        when(users.existsById(anyString())).thenReturn(true);
        when(users.findById(anyString())).thenAnswer(inv -> {
            User u = new User();
            u.setId(inv.getArgument(0));
            u.setName(inv.getArgument(0));
            return Optional.of(u);
        });
        presence = mock(PresenceTracker.class);
        when(presence.isWatching(eq("host"), anyString())).thenAnswer(inv -> hostWatching);
        engine = new GameEngine(quizzes, users, mock(SimpMessagingTemplate.class), presence,
                mock(GameRecordRepository.class), JsonMapper.builder().build());
    }

    @AfterEach
    void tearDown() {
        engine.stop();
    }

    private String startedGame() {
        String code = (String) engine.host(7L, "host").get("code");
        engine.join(code, "p1");
        engine.start(code, "host");
        return code;
    }

    @Test
    void aKickedPlayerCantJoinAgain() {
        String code = startedGame();
        engine.kick(code, "host", "p1");
        assertThatThrownBy(() -> engine.join(code, "p1")).hasMessageContaining("took you out");
        // leaving on your own is different: you can come back
        engine.join(code, "p2");
        engine.leave(code, "p2");
        engine.join(code, "p2");
        assertThat(engine.game(code).players).containsOnlyKeys("p2");
    }

    @Test
    void theGameWaitsForTheHostAndCarriesOnWhenTheyreBack() {
        String code = startedGame();
        Game g = engine.game(code);

        hostWatching = false;
        engine.hostCheck(code);
        assertThat(g.status()).isEqualTo(Game.Status.PLAYING); // a blink: still running

        g.hostAwaySince = engine.now() - GameEngine.HOST_GRACE_MS - 1;
        engine.hostCheck(code);
        assertThat(g.status()).isEqualTo(Game.Status.PAUSED);
        assertThat(g.pausedForHost).isTrue();

        hostWatching = true;
        engine.hostCheck(code);
        assertThat(g.status()).isEqualTo(Game.Status.PLAYING);
        assertThat(g.pausedForHost).isFalse();
        assertThat(g.hostAwaySince).isZero();
    }

    @Test
    void aHostWhoNeverComesBackEndsTheGame() {
        String code = startedGame();
        Game g = engine.game(code);
        hostWatching = false;
        g.hostAwaySince = engine.now() - GameEngine.HOST_GRACE_MS - 1;
        engine.hostCheck(code);
        g.hostAwaySince = engine.now() - GameEngine.HOST_GRACE_MS - GameEngine.HOST_GIVE_UP_MS - 1;
        engine.hostCheck(code);
        assertThat(g.status()).isEqualTo(Game.Status.FINISHED);
    }

    @Test
    void aPauseTheHostMadeIsTheirsToLift() {
        String code = startedGame();
        engine.pause(code, "host");
        hostWatching = true;
        engine.hostCheck(code);
        assertThat(engine.game(code).status()).isEqualTo(Game.Status.PAUSED);
    }

    @Test
    void yourUnfinishedGamesAreListed() {
        String code = startedGame();
        List<Map<String, Object>> hostGames = engine.mine("host");
        assertThat(hostGames).extracting(m -> m.get("code")).containsExactly(code);
        assertThat(hostGames.get(0).get("role")).isEqualTo("host");
        assertThat(engine.mine("p1").get(0).get("role")).isEqualTo("player");
        assertThat(engine.mine("stranger")).isEmpty();
        engine.end(code, "host");
        assertThat(engine.mine("p1")).isEmpty();
    }

    @Test
    void anyoneCanJoinMidGameUnlessTheQuizClosesTheDoors() {
        String open = startedGame();
        engine.join(open, "late");
        assertThat(engine.game(open).players).containsKeys("p1", "late");

        Action doors = new Action(null, Phase.SETTING, 0);
        doors.setPreview("latejoin=off");
        quiz.getActions().add(0, doors);
        String closed = startedGame();
        assertThatThrownBy(() -> engine.join(closed, "late")).hasMessageContaining("isn't taking new players");
        // but whoever was in can always come back
        engine.leave(closed, "p1");
        engine.join(closed, "p1");
        assertThat(engine.game(closed).players).containsOnlyKeys("p1");
    }

    @Test
    void theHostCanInviteAnyoneOnlyTheHost() {
        NotificationService notes = mock(NotificationService.class);
        engine.setNotifications(notes);
        String code = startedGame();
        engine.invite(code, "host", "away");
        verify(notes).notify(eq("away"), eq("INVITE"), eq("host"), any());
        assertThatThrownBy(() -> engine.invite(code, "p1", "away")).hasMessageContaining("Only the host");
        assertThatThrownBy(() -> engine.invite(code, "host", "p1")).hasMessageContaining("already in");
    }
}
