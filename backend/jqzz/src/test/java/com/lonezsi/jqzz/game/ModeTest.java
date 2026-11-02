package com.lonezsi.jqzz.game;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.function.Predicate;

import org.junit.jupiter.api.Test;

import com.lonezsi.jqzz.model.Phase;
import com.lonezsi.jqzz.model.QuestionType;

/** A question is an ask and a score (docs/script.md): pairs no old type had play too. */
class ModeTest {

    private static final Predicate<String> EVERYONE_ONLINE = id -> true;
    private static final byte[] PNG = { (byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10, 0, 0, 0, 13, 1, 2, 3 };

    private static Game game(String mode, List<Game.AnswerSnap> answers, Map<String, String> options, String... players) {
        Game.QuestionSnap q = new Game.QuestionSnap(1, "Question", null, QuestionType.PREWRITTEN_SINGLE, "", null,
            answers, 100, options, false, Mode.parse(mode, null));
        List<Game.Step> steps = List.of(
            new Game.Step(Phase.WAITING, 3, q),
            new Game.Step(Phase.QUESTION, 20, q),
            new Game.Step(Phase.ANSWER, 30, q),
            new Game.Step(Phase.RESULT, 5, q));
        Game g = new Game("ABCDE", "host", "quiz", steps, new Random(7), 0);
        for (String p : players) g.addPlayer(p, p, null, 0);
        g.start(0);
        g.skip(0); // into QUESTION
        return g;
    }

    private static Game.AnswerSnap answer(long id, String text, int value) {
        return new Game.AnswerSnap(id, text, null, value);
    }

    private static int score(Game g, String player) {
        return g.players.get(player).score;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> view(Game g, String key) {
        return (Map<String, Object>) g.view(1, EVERYONE_ONLINE).get(key);
    }

    private static String keyOf(Game g, String author) {
        return g.questions.get(1L).entries.stream().filter(e -> e.authorId.equals(author)).findFirst().orElseThrow().key;
    }

    @Test
    void modes_parseAndFallBack() {
        assertThat(Mode.parse("draw/authors", null)).isEqualTo(new Mode(Mode.Ask.DRAW, Mode.Score.AUTHORS));
        assertThat(Mode.parse("type-in/right", null).ask()).isEqualTo(Mode.Ask.TYPE_IN);
        assertThat(Mode.parse("draw/right", null).score()).as("a score the ask can't take: its first").isEqualTo(Mode.Score.VOTES);
        assertThat(Mode.parse(null, QuestionType.POLL)).isEqualTo(new Mode(Mode.Ask.PICK, Mode.Score.CROWD));
        assertThat(Mode.parse("nonsense", QuestionType.TELEPHONE).ask()).isEqualTo(Mode.Ask.CHAIN);
        assertThat(new Mode(Mode.Ask.WRITE, Mode.Score.SECRET).key()).isEqualTo("write/secret");
    }

    @Test
    void theView_saysTheAskAndScore() {
        Game g = game("draw/authors", List.of(), Map.of(), "ann", "bob");
        assertThat(view(g, "question")).containsEntry("ask", "draw").containsEntry("score", "authors");
    }

    @Test
    void whoDrewIt_guessingTheArtistScores() {
        Game g = game("draw/authors", List.of(), Map.of(), "ann", "bob", "cat");
        for (String p : List.of("ann", "bob", "cat")) g.draw(p, PNG, "image/png", 1, EVERYONE_ONLINE);
        g.skip(2); // ANSWER: guess who drew what
        assertThat(g.view(3, EVERYONE_ONLINE).get("interaction")).isEqualTo("guess");
        g.vote("bob", null, null, Map.of(keyOf(g, "ann"), "ann", keyOf(g, "cat"), "ann"), 4, EVERYONE_ONLINE);
        g.skip(5);
        assertThat(score(g, "bob")).isEqualTo(Game.GUESS_POINTS);
    }

    @Test
    void sayItWithoutSayingIt_noSayingTheWord_andGuessesScore() {
        Game g = game("write/secret", List.of(answer(10, "umbrella", 100)), Map.of(), "ann", "bob");
        assertThat(g.task("ann")).containsEntry("word", "umbrella").containsEntry("kind", "write");
        assertThatThrownBy(() -> g.submit("ann", null, "an UMBRELLA, obviously", null, 1, EVERYONE_ONLINE))
            .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("word itself");
        assertThatThrownBy(() -> g.submit("ann", null, "umbrela for rain", null, 1, EVERYONE_ONLINE))
            .as("nearly the word is the word").isInstanceOf(IllegalArgumentException.class);
        g.submit("ann", null, "you open it when it rains", null, 1, EVERYONE_ONLINE);
        g.submit("bob", null, "keeps you dry, has spokes", null, 1, EVERYONE_ONLINE);
        g.skip(2); // ANSWER: guess the words
        assertThat(g.view(3, EVERYONE_ONLINE).get("interaction")).isEqualTo("guess");
        g.vote("bob", null, null, Map.of(keyOf(g, "ann"), "umbrella"), 4, EVERYONE_ONLINE);
        g.skip(5);
        assertThat(score(g, "bob")).isEqualTo(100);
        assertThat(score(g, "ann")).isEqualTo(50);
    }

    @Test
    void guessTheCrowd_closestToTheAverageWins() {
        Game g = game("number/crowd", List.of(), Map.of("min", "0", "max", "12"), "ann", "bob", "cat");
        g.submit("ann", null, "6", null, 1, EVERYONE_ONLINE);
        g.submit("bob", null, "8", null, 1, EVERYONE_ONLINE);
        g.submit("cat", null, "10", null, 1, EVERYONE_ONLINE);
        g.skip(2);
        // the average is 8: spot on gets everything, a quarter of the slider away gets nothing
        assertThat(score(g, "bob")).isEqualTo(Game.CROWD_NUMBER_POINTS);
        assertThat(score(g, "ann")).isEqualTo(333);
        assertThat(view(g, "reveal")).containsEntry("right", 8.0).containsEntry("average", true);
    }

    @Test
    void showOfHands_countsButNobodyScores() {
        Game g = game("pick/none", List.of(answer(10, "tea", 100), answer(11, "coffee", 100)), Map.of(), "ann", "bob");
        g.submit("ann", List.of(10L), null, null, 1, EVERYONE_ONLINE);
        g.submit("bob", List.of(10L), null, null, 1, EVERYONE_ONLINE);
        g.skip(2);
        assertThat(score(g, "ann")).isZero();
        assertThat(view(g, "reveal")).containsEntry("correct", List.of());
        assertThat(view(g, "reveal").get("counts")).isEqualTo(Map.of(10L, 2, 11L, 0));
    }

    @Test
    void rankWithoutPoints_stillShowsWhereTheGroupPutThings() {
        Game g = game("rank/none", List.of(answer(10, "a", 0), answer(11, "b", 0)), Map.of(), "ann");
        g.submit("ann", null, null, Map.of(10L, "S", 11L, "D"), 1, EVERYONE_ONLINE);
        g.skip(2);
        assertThat(score(g, "ann")).isZero();
        assertThat(g.questions.get(1L).consensus).containsEntry(10L, "S").containsEntry(11L, "D");
    }

    @Test
    void writtenKnockout_andDrawnVotes_stillPlayAsBefore() {
        Game g = game("write/knockout", List.of(), Map.of(), "ann", "bob");
        g.submit("ann", null, "one", null, 1, EVERYONE_ONLINE);
        g.submit("bob", null, "two", null, 1, EVERYONE_ONLINE);
        g.skip(2);
        assertThat(g.view(3, EVERYONE_ONLINE).get("interaction")).isEqualTo("bracket");
    }
}
