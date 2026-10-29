package com.lonezsi.jqzz.game;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.function.Predicate;

import org.junit.jupiter.api.Test;

import com.lonezsi.jqzz.model.Phase;
import com.lonezsi.jqzz.model.QuestionType;

class GameTest {

    private static final Predicate<String> EVERYONE_ONLINE = id -> true;

    private static Game.QuestionSnap question(long id, QuestionType type, Game.AnswerSnap... answers) {
        return new Game.QuestionSnap(id, "Question " + id, null, type, "because", null, List.of(answers));
    }

    private static Game.AnswerSnap answer(long id, int value) {
        return new Game.AnswerSnap(id, "answer " + id, null, value);
    }

    /** a question played the usual way: wait, ask, reveal, scores */
    private static List<Game.Step> round(Game.QuestionSnap q) {
        return List.of(
            new Game.Step(Phase.WAITING, 3, q),
            new Game.Step(Phase.QUESTION, 20, q),
            new Game.Step(Phase.ANSWER, 10, q),
            new Game.Step(Phase.RESULT, 5, q));
    }

    private static Game game(List<Game.Step> steps, String... players) {
        Game g = new Game("ABCDE", "host", "quiz", steps, new Random(7), 0);
        for (String p : players) g.addPlayer(p, p, null, 0);
        return g;
    }

