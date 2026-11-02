package com.lonezsi.jqzz.game;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.function.Predicate;

import org.junit.jupiter.api.Test;

import com.lonezsi.jqzz.model.Action;
import com.lonezsi.jqzz.model.Answer;
import com.lonezsi.jqzz.model.Phase;
import com.lonezsi.jqzz.model.Question;
import com.lonezsi.jqzz.model.QuestionType;
import com.lonezsi.jqzz.model.Quiz;

/** The types script v2 added (docs/script.md): each plays and scores as the script says. */
class NewTypesTest {

    private static final Predicate<String> EVERYONE_ONLINE = id -> true;
    /** the smallest PNG header there is, as far as the engine's sniffing goes */
    private static final byte[] PNG = { (byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10, 0, 0, 0, 13, 1, 2, 3 };

    private static Game.AnswerSnap answer(long id, String text, int value) {
        return new Game.AnswerSnap(id, text, null, value);
    }

    private static Game.QuestionSnap question(QuestionType type, Map<String, String> options, boolean speed,
            Game.AnswerSnap... answers) {
        return new Game.QuestionSnap(1, "Question", null, type, "", null, List.of(answers), 100, options, speed);
    }

    private static Game.QuestionSnap question(QuestionType type, Game.AnswerSnap... answers) {
        return question(type, Map.of(), false, answers);
    }

    private static List<Game.Step> round(Game.QuestionSnap q, int questionSeconds) {
        return List.of(
            new Game.Step(Phase.WAITING, 3, q),
            new Game.Step(Phase.QUESTION, questionSeconds, q),
            new Game.Step(Phase.ANSWER, 30, q),
            new Game.Step(Phase.RESULT, 5, q));
    }

    private static Game game(Game.QuestionSnap q, String... players) {
        return game(round(q, 20), players);
    }

    private static Game game(List<Game.Step> steps, String... players) {
        Game g = new Game("ABCDE", "host", "quiz", steps, new Random(7), 0);
        for (String p : players) g.addPlayer(p, p, null, 0);
        g.start(0);
        g.skip(0); // into QUESTION
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

    private static String keyOf(Game g, String author) {
        return g.questions.get(1L).entries.stream().filter(e -> e.authorId.equals(author)).findFirst().orElseThrow().key;
    }

    // ─── typed ─────────────────────────────────────────────────────────

    @Test
    void fuzzy_forgivesCaseAccentsPunctuationAndOneSlipInLongerWords() {
        assertThat(Fuzzy.matches("reykjavik", "Reykjavík")).isTrue();
        assertThat(Fuzzy.matches("  Paris! ", "paris")).isTrue();
        assertThat(Fuzzy.matches("Reykjavk", "Reykjavík")).isTrue(); // one missing
        assertThat(Fuzzy.matches("Reyjkavik", "Reykjavík")).isTrue(); // two swapped
        assertThat(Fuzzy.matches("Reyjkavk", "Reykjavík")).isFalse(); // two slips
        assertThat(Fuzzy.matches("Rone", "Rome")).isFalse(); // short words must be right
        assertThat(Fuzzy.matches("the beatles", "thebeatles")).isTrue();
        assertThat(Fuzzy.matches("", "x")).isFalse();
    }

    @Test
    void typed_scoresTheBestAcceptedAnswerAndHidesThemUntilTheReveal() {
        Game g = game(question(QuestionType.TYPED, answer(10, "Budapest", 100), answer(11, "Pest", 30)), "ann", "bob", "cat");
        assertThat(list(q(g.view(1, EVERYONE_ONLINE)).get("answers"))).isEmpty();
        g.submit("ann", null, "budapets", null, 1, EVERYONE_ONLINE);
        g.submit("bob", null, "pest", null, 1, EVERYONE_ONLINE);
        g.submit("cat", null, "Vienna", null, 1, EVERYONE_ONLINE);
        g.skip(2);
        assertThat(score(g, "ann")).isEqualTo(100);
        assertThat(score(g, "bob")).isEqualTo(30);
        assertThat(score(g, "cat")).isZero();
        Map<String, Object> shown = g.view(3, EVERYONE_ONLINE);
        assertThat(list(q(shown).get("answers"))).hasSize(2);
        assertThat(list(reveal(shown).get("typed"))).extracting(t -> t.get("right")).containsExactlyInAnyOrder(true, true, false);
    }

    // ─── order ─────────────────────────────────────────────────────────

    @Test
    void order_showsTheItemsShuffledAndPaysForEachOneInPlace() {
        Game g = game(question(QuestionType.ORDER, answer(10, "first", 50), answer(11, "second", 50),
                answer(12, "third", 50), answer(13, "fourth", 50)), "ann", "bob");
        List<Object> shown = list(q(g.view(1, EVERYONE_ONLINE)).get("answers")).stream().map(a -> a.get("id")).toList();
        assertThat(shown).containsExactlyInAnyOrder(10L, 11L, 12L, 13L).isNotEqualTo(List.of(10L, 11L, 12L, 13L));
        assertThat(list(q(g.view(2, EVERYONE_ONLINE)).get("answers")).stream().map(a -> a.get("id")).toList())
            .as("the same shuffle every time").isEqualTo(shown);

        assertThatThrownBy(() -> g.submit("ann", List.of(10L, 11L), null, null, 2, EVERYONE_ONLINE))
            .isInstanceOf(IllegalArgumentException.class);
        g.submit("ann", List.of(10L, 11L, 12L, 13L), null, null, 2, EVERYONE_ONLINE);
        g.submit("bob", List.of(10L, 12L, 11L, 13L), null, null, 2, EVERYONE_ONLINE);
        g.skip(3);
        assertThat(score(g, "ann")).isEqualTo(200);
        assertThat(score(g, "bob")).isEqualTo(100);
        assertThat(reveal(g.view(4, EVERYONE_ONLINE)).get("order")).isEqualTo(List.of(10L, 11L, 12L, 13L));
    }

    // ─── number ────────────────────────────────────────────────────────

    @Test
    void number_closerScoresMoreAndTheClosestGetsAtLeastHalf() {
        Game.QuestionSnap q = question(QuestionType.NUMBER, Map.of("unit", "m", "min", "0", "max", "10000"), false,
            answer(10, "8849", 1000));
        Game g = game(q, "spot", "near", "far", "way");
        Map<String, Object> asked = q(g.view(1, EVERYONE_ONLINE));
        assertThat(list(asked.get("answers"))).as("the number stays hidden").isEmpty();
        assertThat(asked).containsEntry("unit", "m").containsEntry("max", 10000.0);
        assertThatThrownBy(() -> g.submit("far", null, "12000", null, 1, EVERYONE_ONLINE))
            .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("0 to 10000");
        assertThatThrownBy(() -> g.submit("far", null, "lots", null, 1, EVERYONE_ONLINE))
            .isInstanceOf(IllegalArgumentException.class);

        g.submit("spot", null, "8849", null, 1, EVERYONE_ONLINE);
        g.submit("near", null, "8 349", null, 1, EVERYONE_ONLINE); // 500 off, a fifth of the span
        g.submit("far", null, "3000", null, 1, EVERYONE_ONLINE);
        g.submit("way", null, "0", null, 1, EVERYONE_ONLINE);
        g.skip(2);
        assertThat(score(g, "spot")).isEqualTo(1000);
        assertThat(score(g, "near")).isEqualTo(800);
        assertThat(score(g, "far")).isZero();
        assertThat(score(g, "way")).isZero();
        assertThat(reveal(g.view(3, EVERYONE_ONLINE)).get("closest")).isEqualTo(List.of("spot"));
    }

    @Test
    void number_whenNobodyIsClose_theClosestStillGetsHalf() {
        Game g = game(question(QuestionType.NUMBER, answer(10, "100", 1000)), "ann", "bob");
        g.submit("ann", null, "400", null, 1, EVERYONE_ONLINE);
        g.submit("bob", null, "1,5", null, 1, EVERYONE_ONLINE); // a decimal comma reads too
        g.skip(2);
        assertThat(g.questions.get(1L).numbers.get("bob")).isEqualTo(1.5);
        assertThat(score(g, "bob")).isEqualTo(500);
        assertThat(score(g, "ann")).isZero();
    }

    // ─── match ─────────────────────────────────────────────────────────

    @Test
    void match_keysDontGiveThePairsAwayAndEachRightPairScores() {
        Game.QuestionSnap q = question(QuestionType.MATCH,
            new Game.AnswerSnap(10, "Gold", null, 100, "Au"),
            new Game.AnswerSnap(11, "Iron", null, 100, "Fe"),
            new Game.AnswerSnap(12, "Steel", null, 100, "Fe"));
        Game g = game(q, "ann", "bob");
        Map<String, Object> asked = q(g.view(1, EVERYONE_ONLINE));
        assertThat(list(asked.get("answers"))).allSatisfy(a -> assertThat(a).doesNotContainKey("match"));
        List<Map<String, Object>> halves = list(asked.get("halves"));
        assertThat(halves).extracting(h -> h.get("text")).containsExactlyInAnyOrder("Au", "Fe", "Fe");
        Map<String, String> keyOfText = new LinkedHashMap<>();
        halves.forEach(h -> keyOfText.putIfAbsent((String) h.get("text"), (String) h.get("key")));
        String fe2 = halves.stream().filter(h -> h.get("text").equals("Fe")).map(h -> (String) h.get("key"))
            .filter(k -> !k.equals(keyOfText.get("Fe"))).findFirst().orElseThrow();

        // both Fe halves are as good as each other
        g.submit("ann", null, null, null, Map.of(10L, keyOfText.get("Au"), 11L, fe2, 12L, keyOfText.get("Fe")), 1, EVERYONE_ONLINE);
        g.submit("bob", null, null, null, Map.of(10L, keyOfText.get("Fe"), 11L, keyOfText.get("Au")), 1, EVERYONE_ONLINE);
        assertThatThrownBy(() -> g.submit("bob", null, null, null, Map.of(10L, "nope"), 1, EVERYONE_ONLINE))
            .isInstanceOf(IllegalArgumentException.class);
        g.skip(2);
        assertThat(score(g, "ann")).isEqualTo(300);
        assertThat(score(g, "bob")).isZero();
        assertThat(list(q(g.view(3, EVERYONE_ONLINE)).get("answers"))).allSatisfy(a -> assertThat(a).containsKey("match"));
    }

    // ─── poll ──────────────────────────────────────────────────────────

    @Test
    void poll_paysWhoeverSidedWithTheMost_andTiesPayBoth() {
        Game g = game(question(QuestionType.POLL, answer(10, "cats", 100), answer(11, "dogs", 100), answer(12, "fish", 100)),
            "a", "b", "c", "d", "e");
        g.submit("a", List.of(10L), null, null, 1, EVERYONE_ONLINE);
        g.submit("b", List.of(10L), null, null, 1, EVERYONE_ONLINE);
        g.submit("c", List.of(11L), null, null, 1, EVERYONE_ONLINE);
        g.submit("d", List.of(11L), null, null, 1, EVERYONE_ONLINE);
        g.submit("e", List.of(12L), null, null, 1, EVERYONE_ONLINE);
        g.skip(2);
        assertThat(List.of(score(g, "a"), score(g, "b"), score(g, "c"), score(g, "d"), score(g, "e")))
            .containsExactly(100, 100, 100, 100, 0);
        assertThat(reveal(g.view(3, EVERYONE_ONLINE)).get("correct")).isEqualTo(List.of(10L, 11L));
    }

    // ─── speed ─────────────────────────────────────────────────────────

    @Test
    void speed_sooner_scoresMore_andTheLastMomentIsWorthHalf() {
        Game.QuestionSnap q = question(QuestionType.PREWRITTEN_SINGLE, Map.of(), true, answer(10, "yes", 1000));
        Game g = new Game("ABCDE", "host", "quiz", round(q, 20), new Random(7), 0);
        for (String p : List.of("quick", "slow", "late")) g.addPlayer(p, p, null, 0);
        g.start(0);
        g.skip(0); // QUESTION from 0 to 20000
        assertThat(q(g.view(0, EVERYONE_ONLINE))).containsEntry("speed", true);
        g.submit("quick", List.of(10L), null, null, 0, EVERYONE_ONLINE);
        g.submit("slow", List.of(10L), null, null, 10_000, EVERYONE_ONLINE);
        g.submit("late", List.of(10L), null, null, 19_999, EVERYONE_ONLINE);
        g.skip(20_000);
        assertThat(score(g, "quick")).isEqualTo(1000);
        assertThat(score(g, "slow")).isEqualTo(750);
        assertThat(score(g, "late")).isEqualTo(500);
    }

    // ─── drawing ───────────────────────────────────────────────────────

    @Test
    void draw_sniffsTheFileAndKeepsOnlyRealImages() {
        assertThat(GameEngine.imageType(PNG)).isEqualTo("image/png");
        assertThat(GameEngine.imageType("<html><script>".getBytes())).isNull();
        assertThat(GameEngine.imageType(new byte[] { 'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P' })).isEqualTo("image/webp");
    }

    @Test
    void drawVote_drawingsGoOnTheBoardWithoutTheirArtists_andVotesPay() {
        Game g = game(question(QuestionType.DRAW_VOTE), "ann", "bob", "cat");
        assertThatThrownBy(() -> g.submit("ann", null, "words", null, 1, EVERYONE_ONLINE))
            .isInstanceOf(IllegalArgumentException.class);
        String first = g.draw("ann", PNG, "image/png", 1, EVERYONE_ONLINE);
        String again = g.draw("ann", PNG, "image/png", 1, EVERYONE_ONLINE);
        assertThat(g.art(first)).as("a new drawing replaces the old").isNull();
        assertThat(g.art(again).bytes()).isEqualTo(PNG);
        assertThat(g.task("ann")).containsEntry("kind", "draw").containsEntry("drawing", again);
        g.draw("bob", PNG, "image/png", 1, EVERYONE_ONLINE);
        g.draw("cat", PNG, "image/png", 1, EVERYONE_ONLINE);
        assertThat(g.endsAt).as("everyone drew").isEqualTo(1 + Game.EVERYONE_DONE_MS);
        g.skip(2); // ANSWER: vote

        Map<String, Object> voting = g.view(3, EVERYONE_ONLINE);
        assertThat(voting.get("interaction")).isEqualTo("vote");
        assertThat(list(reveal(voting).get("entries"))).hasSize(3)
            .allSatisfy(e -> assertThat(e).containsKey("image").doesNotContainKey("authorId"));
        g.vote("bob", keyOf(g, "ann"), null, null, 4, EVERYONE_ONLINE);
        g.vote("cat", keyOf(g, "ann"), null, null, 4, EVERYONE_ONLINE);
        g.skip(5);
        assertThat(score(g, "ann")).isEqualTo(2 * Game.VOTE_POINTS);
        assertThat(g.keptArt()).hasSize(3);
    }

    @Test
    void draw_refusesTooBigAndTooMuch() {
        Game g = game(question(QuestionType.DRAW), "ann");
        assertThatThrownBy(() -> g.draw("ann", new byte[Game.MAX_ART_BYTES + 1], "image/png", 1, EVERYONE_ONLINE))
            .isInstanceOf(IllegalArgumentException.class);
        g.artBytes = Game.MAX_GAME_ART_BYTES;
        assertThatThrownBy(() -> g.draw("ann", PNG, "image/png", 1, EVERYONE_ONLINE))
            .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void drawGuess_dealsTheWordsEvenly_andPaysGuessersAndHalfToTheArtist() {
        Game.QuestionSnap q = question(QuestionType.DRAW_GUESS, answer(10, "lighthouse", 100), answer(11, "volcano", 100));
        Game g = game(q, "ann", "bob", "cat", "dan");
        assertThat(list(q(g.view(1, EVERYONE_ONLINE)).get("answers"))).as("the words are secret").isEmpty();
        Map<String, Integer> dealt = new LinkedHashMap<>();
        for (String p : List.of("ann", "bob", "cat", "dan")) dealt.merge((String) g.task(p).get("word"), 1, Integer::sum);
        assertThat(dealt).containsEntry("lighthouse", 2).containsEntry("volcano", 2);
        assertThat(g.task("ann").get("word")).as("the same word every time").isEqualTo(g.task("ann").get("word"));

        String annWord = (String) g.task("ann").get("word");
        for (String p : List.of("ann", "bob", "cat", "dan")) g.draw(p, PNG, "image/png", 1, EVERYONE_ONLINE);
        g.skip(2); // ANSWER: guess the words
        Map<String, Object> guessing = g.view(3, EVERYONE_ONLINE);
        assertThat(guessing.get("interaction")).isEqualTo("guess");
        assertThat(list(q(guessing).get("answers"))).as("still secret while guessing").isEmpty();

        String typo = annWord.equals("lighthouse") ? "lighthose" : "volcanoe";
        g.vote("bob", null, null, Map.of(keyOf(g, "ann"), typo), 4, EVERYONE_ONLINE);
        g.vote("cat", null, null, Map.of(keyOf(g, "ann"), "a candle"), 4, EVERYONE_ONLINE);
        assertThatThrownBy(() -> g.vote("ann", null, null, Map.of(keyOf(g, "ann"), annWord), 4, EVERYONE_ONLINE))
            .as("not your own").isInstanceOf(IllegalArgumentException.class);
        g.skip(5);
        assertThat(score(g, "bob")).isEqualTo(100);
        assertThat(score(g, "cat")).isZero();
        assertThat(score(g, "ann")).isEqualTo(50);
        Map<String, Object> after = g.view(6, EVERYONE_ONLINE);
        Map<String, Object> annEntry = list(reveal(after).get("entries")).stream()
            .filter(e -> "ann".equals(e.get("authorId"))).findFirst().orElseThrow();
        assertThat(annEntry.get("word")).isEqualTo(annWord);
        assertThat(list(annEntry.get("guesses"))).extracting(x -> x.get("right")).containsExactlyInAnyOrder(true, false);
    }

    @Test
    void drawKnockout_battlesDrawings() {
        Game g = game(question(QuestionType.DRAW_BATTLE), "ann", "bob", "cat", "dan");
        for (String p : List.of("ann", "bob", "cat", "dan")) g.draw(p, PNG, "image/png", 1, EVERYONE_ONLINE);
        g.skip(2); // ANSWER: the bracket
        Map<String, Object> battling = g.view(3, EVERYONE_ONLINE);
        assertThat(battling.get("interaction")).isEqualTo("bracket");
        @SuppressWarnings("unchecked")
        Map<String, Object> bracket = (Map<String, Object>) reveal(battling).get("bracket");
        @SuppressWarnings("unchecked")
        Map<String, Object> side = (Map<String, Object>) list(bracket.get("matches")).get(0).get("a");
        assertThat(side).containsKey("image").doesNotContainKey("text");
        g.skip(4);
        assertThat(g.players.values().stream().mapToInt(p -> p.score).sum())
            .isEqualTo(3 * Game.BATTLE_POINTS + Game.CHAMPION_POINTS);
    }

    // ─── telephone ─────────────────────────────────────────────────────

    @Test
    void telephone_handsEachChainOnUntilEveryoneHasHadIt() {
        Game.QuestionSnap q = question(QuestionType.TELEPHONE);
        Game g = game(round(q, 120), "ann", "bob", "cat");
        Telephone t = g.questions.get(1L).telephone;
        assertThat(t.rounds).isEqualTo(3);
        assertThat(g.view(1, EVERYONE_ONLINE)).containsKey("telephone");

        // round 1: everyone writes
        for (String p : t.players) {
            assertThat(g.task(p)).containsEntry("kind", "write").doesNotContainKey("handed");
            assertThatThrownBy(() -> g.draw(p, PNG, "image/png", 1, EVERYONE_ONLINE)).isInstanceOf(IllegalArgumentException.class);
            g.submit(p, null, "said by " + p, null, 1, EVERYONE_ONLINE);
        }
        assertThat(t.roundEndsAt).as("everyone wrote: the round ends now").isEqualTo(1 + Game.EVERYONE_DONE_MS);
        g.tick(t.roundEndsAt);
        assertThat(t.round).isEqualTo(2);

        // round 2: each draws what someone else wrote
        for (String p : t.players) {
            Map<String, Object> task = g.task(p);
            assertThat(task).containsEntry("kind", "draw");
            @SuppressWarnings("unchecked")
            String handed = (String) ((Map<String, Object>) task.get("handed")).get("text");
            assertThat(handed).startsWith("said by ").isNotEqualTo("said by " + p);
            g.draw(p, PNG, "image/png", 2000, EVERYONE_ONLINE);
        }
        g.tick(t.roundEndsAt);
        assertThat(t.round).isEqualTo(3);

        // round 3: describe the drawing; one player doesn't, and the round runs out
        String quiet = t.players.get(0);
        for (String p : t.players) {
            Map<String, Object> task = g.task(p);
            assertThat(task).containsEntry("kind", "describe");
            if (!p.equals(quiet)) g.submit(p, null, "looks like " + p, null, 3000, EVERYONE_ONLINE);
        }
        g.tick(t.roundEndsAt);
        assertThat(g.current().phase()).as("the last round ends the question").isEqualTo(Phase.ANSWER);

        Map<String, Object> shown = reveal(g.view(g.endsAt - 1, EVERYONE_ONLINE));
        List<Map<String, Object>> chains = list(shown.get("chains"));
        assertThat(chains).hasSize(3);
        assertThat(chains).allSatisfy(c -> assertThat(list(c.get("links")).get(0)).containsKey("text"));
        assertThat(chains).extracting(c -> list(c.get("links")).size()).containsExactlyInAnyOrder(3, 3, 2);
        assertThat(g.keptArt()).hasSize(3);
    }

    @Test
    void telephone_latecomersWatch_andRoundsCanBeAsked() {
        Game.QuestionSnap q = question(QuestionType.TELEPHONE, Map.of("rounds", "2"), false);
        Game g = game(round(q, 60), "ann", "bob", "cat");
        assertThat(g.questions.get(1L).telephone.rounds).isEqualTo(2);
        g.addPlayer("late", "late", null, 1);
        assertThat(g.task("late")).containsEntry("kind", "watch");
        assertThatThrownBy(() -> g.submit("late", null, "hi", null, 1, EVERYONE_ONLINE))
            .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void telephone_alone_passesToYourself() {
        Game g = game(round(question(QuestionType.TELEPHONE), 60), "solo");
        Telephone t = g.questions.get(1L).telephone;
        assertThat(t.rounds).isEqualTo(Telephone.ALONE);
        g.submit("solo", null, "a dragon", null, 1, EVERYONE_ONLINE);
        g.tick(t.roundEndsAt);
        @SuppressWarnings("unchecked")
        Map<String, Object> handed = (Map<String, Object>) g.task("solo").get("handed");
        assertThat(handed).containsEntry("text", "a dragon");
    }

    @Test
    void telephone_roundsGiveDrawingTwiceTheTime() {
        Telephone t = new Telephone(List.of("a", "b", "c", "d"), 4, 60_000, 0);
        // write 1, draw 2, describe 1, draw 2: 6 parts of 10 seconds
        assertThat(t.roundEndsAt).isEqualTo(10_000);
        t.next(10_000, 60_000);
        assertThat(t.roundEndsAt).isEqualTo(30_000);
    }

    // ─── from the quiz to the game ─────────────────────────────────────

    @Test
    void snapshot_carriesOptionsMatchesAndSpeed_andMixNeverShufflesAnOrder() {
        Question order = new Question();
        order.setId(1L);
        order.setType(QuestionType.ORDER);
        order.setOptions("unit=m%20high, min=0");
        List<Answer> answers = new ArrayList<>();
        for (int i = 1; i <= 8; i++) {
            Answer a = new Answer();
            a.setId((long) i);
            a.setText("item " + i);
            a.setValue(10);
            a.setMatch("half " + i);
            answers.add(a);
        }
        order.setAnswers(answers);
        Quiz quiz = new Quiz();
        Action setting = new Action(null, Phase.SETTING, 0);
        setting.setPreview("mix, speed");
        quiz.setActions(new ArrayList<>(List.of(setting, new Action(order, Phase.QUESTION, 20))));

        Game.QuestionSnap snap = GameEngine.snapshot(quiz, new Random(3)).get(0).question();
        assertThat(snap.answers()).extracting(Game.AnswerSnap::id).containsExactly(1L, 2L, 3L, 4L, 5L, 6L, 7L, 8L);
        assertThat(snap.answers().get(0).match()).isEqualTo("half 1");
        assertThat(snap.options()).containsEntry("unit", "m high").containsEntry("min", "0");
        assertThat(snap.speed()).isTrue();
        assertThat(GameEngine.parseOptions(GameEngine.formatOptions(snap.options()))).isEqualTo(snap.options());
    }
}