    private static int score(Game g, String player) {
        return g.players.get(player).score;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> q(Map<String, Object> view) {
        return (Map<String, Object>) view.get("question");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> reveal(Map<String, Object> view) {
        return (Map<String, Object>) view.get("reveal");
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> list(Object o) {
        return (List<Map<String, Object>>) o;
    }

    @Test
    void hurryEmptiesEveryStepAndDrawingStaysUntilTheyStop() {
        Game g = game(round(question(1, QuestionType.PREWRITTEN_SINGLE, answer(10, 0), answer(11, 500))), "ann", "bob");
        assertThatThrownBy(() -> g.hurry("ann", 0)).isInstanceOf(IllegalStateException.class);
        g.start(0);
        g.skip(1); // into QUESTION

        g.hurry("ann", 2);
        g.hurry("ann", 2);
        g.drawing("bob", true, 2);
        assertThatThrownBy(() -> g.hurry("eve", 2)).isInstanceOf(IllegalStateException.class);
        Map<String, Object> asking = g.view(3, EVERYONE_ONLINE);
        assertThat(asking.get("hurry")).isEqualTo(List.of("ann"));
        assertThat(asking.get("drawing")).isEqualTo(List.of("bob"));

        g.skip(4); // into ANSWER
        Map<String, Object> next = g.view(5, EVERYONE_ONLINE);
        assertThat(next.get("hurry")).isEqualTo(List.of());
        assertThat(next.get("drawing")).isEqualTo(List.of("bob"));

        g.drawing("bob", false, 6);
        g.drawing("ann", true, 6);
        g.removePlayer("ann", 7);
        assertThat(g.view(8, EVERYONE_ONLINE).get("drawing")).isEqualTo(List.of());
    }

    @Test
    void singleChoice_scoresTheValueOfThePickAndHidesItUntilTheReveal() {
        Game g = game(round(question(1, QuestionType.PREWRITTEN_SINGLE, answer(10, 0), answer(11, 500))), "ann", "bob");
        g.start(0);
        g.skip(1); // into QUESTION

        Map<String, Object> asking = g.view(2, EVERYONE_ONLINE);
        assertThat(asking.get("interaction")).isEqualTo("answer");
        assertThat(list(q(asking).get("answers"))).allSatisfy(a -> assertThat(a).doesNotContainKey("value"));
        assertThat(asking).doesNotContainKey("reveal");

        g.submit("ann", List.of(11L), null, null, 3, EVERYONE_ONLINE);
        g.submit("bob", List.of(10L), null, null, 4, EVERYONE_ONLINE);
        g.skip(5); // into ANSWER

        Map<String, Object> revealed = g.view(6, EVERYONE_ONLINE);
        assertThat(reveal(revealed).get("correct")).isEqualTo(List.of(11L));
        assertThat(score(g, "ann")).isEqualTo(500);
        assertThat(score(g, "bob")).isZero();
        assertThat(g.players.get("ann").gain).isEqualTo(500);
    }

    @Test
    void singleChoice_rejectsAnythingButOneRealAnswer() {
        Game g = game(round(question(1, QuestionType.PREWRITTEN_SINGLE, answer(10, 100))), "ann");
        g.start(0);
        g.skip(1);
        assertThatThrownBy(() -> g.submit("ann", List.of(99L), null, null, 2, EVERYONE_ONLINE))
            .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> g.submit("stranger", List.of(10L), null, null, 2, EVERYONE_ONLINE))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void answersAreClosedOutsideTheQuestionStep() {
        Game g = game(round(question(1, QuestionType.PREWRITTEN_SINGLE, answer(10, 100))), "ann");
        g.start(0); // WAITING
        assertThatThrownBy(() -> g.submit("ann", List.of(10L), null, null, 1, EVERYONE_ONLINE))
            .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void multipleChoice_addsUpThePicksButNeverGoesBelowZero() {
        Game g = game(round(question(1, QuestionType.PREWRITTEN_MULTIPLE,
            answer(10, 200), answer(11, 300), answer(12, -400))), "ann", "bob");
        g.start(0);
        g.skip(1);
        g.submit("ann", List.of(10L, 11L), null, null, 2, EVERYONE_ONLINE);
        g.submit("bob", List.of(10L, 12L), null, null, 2, EVERYONE_ONLINE);
        g.skip(3);
        assertThat(score(g, "ann")).isEqualTo(500);
        assertThat(score(g, "bob")).isZero();
    }

    @Test
    void whenEveryoneConnectedHasAnswered_theQuestionEndsSoon() {
        Game g = game(round(question(1, QuestionType.PREWRITTEN_SINGLE, answer(10, 100))), "ann", "bob");
        g.start(0);
        g.skip(1000);
        long full = g.endsAt;
        g.submit("ann", List.of(10L), null, null, 2000, EVERYONE_ONLINE);
        assertThat(g.endsAt).isEqualTo(full);
        g.submit("bob", List.of(10L), null, null, 3000, EVERYONE_ONLINE);
        assertThat(g.endsAt).isEqualTo(3000 + Game.EVERYONE_DONE_MS);
    }

    @Test
    void someoneWhoLeft_doesNotHoldUpTheQuestion() {
        Game g = game(round(question(1, QuestionType.PREWRITTEN_SINGLE, answer(10, 100))), "ann", "gone");
        g.start(0);
        g.skip(1000);
        g.submit("ann", List.of(10L), null, null, 2000, id -> !id.equals("gone"));
        assertThat(g.endsAt).isEqualTo(2000 + Game.EVERYONE_DONE_MS);
    }

    @Test
    void tierList_scoresAgreementWithTheCrowd() {
        Game g = game(round(question(1, QuestionType.TIERLIST, answer(10, 0), answer(11, 0))), "ann", "bob", "cat");
        g.start(0);
        g.skip(1);
        g.submit("ann", null, null, Map.of(10L, "S", 11L, "D"), 2, EVERYONE_ONLINE);
        g.submit("bob", null, null, Map.of(10L, "S", 11L, "C"), 2, EVERYONE_ONLINE);
        g.submit("cat", null, null, Map.of(10L, "A", 11L, "C"), 2, EVERYONE_ONLINE);
        g.skip(3);
        assertThat(g.questions.get(1L).consensus).containsEntry(10L, "S").containsEntry(11L, "C");
        assertThat(score(g, "ann")).isEqualTo(Game.TIER_POINTS);
        assertThat(score(g, "bob")).isEqualTo(2 * Game.TIER_POINTS);
        assertThat(score(g, "cat")).isEqualTo(Game.TIER_POINTS);
    }

    @Test
    void writeAndVote_hidesAuthorsWhileVotingAndPaysForVotes() {
        Game g = game(round(question(1, QuestionType.USER_GENERATED_VOTE)), "ann", "bob", "cat");
        g.start(0);
        g.skip(1);
        g.submit("ann", null, "a cat", null, 2, EVERYONE_ONLINE);
        g.submit("bob", null, "a dog", null, 2, EVERYONE_ONLINE);
        g.submit("cat", null, "a fish", null, 2, EVERYONE_ONLINE);
        g.skip(3); // ANSWER: vote

        Map<String, Object> voting = g.view(4, EVERYONE_ONLINE);
        assertThat(voting.get("interaction")).isEqualTo("vote");
        List<Map<String, Object>> entries = list(reveal(voting).get("entries"));
        assertThat(entries).hasSize(3).allSatisfy(e -> assertThat(e).doesNotContainKey("authorId"));

        String annKey = keyOf(g, "ann");
        assertThatThrownBy(() -> g.vote("ann", annKey, null, null, 5, EVERYONE_ONLINE))
            .isInstanceOf(IllegalArgumentException.class);
        g.vote("bob", annKey, null, null, 5, EVERYONE_ONLINE);
        g.vote("cat", annKey, null, null, 5, EVERYONE_ONLINE);
        g.skip(6); // leaves ANSWER: settles

        assertThat(score(g, "ann")).isEqualTo(2 * Game.VOTE_POINTS);
        Map<String, Object> after = g.view(7, EVERYONE_ONLINE);
        assertThat(list(reveal(after).get("entries"))).allSatisfy(e -> assertThat(e).containsKey("authorId"));
    }

    @Test
    void whoWroteIt_paysForCorrectGuesses() {
        Game g = game(round(question(1, QuestionType.USER_GENERATED_IDENTIFY)), "ann", "bob");
        g.start(0);
        g.skip(1);
        g.submit("ann", null, "secret a", null, 2, EVERYONE_ONLINE);
        g.submit("bob", null, "secret b", null, 2, EVERYONE_ONLINE);
        g.skip(3);
        assertThat(g.view(4, EVERYONE_ONLINE).get("interaction")).isEqualTo("guess");
        g.vote("ann", null, null, Map.of(keyOf(g, "bob"), "bob"), 5, EVERYONE_ONLINE);
        g.vote("bob", null, null, Map.of(keyOf(g, "ann"), "bob"), 5, EVERYONE_ONLINE);
        g.skip(6);
        assertThat(score(g, "ann")).isEqualTo(Game.GUESS_POINTS);
        assertThat(score(g, "bob")).isZero();
    }

    @Test
    void knockout_runsRoundsOnTheClockAndCrownsAChampion() {
        Game g = game(round(question(1, QuestionType.KNOCKOUT_BATTLE)), "ann", "bob", "cat", "dan");
        g.start(0);
        g.skip(1000);
        for (String p : List.of("ann", "bob", "cat", "dan")) g.submit(p, null, "pick " + p, null, 2000, EVERYONE_ONLINE);
        g.skip(3000); // ANSWER: the bracket

        Game.Bracket b = g.questions.get(1L).bracket;
        assertThat(b.rounds).isEqualTo(2);
        assertThat(b.matches).hasSize(2);
        assertThat(g.view(3001, EVERYONE_ONLINE).get("interaction")).isEqualTo("bracket");

        // everyone votes for the first entry of each battle they're not in
        for (Game.Match m : b.matches) {
            for (String p : List.of("ann", "bob", "cat", "dan")) {
                if (!m.a.authorId.equals(p) && !m.b.authorId.equals(p)) {
                    g.vote(p, m.a.key, m.id, null, 3500, EVERYONE_ONLINE);
                }
            }
        }
        List<Game.Match> first = new ArrayList<>(b.matches);
        g.tick(b.roundEndsAt); // round one is over
        assertThat(b.round).isEqualTo(2);
        assertThat(first).allSatisfy(m -> assertThat(m.winner).isSameAs(m.a));

        g.skip(9000); // the step ends: the final is decided and everything scored
        assertThat(b.done).isTrue();
        assertThat(b.champion).isNotNull();
        String champion = b.champion.authorId;
        assertThat(score(g, champion)).isEqualTo(2 * Game.BATTLE_POINTS + Game.CHAMPION_POINTS);
    }

    @Test
    void knockout_withAnOddNumber_givesABye_andSomeoneOutsideABattleCanJudgeIt() {
        Game g = game(round(question(1, QuestionType.KNOCKOUT_BATTLE)), "ann", "bob", "cat", "host");
        g.start(0);
        g.skip(1000);
        g.submit("ann", null, "popcorn", null, 2000, EVERYONE_ONLINE);
        g.submit("bob", null, "pickles", null, 2000, EVERYONE_ONLINE);
        g.submit("cat", null, "cold pizza", null, 2000, EVERYONE_ONLINE);
        g.skip(3000);
        Game.Bracket b = g.questions.get(1L).bracket;
        Game.Match battle = b.matches.stream().filter(m -> m.b != null).findFirst().orElseThrow();
        String outsider = List.of("ann", "bob", "cat").stream()
            .filter(p -> !p.equals(battle.a.authorId) && !p.equals(battle.b.authorId)).findFirst().orElseThrow();
        g.vote(outsider, battle.b.key, battle.id, null, 3500, EVERYONE_ONLINE);
        assertThat(battle.votes).containsEntry(outsider, battle.b.key);
    }

    @Test
    void aQuestionWithNoAnswerStep_isStillScoredBeforeTheNextOne() {
        Game.QuestionSnap one = question(1, QuestionType.PREWRITTEN_SINGLE, answer(10, 100));
        Game.QuestionSnap two = question(2, QuestionType.PREWRITTEN_SINGLE, answer(20, 100));
        Game g = game(List.of(
            new Game.Step(Phase.QUESTION, 10, one),
            new Game.Step(Phase.QUESTION, 10, two)), "ann");
        g.start(0);
        g.submit("ann", List.of(10L), null, null, 1, EVERYONE_ONLINE);
        g.skip(2);
        assertThat(score(g, "ann")).isEqualTo(100);
    }

    @Test
    void pausing_stopsTheClockAndResumingPicksUpWhereItWas() {
        Game g = game(round(question(1, QuestionType.PREWRITTEN_SINGLE, answer(10, 100))), "ann");
        g.start(0); // WAITING, ends at 3000
        g.pause(1000);
        assertThat(g.nextDeadline()).isZero();
        g.tick(5000);
        assertThat(g.index).isZero();
        g.resume(11000);
        assertThat(g.endsAt).isEqualTo(13000);
        g.tick(13000);
        assertThat(g.index).isEqualTo(1);
    }

    @Test
    void theClockMovesThroughEveryStepToTheEnd() {
        Game g = game(round(question(1, QuestionType.PREWRITTEN_SINGLE, answer(10, 100))), "ann");
        g.start(0);
        long now = 0;
        while (g.status() == Game.Status.PLAYING) {
            now = g.nextDeadline();
            g.tick(now);
        }
        assertThat(g.status()).isEqualTo(Game.Status.FINISHED);
        assertThat(now).isEqualTo((3 + 20 + 10 + 5) * 1000L);
    }

    @Test
    void restart_keepsThePlayersAndClearsTheScores() {
        Game g = game(round(question(1, QuestionType.PREWRITTEN_SINGLE, answer(10, 100))), "ann");
        g.start(0);
        g.skip(1);
        g.submit("ann", List.of(10L), null, null, 2, EVERYONE_ONLINE);
        g.end(3);
        assertThat(score(g, "ann")).isEqualTo(100);
        g.restart(4);
        assertThat(g.status()).isEqualTo(Game.Status.LOBBY);
        assertThat(g.players).containsKey("ann");
        assertThat(score(g, "ann")).isZero();
    }

    @Test
    void ranksAreSharedOnATie() {
        Game g = game(round(question(1, QuestionType.PREWRITTEN_SINGLE, answer(10, 100))), "ann", "bob", "cat");
        g.start(0);
        g.skip(1);
        g.submit("ann", List.of(10L), null, null, 2, EVERYONE_ONLINE);
        g.submit("bob", List.of(10L), null, null, 2, EVERYONE_ONLINE);
        g.skip(3);
        List<Map<String, Object>> players = list(g.view(4, EVERYONE_ONLINE).get("players"));
        assertThat(players).extracting(p -> p.get("rank")).containsExactly(1, 1, 3);
    }

    private static String keyOf(Game g, String author) {
        return g.questions.get(1L).entries.stream().filter(e -> e.authorId.equals(author)).findFirst().orElseThrow().key;
    }
}
