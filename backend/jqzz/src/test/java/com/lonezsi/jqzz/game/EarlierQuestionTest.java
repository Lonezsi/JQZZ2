package com.lonezsi.jqzz.game;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.function.Predicate;

import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import com.lonezsi.jqzz.model.Action;
import com.lonezsi.jqzz.model.Phase;
import com.lonezsi.jqzz.model.Question;
import com.lonezsi.jqzz.model.QuestionType;
import com.lonezsi.jqzz.model.Quiz;
import com.lonezsi.jqzz.repository.GameRecordRepository;
import com.lonezsi.jqzz.repository.QuizRepository;
import com.lonezsi.jqzz.repository.UserRepository;
import com.lonezsi.jqzz.service.PresenceTracker;

import tools.jackson.databind.json.JsonMapper;

/**
 * Questions that use an earlier one (docs/script.md, "Using an earlier
 * question"), played on section 2's quiz of the spec: Q1 everyone writes, Q2
 * votes on Q1's answers, Q3 guesses who wrote Q2's winner, Q4 draws someone's
 * Q1 answer, Q5 votes on the drawings.
 */
class EarlierQuestionTest {

    private static final Predicate<String> EVERYONE_ONLINE = id -> true;
    private static final byte[] PNG = { (byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10, 0, 0, 0, 13, 1, 2, 3 };
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final long Q1 = 1, Q2 = 2, Q3 = 3, Q4 = 4, Q5 = 5;

    // ─── the quiz ──────────────────────────────────────────────────────

    private static Game.QuestionSnap snap(long id, QuestionType type, String mode, String text, Map<String, String> options) {
        return new Game.QuestionSnap(id, text, null, type, null, null, List.of(), 100, options, false, Mode.parse(mode, type));
    }

    /** the golden table, with Q2's options as given */
    private static Map<Long, Game.QuestionSnap> golden(Map<String, String> q2) {
        Map<Long, Game.QuestionSnap> q = new LinkedHashMap<>();
        q.put(Q1, snap(Q1, QuestionType.USER_GENERATED, "write/none", "What did you do yesterday?", Map.of("ref", "q1")));
        q.put(Q2, snap(Q2, QuestionType.PREWRITTEN_SINGLE, "pick/votes", "Which one is the funniest?", q2));
        q.put(Q3, snap(Q3, QuestionType.PREWRITTEN_SINGLE, "person/right",
                "The funniest answer was: {@q2.winner}. Who do you think wrote it?", Map.of("from", "q2")));
        q.put(Q4, snap(Q4, QuestionType.DRAW, "draw/none",
                "How did you think {author}'s face looked when they typed {answer}?", Map.of("from", "q1", "ref", "q4")));
        q.put(Q5, snap(Q5, QuestionType.PREWRITTEN_SINGLE, "pick/votes", "Which drawing is the funniest? Pick up to 2.",
                Map.of("from", "q4", "picks", "2")));
        return q;
    }

    private static final Map<String, String> GOLDEN_Q2 = Map.of("from", "q1", "overflow", "6", "ref", "q2");

    /** "Q2 QUESTION 40" and so on, in order */
    private static List<Game.Step> steps(Map<Long, Game.QuestionSnap> q, Object... plan) {
        List<Game.Step> out = new ArrayList<>();
        for (int i = 0; i < plan.length; i += 3) {
            out.add(new Game.Step((Phase) plan[i + 1], (Integer) plan[i + 2], q.get((Long) plan[i])));
        }
        return out;
    }

    private static List<Game.Step> section2(Map<Long, Game.QuestionSnap> q) {
        return steps(q,
                Q1, Phase.QUESTION, 60,
                Q2, Phase.QUESTION, 40, Q2, Phase.ANSWER, 15,
                Q3, Phase.QUESTION, 25, Q3, Phase.ANSWER, 10, Q3, Phase.RESULT, 8,
                Q4, Phase.QUESTION, 90,
                Q5, Phase.QUESTION, 40, Q5, Phase.ANSWER, 15, Q5, Phase.RESULT, 10);
    }

    /** p1..pn, called P1..Pn, started: in the first step */
    private static Game game(List<Game.Step> steps, int n) {
        Game g = new Game("ABCDE", "host", "Yesterday", steps, new Random(7), 0);
        for (int i = 1; i <= n; i++) g.addPlayer("p" + i, "P" + i, null, 0);
        g.start(0);
        return g;
    }

    private static Game yesterday(int n) {
        return game(section2(golden(GOLDEN_Q2)), n);
    }

    private static Game yesterday(int n, String overflow) {
        Map<String, String> q2 = new HashMap<>(GOLDEN_Q2);
        q2.put("overflow", overflow);
        return game(section2(golden(q2)), n);
    }

    // ─── playing it ────────────────────────────────────────────────────

    private static void writeAll(Game g) {
        g.players.keySet().forEach(p -> g.submit(p, null, "did " + p, null, 0, EVERYONE_ONLINE));
    }

    /** Q1 written by everyone, now in Q2's QUESTION step */
    private static Game atQ2(Game g) {
        writeAll(g);
        g.skip(1000);
        assertThat(g.current().question().id()).isEqualTo(Q2);
        return g;
    }

    /** everyone votes for the first thing on their list, if there's one */
    private static void voteFirst(Game g) {
        for (String p : List.copyOf(g.players.keySet())) {
            List<String> ballot = ballot(g, p);
            if (!ballot.isEmpty()) g.submit(p, null, null, null, null, List.of(ballot.get(0)), 0, EVERYONE_ONLINE);
        }
    }

    /** Q2 voted on and revealed, now in Q3's QUESTION step */
    private static Game atQ3(Game g) {
        atQ2(g);
        voteFirst(g);
        g.skip(2000); // Q2 ANSWER
        g.skip(3000); // Q3 QUESTION
        assertThat(g.current().question().id()).isEqualTo(Q3);
        return g;
    }

    /** whoever made Q2's winner */
    private static String maker(Game g) {
        Game.QState st = st(g, Q2);
        return st.entries.stream().filter(e -> e.key.equals(st.winner)).findFirst().orElseThrow().authorId;
    }

    /** Q3 guessed (the maker names someone else, everyone else the maker), now in Q4's QUESTION step */
    private static Game atQ4(Game g) {
        atQ3(g);
        String w = maker(g);
        for (String p : List.copyOf(g.players.keySet())) {
            String who = p.equals(w) ? g.players.keySet().stream().filter(x -> !x.equals(w)).findFirst().orElse(null) : w;
            if (who != null) g.submit(p, null, null, null, null, List.of(who), 0, EVERYONE_ONLINE);
        }
        g.skip(4000); // Q3 ANSWER
        g.skip(5000); // Q3 RESULT
        g.skip(6000); // Q4 QUESTION
        assertThat(g.current().question().id()).isEqualTo(Q4);
        return g;
    }

    private static Game.QState st(Game g, long id) {
        return g.questions.get(id);
    }

    private static String keyBy(Game g, long q, String author) {
        return st(g, q).entries.stream().filter(e -> e.authorId.equals(author)).findFirst().orElseThrow().key;
    }

    @SuppressWarnings("unchecked")
    private static List<String> ballot(Game g, String p) {
        Object b = g.task(p).get("ballot");
        if (b == null) return List.of();
        return ((List<Map<String, Object>>) b).stream().map(m -> (String) m.get("key")).toList();
    }

    private static Map<String, Object> view(Game g) {
        return g.view(0, EVERYONE_ONLINE);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> part(Map<String, Object> view, String key) {
        return (Map<String, Object>) view.get(key);
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> list(Object o) {
        return (List<Map<String, Object>>) o;
    }

    private static String json(Object o) {
        return JSON.writeValueAsString(o);
    }

    private static int total(Game g) {
        return g.players.values().stream().mapToInt(p -> p.score).sum();
    }

    // ─── a pick on an earlier question's answers ───────────────────────

    @Test
    void pickFrom_copiesTheSourceEntries_andNobodyGetsTheirOwn() {
        Game g = atQ2(yesterday(5));
        assertThat(st(g, Q2).entries).extracting(e -> e.text)
                .containsExactlyInAnyOrder("did p1", "did p2", "did p3", "did p4", "did p5");
        for (String p : g.players.keySet()) {
            List<String> mine = ballot(g, p);
            assertThat(mine).hasSize(4).doesNotContain(keyBy(g, Q2, p));
        }
        assertThat(g.task("p1").get("kind")).isEqualTo("ballot");
        assertThatThrownBy(() -> g.submit("p1", null, null, null, null, List.of(keyBy(g, Q2, "p1")), 0, EVERYONE_ONLINE))
                .hasMessage("You can't vote for your own");
        assertThatThrownBy(() -> g.submit("p1", null, null, null, null, List.of(), 0, EVERYONE_ONLINE))
                .hasMessage("Pick one");
    }

    @Test
    void pickFrom_votingIsInShowQuestion_andShowAnswersNeverReopensIt() {
        Game g = atQ2(yesterday(5));
        assertThat(g.snaps.get(Q2).mode().judged()).isFalse();
        assertThat(g.interaction()).isEqualTo("answer");
        voteFirst(g);
        g.skip(2000);
        assertThat(g.current().phase()).isEqualTo(Phase.ANSWER);
        assertThat(g.interaction()).isNull();
        assertThat(st(g, Q2).settled).isTrue();
        assertThatThrownBy(() -> g.vote("p1", keyBy(g, Q2, "p2"), null, null, 0, EVERYONE_ONLINE))
                .hasMessage("Voting is closed");
    }

    @Test
    void sharedBoard_whenEveryoneSeesAllButTheirOwn_isInTheViewWithoutAuthors() {
        Game g = atQ2(yesterday(5));
        Map<String, Object> board = part(view(g), "board");
        assertThat(board.get("mode")).isEqualTo("shared");
        assertThat(board.get("count")).isEqualTo(5);
        assertThat(list(board.get("entries"))).hasSize(5).extracting(e -> e.get("text")).contains("did p3");
        assertThat(json(board)).doesNotContain("authorId").doesNotContain("\"p3\"");
        assertThat(list(part(view(g), "question").get("answers"))).isEmpty();
    }

    @Test
    void overflow_ballotsNeverReachTheSharedView() {
        Game g = atQ2(yesterday(10, "3"));
        Map<String, Object> v = view(g);
        Map<String, Object> board = part(v, "board");
        assertThat(board.get("mode")).isEqualTo("ballots");
        assertThat(board).doesNotContainKey("entries").containsEntry("cap", 3).containsEntry("count", 10);
        assertThat(json(v)).doesNotContain("did p");
        for (String p : g.players.keySet()) {
            List<String> mine = ballot(g, p);
            assertThat(mine).hasSizeLessThanOrEqualTo(3).isNotEmpty().doesNotContain(keyBy(g, Q2, p));
        }
        assertThat(g.task("host")).isEmpty();
    }

    @Test
    void overflow_aBallotIsTheSameAfterAReload() {
        Game g = atQ2(yesterday(10, "3"));
        assertThat(g.task("p4")).isEqualTo(g.task("p4"));
        assertThat(ballot(g, "p4")).isEqualTo(ballot(g, "p4"));
    }

    @Test
    void overflow_aVoteOnlyCountsForWhatsOnYourBallot() {
        Game g = atQ2(yesterday(10, "3"));
        List<String> mine = ballot(g, "p1");
        String elsewhere = st(g, Q2).entries.stream()
                .filter(e -> !e.authorId.equals("p1") && !mine.contains(e.key)).findFirst().orElseThrow().key;
        assertThatThrownBy(() -> g.submit("p1", null, null, null, null, List.of(elsewhere), 0, EVERYONE_ONLINE))
                .hasMessage("That one isn't on your list");
        g.submit("p1", null, null, null, null, List.of(mine.get(0)), 0, EVERYONE_ONLINE);
        assertThat(g.task("p1").get("chosen")).isEqualTo(List.of(mine.get(0)));
    }

    @Test
    void overflow_extraRoundsOnlyWhenOneRoundCantCover() {
        Game g = yesterday(12, "3");
        writeAll(g);
        for (int i = 3; i <= 12; i++) g.removePlayer("p" + i, 0);
        g.skip(1000);
        Map<String, Object> board = part(view(g), "board");
        assertThat(board.get("rounds")).isEqualTo(2);
        assertThat(board.get("round")).isEqualTo(1);
        List<String> first = ballot(g, "p1");
        g.tick(1000 + 20_000);
        assertThat(part(view(g), "board").get("round")).isEqualTo(2);
        assertThat(g.task("p1").get("round")).isEqualTo(2);
        List<String> second = ballot(g, "p1");
        assertThat(second).isNotEmpty().doesNotContainAnyElementsOf(first);

        Game all = atQ2(yesterday(12, "3"));
        assertThat(part(view(all), "board").get("rounds")).isEqualTo(1);
    }

    @Test
    void overflow_roundsShareTheTime_pauseMovesTheRoundEnd_everyoneDoneEndsARoundEarly() {
        Game g = yesterday(12, "3");
        writeAll(g);
        for (int i = 3; i <= 12; i++) g.removePlayer("p" + i, 0);
        g.skip(1000); // Q2 opens at 1000 for 40 s: two rounds of 20
        Ballots b = st(g, Q2).ballots;
        assertThat(b.roundEndsAt).isEqualTo(21_000);
        assertThat(g.nextDeadline()).isEqualTo(21_000);
        assertThat(part(view(g), "board").get("roundSeconds")).isEqualTo(20.0);

        g.pause(5000);
        assertThat(part(g.view(5000, EVERYONE_ONLINE), "board").get("roundEndsAt")).isNull();
        g.resume(8000);
        assertThat(b.roundEndsAt).isEqualTo(24_000);

        g.submit("p1", null, null, null, null, List.of(ballot(g, "p1").get(0)), 9000, EVERYONE_ONLINE);
        assertThat(b.roundEndsAt).isEqualTo(24_000);
        g.submit("p2", null, null, null, null, List.of(ballot(g, "p2").get(0)), 9000, EVERYONE_ONLINE);
        assertThat(b.roundEndsAt).isEqualTo(9000 + Game.EVERYONE_DONE_MS);
        assertThat(g.nextDeadline()).isEqualTo(9000 + Game.EVERYONE_DONE_MS);
        g.tick(9000 + Game.EVERYONE_DONE_MS);
        assertThat(b.round).isEqualTo(2);
        assertThat(b.roundEndsAt).as("the last round runs to the step's end").isZero();
        assertThat(view(g).get("answered")).isEqualTo(List.of());
    }

    @Test
    void overflow_playersAwayWhenItOpens_areDealtWhenTheyAsk() {
        Game g = yesterday(10, "3");
        writeAll(g);
        g.here = id -> !id.equals("p1");
        g.skip(1000);
        Game.QState st = st(g, Q2);
        assertThat(st.ballots).isNotNull();
        assertThat(st.ballots.peek("p1")).isNull();
        assertThat(view(g).get("answered")).isEqualTo(List.of());
        List<String> late = ballot(g, "p1");
        assertThat(late).hasSize(3).doesNotContain(keyBy(g, Q2, "p1"));
        assertThat(st.ballots.peek("p1")).isEqualTo(late);
    }

    // ─── winners ───────────────────────────────────────────────────────

    /** p1 and p2 vote for each other's: a tie of two */
    private static Game tie() {
        Game g = atQ2(yesterday(5));
        g.submit("p1", null, null, null, null, List.of(keyBy(g, Q2, "p2")), 0, EVERYONE_ONLINE);
        g.submit("p2", null, null, null, null, List.of(keyBy(g, Q2, "p1")), 0, EVERYONE_ONLINE);
        g.skip(2000);
        return g;
    }

    @Test
    void winner_isStoredOnce_andATieGoesTheSameWayForTheSameSeed() {
        Game g = tie();
        Map<String, Object> reveal = part(view(g), "reveal");
        assertThat(reveal.get("tied")).asList().containsExactlyInAnyOrder(keyBy(g, Q2, "p1"), keyBy(g, Q2, "p2"));
        Object winner = reveal.get("winner");
        assertThat(winner).isIn(keyBy(g, Q2, "p1"), keyBy(g, Q2, "p2"));
        assertThat(part(view(g), "reveal").get("winner")).isEqualTo(winner);
        Game again = tie();
        assertThat(st(again, Q2).entries.stream().filter(e -> e.key.equals(st(again, Q2).winner)).findFirst().orElseThrow().authorId)
                .isEqualTo(maker(g));
    }

    @Test
    void winner_withUnevenSets_isVotesPerTimeShown_butPoints100AVote() {
        Game g = atQ2(yesterday(10, "3"));
        Ballots b = st(g, Q2).ballots;
        assertThat(b.rounds).isEqualTo(1);
        String a = keyBy(g, Q2, "p1");
        String bb = keyBy(g, Q2, "p2");
        String d = keyBy(g, Q2, "p9");
        String e = keyBy(g, Q2, "p10");
        Map<String, List<String>> dealt = new LinkedHashMap<>();
        dealt.put("p3", List.of(a, bb, d));
        dealt.put("p4", List.of(a, bb, d));
        for (String v : List.of("p5", "p6", "p7", "p8")) dealt.put(v, List.of(bb, d, e));
        b.dealt.set(0, dealt);
        g.submit("p3", null, null, null, null, List.of(a), 0, EVERYONE_ONLINE);
        g.submit("p4", null, null, null, null, List.of(a), 0, EVERYONE_ONLINE);
        for (String v : List.of("p5", "p6", "p7")) g.submit(v, null, null, null, null, List.of(bb), 0, EVERYONE_ONLINE);
        g.submit("p8", null, null, null, null, List.of(d), 0, EVERYONE_ONLINE);
        g.skip(2000);
        Game.QState st = st(g, Q2);
        assertThat(st.winner).as("2 of 2 beats 3 of 6").isEqualTo(a);
        assertThat(st.gains).containsEntry("p1", 200).containsEntry("p2", 300);
        List<Map<String, Object>> shown = list(part(view(g), "reveal").get("entries"));
        assertThat(shown).filteredOn(m -> m.get("key").equals(a)).first().satisfies(m -> {
            assertThat(m.get("shown")).isEqualTo(2);
            assertThat(m.get("votes")).isEqualTo(2);
        });
    }

    @Test
    void winner_whenNobodyVoted_isStillPicked() {
        Game g = atQ2(yesterday(5));
        g.skip(2000);
        Game.QState st = st(g, Q2);
        assertThat(st.winner).isNotNull();
        assertThat(st.entries).extracting(e -> e.key).contains(st.winner);
        assertThat(st.gains).isEmpty();
    }

    // ─── picks ─────────────────────────────────────────────────────────

    /** Q1 everyone writes, Q2 votes: a pick from Q1, or (board) write + votes on Q1 itself */
    private static Game picksGame(int picks, boolean board, int n) {
        Map<Long, Game.QuestionSnap> q = new LinkedHashMap<>();
        Map<String, String> o = new HashMap<>(Map.of("ref", "q1"));
        if (board) o.put("picks", String.valueOf(picks));
        q.put(Q1, snap(Q1, QuestionType.USER_GENERATED, board ? "write/votes" : "write/none", "Say something", o));
        q.put(Q2, snap(Q2, QuestionType.PREWRITTEN_SINGLE, "pick/votes", "Best?", Map.of("from", "q1", "picks", String.valueOf(picks))));
        List<Game.Step> steps = board
                ? steps(q, Q1, Phase.QUESTION, 30, Q1, Phase.ANSWER, 30)
                : steps(q, Q1, Phase.QUESTION, 30, Q2, Phase.QUESTION, 30, Q2, Phase.ANSWER, 10);
        Game g = game(steps, n);
        writeAll(g);
        g.skip(1000);
        return g;
    }

    @Test
    void picks_upToNDifferent_neverYourOwn_100Each() {
        Game g = picksGame(2, false, 4);
        assertThat(part(view(g), "question").get("picks")).isEqualTo(2);
        assertThat(g.task("p1").get("picks")).isEqualTo(2);
        List<String> mine = ballot(g, "p1");
        assertThatThrownBy(() -> g.submit("p1", null, null, null, null, mine, 0, EVERYONE_ONLINE))
                .hasMessage("You can vote for up to 2");
        g.submit("p1", null, null, null, null, List.of(mine.get(0), mine.get(0)), 0, EVERYONE_ONLINE);
        assertThat(g.task("p1").get("chosen")).isEqualTo(List.of(mine.get(0)));
        g.submit("p1", null, null, null, null, List.of(mine.get(0), mine.get(1)), 0, EVERYONE_ONLINE);
        g.skip(2000);
        Game.QState st = st(g, Q2);
        String a = mine.get(0);
        String b = mine.get(1);
        String authorA = st.entries.stream().filter(e -> e.key.equals(a)).findFirst().orElseThrow().authorId;
        String authorB = st.entries.stream().filter(e -> e.key.equals(b)).findFirst().orElseThrow().authorId;
        assertThat(st.gains).containsEntry(authorA, 100).containsEntry(authorB, 100);

        Game w = picksGame(2, true, 4); // in Q1's ANSWER step: board voting
        assertThat(w.interaction()).isEqualTo("vote");
        List<String> others = st(w, Q1).entries.stream().filter(e -> !e.authorId.equals("p1")).map(e -> e.key).toList();
        assertThatThrownBy(() -> w.vote("p1", null, others, null, null, 0, EVERYONE_ONLINE))
                .hasMessage("You can vote for up to 2");
        assertThatThrownBy(() -> w.vote("p1", null, List.of(others.get(0), keyBy(w, Q1, "p1")), null, null, 0, EVERYONE_ONLINE))
                .hasMessage("You can't vote for your own");
        w.vote("p1", null, List.of(others.get(0), others.get(0), others.get(1)), null, null, 0, EVERYONE_ONLINE);
        assertThat(st(w, Q1).votes.get("p1")).containsExactly(others.get(0), others.get(1));
        assertThat(view(w).get("acted")).isEqualTo(List.of("p1"));
        w.skip(3000);
        assertThat(st(w, Q1).gains.values()).containsExactly(100, 100);
    }

    @Test
    void picks_one_keepsTodaysBoardVoting() {
        Game w = picksGame(1, true, 3);
        assertThat(w.interaction()).isEqualTo("vote");
        assertThatThrownBy(() -> w.vote("p1", "nope", null, null, 0, EVERYONE_ONLINE)).hasMessage("That answer is not on the board");
        assertThatThrownBy(() -> w.vote("p1", keyBy(w, Q1, "p1"), null, null, 0, EVERYONE_ONLINE))
                .hasMessage("You can't vote for your own");
        w.vote("p1", keyBy(w, Q1, "p2"), null, null, 0, EVERYONE_ONLINE);
        assertThat(view(w).get("acted")).isEqualTo(List.of("p1"));
        assertThatThrownBy(() -> w.vote("p2", null, List.of(keyBy(w, Q1, "p1"), keyBy(w, Q1, "p3")), null, null, 0, EVERYONE_ONLINE))
                .hasMessage("You can vote for up to 1");
        w.skip(3000);
        assertThat(st(w, Q1).gains).containsEntry("p2", 100);
    }

    @Test
    void everyoneDone_isMinOfPicksAndWhatTheyCanSee() {
        // two players see one answer each: one vote is all they can give
        Game g = picksGame(2, false, 2);
        long before = g.endsAt;
        g.submit("p1", null, null, null, null, List.of(ballot(g, "p1").get(0)), 1500, EVERYONE_ONLINE);
        assertThat(view(g).get("answered")).isEqualTo(List.of("p1"));
        g.submit("p2", null, null, null, null, List.of(ballot(g, "p2").get(0)), 1500, EVERYONE_ONLINE);
        assertThat(g.endsAt).isLessThan(before).isEqualTo(1500 + Game.EVERYONE_DONE_MS);

        // three see two each: one of two isn't done
        Game three = picksGame(2, false, 3);
        three.submit("p1", null, null, null, null, List.of(ballot(three, "p1").get(0)), 1500, EVERYONE_ONLINE);
        assertThat(view(three).get("answered")).isEqualTo(List.of());
        three.submit("p1", null, null, null, null, ballot(three, "p1"), 1500, EVERYONE_ONLINE);
        assertThat(view(three).get("answered")).isEqualTo(List.of("p1"));
    }

    // ─── fill-ins ──────────────────────────────────────────────────────

    @Test
    void winnerFill_isTheSameForEveryone_andNoStoredLabelEverShows() {
        Game g = atQ3(yesterday(5));
        Game.QState q2 = st(g, Q2);
        String words = q2.entries.stream().filter(e -> e.key.equals(q2.winner)).findFirst().orElseThrow().text;
        String text = (String) part(view(g), "question").get("text");
        assertThat(text).isEqualTo("The funniest answer was: “" + words + "”. Who do you think wrote it?");
        StringBuilder all = new StringBuilder(json(view(g)));
        g.players.keySet().forEach(p -> all.append(json(g.task(p))));
        while (g.status() != Game.Status.FINISHED) {
            all.append(json(view(g)));
            g.players.keySet().forEach(p -> all.append(json(g.task(p))));
            g.skip(9000);
        }
        g.snaps.values().forEach(q -> all.append(json(g.results(q))));
        assertThat(all.toString()).doesNotContain("{@");
        assertThat(json(g.results(g.snaps.get(Q3)).get("text"))).contains(words);
    }

    // ─── person ────────────────────────────────────────────────────────

    @Test
    void person_rightIsWhoeverMadeTheWinner_andScores100() {
        Game g = atQ3(yesterday(5));
        String w = maker(g);
        String guesser = w.equals("p1") ? "p2" : "p1";
        String wrong = g.players.keySet().stream().filter(p -> !p.equals(w) && !p.equals(guesser)).findFirst().orElseThrow();
        g.submit(guesser, null, null, null, null, List.of(w), 0, EVERYONE_ONLINE);
        g.submit(wrong, null, null, null, null, List.of(guesser), 0, EVERYONE_ONLINE);
        g.skip(4000);
        Game.QState st = st(g, Q3);
        assertThat(st.settled).isTrue();
        assertThat(st.gains).containsOnly(Map.entry(guesser, 100));
        Map<String, Object> reveal = part(view(g), "reveal");
        assertThat(reveal.get("author")).isEqualTo(w);
        assertThat(reveal.get("named")).isEqualTo(Map.of(w, 1, guesser, 1));
    }

    @Test
    void person_listIsEveryoneWhoPlayedAndTheMakers_withoutYou() {
        Game g = yesterday(5);
        atQ2(g);
        g.removePlayer("p5", 0);
        voteFirst(g);
        g.skip(2000);
        g.skip(3000);
        List<Map<String, Object>> people = list(part(view(g), "question").get("people"));
        assertThat(people).extracting(m -> m.get("id")).containsExactly("p1", "p2", "p3", "p4", "p5");
        assertThat(people).extracting(m -> m.get("name")).contains("P5");
        assertThatThrownBy(() -> g.submit("p1", null, null, null, null, List.of("p1"), 0, EVERYONE_ONLINE))
                .hasMessage("Pick someone else");
        assertThatThrownBy(() -> g.submit("p1", null, null, null, null, List.of("stranger"), 0, EVERYONE_ONLINE))
                .hasMessage("Pick someone from the list");
        assertThatThrownBy(() -> g.submit("p1", null, null, null, null, List.of(), 0, EVERYONE_ONLINE))
                .hasMessage("Pick someone");
        g.submit("p1", null, null, null, null, List.of("p5"), 0, EVERYONE_ONLINE);
        assertThat(g.task("p1").get("chosen")).isEqualTo("p5");
    }

    @Test
    void person_theMakerAnswersLikeEveryoneElse_andCantScore() {
        Game g = atQ3(yesterday(5));
        String w = maker(g);
        assertThat(g.task(w)).containsEntry("kind", "person").containsEntry("yours", true);
        g.players.keySet().stream().filter(p -> !p.equals(w)).forEach(p -> assertThat(g.task(p)).doesNotContainKey("yours"));
        String other = w.equals("p1") ? "p2" : "p1";
        g.submit(w, null, null, null, null, List.of(other), 0, EVERYONE_ONLINE);
        assertThat(view(g).get("answered")).isEqualTo(List.of(w));
        g.skip(4000);
        assertThat(st(g, Q3).gains).doesNotContainKey(w);
    }

    @Test
    void person_entryCarriesTheWinnerWithoutItsAuthor() {
        Game g = atQ3(yesterday(5));
        Game.QState q2 = st(g, Q2);
        String words = q2.entries.stream().filter(e -> e.key.equals(q2.winner)).findFirst().orElseThrow().text;
        Map<String, Object> entry = part(part(view(g), "question"), "entry");
        assertThat(entry).isEqualTo(Map.of("text", words));
        assertThat(json(part(view(g), "question"))).doesNotContain("authorId");
    }

    // ─── keeping it a secret ───────────────────────────────────────────

    @Test
    void held_hidesAuthorsAndPointsUntilThePersonQuestionSettles() {
        Game g = atQ2(yesterday(5));
        voteFirst(g);
        g.skip(2000); // Q2 ANSWER
        Map<String, Object> reveal = part(view(g), "reveal");
        assertThat(reveal).containsEntry("held", true).doesNotContainKey("gains");
        assertThat(json(reveal)).doesNotContain("authorId");
        assertThat(total(g)).isZero();
        assertThat(g.players.values()).allMatch(p -> p.gain == 0);
        assertThat(st(g, Q2).gains.values().stream().mapToInt(x -> x).sum()).isEqualTo(500);

        g.skip(3000); // Q3 QUESTION
        String w = maker(g);
        g.players.keySet().stream().filter(p -> !p.equals(w))
                .forEach(p -> g.submit(p, null, null, null, null, List.of(w), 0, EVERYONE_ONLINE));
        g.skip(4000); // Q3 ANSWER
        assertThat(total(g)).isEqualTo(500 + 400);
        Map<String, Object> after = part(view(g), "reveal");
        assertThat(after.get("released")).isEqualTo(st(g, Q2).gains);
        assertThat(st(g, Q2).held).isFalse();
        int q2Points = st(g, Q2).gains.getOrDefault(w, 0);
        assertThat(g.players.get(w).gain).isEqualTo(q2Points);
    }

    @Test
    void held_unscoredSourceShownWithShowAnswers_keepsItsAuthorsHidden() {
        Map<Long, Game.QuestionSnap> q = golden(GOLDEN_Q2);
        Game g = game(steps(q, Q1, Phase.QUESTION, 60, Q1, Phase.ANSWER, 10,
                Q2, Phase.QUESTION, 40, Q2, Phase.ANSWER, 15, Q3, Phase.QUESTION, 25, Q3, Phase.ANSWER, 10), 4);
        writeAll(g);
        g.skip(1000); // Q1 ANSWER
        List<Map<String, Object>> entries = list(part(view(g), "reveal").get("entries"));
        assertThat(entries).hasSize(4).allSatisfy(e -> assertThat(e).doesNotContainKey("authorId"));
    }

    @Test
    void held_anotherVoteOnTheSameAnswers_staysHiddenToo() {
        Map<Long, Game.QuestionSnap> q = golden(GOLDEN_Q2);
        long q6 = 6;
        q.put(q6, snap(q6, QuestionType.PREWRITTEN_SINGLE, "pick/votes", "Which is the oddest?", Map.of("from", "q1")));
        Game g = game(steps(q, Q1, Phase.QUESTION, 60, Q2, Phase.QUESTION, 40, Q2, Phase.ANSWER, 15,
                q6, Phase.QUESTION, 40, q6, Phase.ANSWER, 15, Q3, Phase.QUESTION, 25, Q3, Phase.ANSWER, 10), 4);
        writeAll(g);
        g.skip(1000);
        voteFirst(g);
        g.skip(2000);
        g.skip(3000); // the second vote
        voteFirst(g);
        g.skip(4000);
        Map<String, Object> reveal = part(view(g), "reveal");
        assertThat(reveal).containsEntry("held", true);
        assertThat(json(reveal)).doesNotContain("authorId");
        assertThat(total(g)).isZero();
        g.skip(5000); // Q3 QUESTION
        g.skip(6000); // Q3 ANSWER
        assertThat(total(g)).isEqualTo(800);
        assertThat(st(g, q6).held).isFalse();
        @SuppressWarnings("unchecked")
        Map<String, Integer> released = (Map<String, Integer>) part(view(g), "reveal").get("released");
        assertThat(released.values().stream().mapToInt(x -> x).sum()).isEqualTo(800);
    }

    @Test
    void held_isPaidWhenTheGameEndsBeforeThePersonQuestion() {
        Game g = atQ2(yesterday(5));
        voteFirst(g);
        g.skip(2000);
        assertThat(total(g)).isZero();
        g.end(3000);
        assertThat(g.status()).isEqualTo(Game.Status.FINISHED);
        assertThat(total(g)).isEqualTo(500);
        assertThat(st(g, Q2).held).isFalse();
        assertThat(g.players.values().stream().mapToInt(p -> p.gain).sum()).isEqualTo(500);
    }

    // ─── dealt: someone else's answer to draw or write about ───────────

    @Test
    void dealt_everyAuthorGetsADifferentAnswer_neverTheirOwn() {
        Game g = atQ4(yesterday(5));
        Map<String, Game.Entry> dealt = st(g, Q4).dealt;
        assertThat(dealt).hasSize(5);
        assertThat(dealt.values().stream().map(e -> e.key).toList()).doesNotHaveDuplicates();
        dealt.forEach((p, e) -> assertThat(e.authorId).isNotEqualTo(p));
    }

    @Test
    @SuppressWarnings("unchecked")
    void dealt_theSharedTextHasBlanks_andTheTaskHasTheFill() {
        Game g = atQ4(yesterday(5));
        Map<String, Object> q = part(view(g), "question");
        assertThat(q.get("text")).isEqualTo("How did you think ___'s face looked when they typed ___?");
        assertThat(q.get("dealt")).isEqualTo(true);
        Game.Entry d = st(g, Q4).dealt.get("p1");
        Map<String, Object> task = g.task("p1");
        assertThat(task.get("kind")).isEqualTo("draw");
        String name = g.players.get(d.authorId).name;
        assertThat(task.get("prompt")).isEqualTo("How did you think " + name + "'s face looked when they typed “" + d.text + "”?");
        assertThat((Map<String, Object>) task.get("about")).containsEntry("name", name).containsEntry("text", d.text);
        assertThat(json(view(g))).doesNotContain(d.text);
    }

    @Test
    void dealt_aLatecomerGetsTheLeastDealt() {
        Game g = atQ4(yesterday(5));
        g.addPlayer("late", "Late", null, 7000);
        assertThat(g.task("late")).containsKey("about");
        Map<String, Integer> counts = new HashMap<>();
        st(g, Q4).dealt.values().forEach(e -> counts.merge(e.key, 1, Integer::sum));
        assertThat(st(g, Q4).dealt).hasSize(6);
        assertThat(counts.values().stream().mapToInt(x -> x).max().orElseThrow()).isEqualTo(2);
        assertThat(counts).hasSize(5);
    }

    @Test
    @SuppressWarnings("unchecked")
    void dealt_beforeTheGuess_namesNobody() {
        Map<Long, Game.QuestionSnap> q = golden(GOLDEN_Q2);
        Game g = game(steps(q, Q1, Phase.QUESTION, 60, Q2, Phase.QUESTION, 40, Q2, Phase.ANSWER, 15,
                Q4, Phase.QUESTION, 90, Q3, Phase.QUESTION, 25, Q3, Phase.ANSWER, 10), 4);
        writeAll(g);
        g.skip(1000);
        voteFirst(g);
        g.skip(2000);
        g.skip(3000); // Q4, before Q3 asks who wrote what
        Map<String, Object> task = g.task("p1");
        assertThat((String) task.get("prompt")).startsWith("How did you think someone's face");
        assertThat((Map<String, Object>) task.get("about")).doesNotContainKey("name").containsKey("text");
    }

    @Test
    void dealt_drawingsCarryWhatTheyreAbout_intoTheVote() {
        Game g = atQ4(yesterday(5));
        g.players.keySet().forEach(p -> g.draw(p, PNG, "image/png", 7000, EVERYONE_ONLINE));
        g.skip(8000); // Q5 QUESTION
        Map<String, Object> board = part(view(g), "board");
        assertThat(board.get("mode")).isEqualTo("shared");
        List<Map<String, Object>> entries = list(board.get("entries"));
        assertThat(entries).hasSize(5).allSatisfy(e -> {
            assertThat(e).containsKey("image").doesNotContainKey("authorId");
            @SuppressWarnings("unchecked")
            Map<String, Object> about = (Map<String, Object>) e.get("about");
            assertThat(about).containsKeys("name", "text");
            assertThat((String) about.get("text")).startsWith("did p");
        });
    }

    // ─── labels and sources ────────────────────────────────────────────

    @Test
    void labels_resolveToTheNearestEarlier_andAStrayOneLinksNothing() {
        Map<Long, Game.QuestionSnap> q = new LinkedHashMap<>();
        q.put(1L, snap(1, QuestionType.USER_GENERATED, "write/none", "First", Map.of("ref", "q1")));
        q.put(2L, snap(2, QuestionType.USER_GENERATED, "write/none", "Second", Map.of("ref", "q1")));
        q.put(3L, snap(3, QuestionType.PREWRITTEN_SINGLE, "pick/votes", "Vote", Map.of("from", "q1")));
        Game g = new Game("ABCDE", "host", "quiz", steps(q, 1L, Phase.QUESTION, 10, 2L, Phase.QUESTION, 10,
                3L, Phase.QUESTION, 10), new Random(7), 0);
        assertThat(g.sources.get(3L).id()).isEqualTo(2L);

        q.put(4L, snap(4, QuestionType.PREWRITTEN_SINGLE, "pick/votes", "Stray", Map.of("from", "zz")));
        Game stray = game(steps(q, 4L, Phase.QUESTION, 10, 4L, Phase.ANSWER, 10), 3);
        assertThat(stray.sources).isEmpty();
        assertThat(part(view(stray), "board").get("count")).isEqualTo(0);
        assertThat(ballot(stray, "p1")).isEmpty();
        stray.skip(1000);
        stray.skip(2000);
        assertThat(stray.status()).isEqualTo(Game.Status.FINISHED);
    }

    @Test
    void source_isSettledBeforeTheQuestionUsingItStarts() {
        Map<Long, Game.QuestionSnap> q = new LinkedHashMap<>();
        q.put(Q1, snap(Q1, QuestionType.USER_GENERATED_VOTE, "write/votes", "Say something", Map.of("ref", "q1")));
        q.put(Q2, snap(Q2, QuestionType.PREWRITTEN_SINGLE, "person/right", "Who said {@q1.winner}?", Map.of("from", "q1")));
        Game g = game(steps(q, Q1, Phase.QUESTION, 30, Q1, Phase.ELABORATION, 5, Q2, Phase.QUESTION, 20), 3);
        writeAll(g);
        g.skip(1000); // ELABORATION: revealed, not settled
        assertThat(st(g, Q1).settled).isFalse();
        g.skip(2000);
        assertThat(st(g, Q1).settled).isTrue();
        assertThat(st(g, Q1).winner).isNotNull();
        assertThat((String) part(view(g), "question").get("text")).startsWith("Who said “did p");
    }

    @Test
    void aSourceThatNeverRan_leavesAnEmptyBoard_andTheQuestionStillPlays() {
        Map<Long, Game.QuestionSnap> q = golden(GOLDEN_Q2);
        Game g = game(steps(q, Q2, Phase.QUESTION, 40, Q2, Phase.ANSWER, 15, Q1, Phase.QUESTION, 60), 3);
        assertThat(g.sources.get(Q2).id()).isEqualTo(Q1);
        assertThat(g.questions.get(Q1)).isNull();
        assertThat(part(view(g), "board").get("count")).isEqualTo(0);
        g.skip(1000);
        assertThat(st(g, Q2).winner).isNull();
        g.skip(2000);
        writeAll(g);
        g.skip(3000);
        assertThat(g.status()).isEqualTo(Game.Status.FINISHED);
    }

    @Test
    void task_isEmptyOutsideQuestion_forBallotsPersonAndDealt() {
        Game g = atQ2(yesterday(5));
        voteFirst(g);
        g.skip(2000); // Q2 ANSWER
        assertThat(g.task("p1")).isEmpty();
        g.skip(3000); // Q3 QUESTION
        assertThat(g.task("p1")).isNotEmpty();
        g.skip(4000); // Q3 ANSWER
        assertThat(g.task("p1")).isEmpty();
        g.skip(5000); // Q3 RESULT
        assertThat(g.task("p1")).isEmpty();
        g.skip(6000); // Q4
        assertThat(g.task("p1")).containsKey("prompt");
        g.skip(7000); // Q5 QUESTION
        g.skip(8000); // Q5 ANSWER
        assertThat(g.task("p1")).isEmpty();
    }

    @Test
    void restart_forgetsBallotsPairsWinnersAndHeldPoints() {
        Game g = yesterday(10, "3");
        atQ2(g);
        voteFirst(g);
        g.skip(2000);
        assertThat(st(g, Q2).held).isTrue();
        g.restart(3000);
        assertThat(g.questions).isEmpty();
        assertThat(total(g)).isZero();
        g.start(4000);
        writeAll(g);
        g.skip(5000);
        Game.QState st = st(g, Q2);
        assertThat(st.winner).isNull();
        assertThat(st.held).isFalse();
        assertThat(st.ballots).isNotNull();
        assertThat(st.ballots.round).isEqualTo(1);
        assertThat(st.ballots.votesNow()).isEmpty();
    }

    @Test
    void skip_throughTheVote_stillSettlesAndPicksAWinner() {
        Game g = atQ2(yesterday(10, "3"));
        g.skip(2000);
        Game.QState st = st(g, Q2);
        assertThat(st.settled).isTrue();
        assertThat(st.winner).isNotNull();
        assertThat(part(view(g), "reveal").get("winner")).isEqualTo(st.winner);
    }

    @Test
    void alone_everyQuestionStillPlaysToTheEnd() {
        Game g = yesterday(1);
        writeAll(g);
        long t = 1000;
        while (g.status() != Game.Status.FINISHED) {
            g.task("p1");
            view(g);
            if (g.current().question().id() == Q4) g.draw("p1", PNG, "image/png", t, EVERYONE_ONLINE);
            g.skip(t += 1000);
        }
        assertThat(st(g, Q2).winner).isNotNull();
        assertThat(total(g)).isZero();
    }

    // ─── the whole quiz, from what the editor stores ───────────────────

    private static Question question(long id, QuestionType type, String mode, String text, String options) {
        Question q = new Question();
        q.setId(id);
        q.setType(type);
        q.setMode(mode);
        q.setText(text);
        q.setOptions(options);
        q.setAnswers(new ArrayList<>());
        return q;
    }

    @Test
    @SuppressWarnings("unchecked")
    void theWholeQuiz_fromTheGoldenStorage_playsAsTheScriptSays() {
        Question q1 = question(Q1, QuestionType.USER_GENERATED, "write/none", "What did you do yesterday?", "ref=q1");
        Question q2 = question(Q2, QuestionType.PREWRITTEN_SINGLE, "pick/votes", "Which one is the funniest?",
                "from=q1, overflow=6, ref=q2");
        Question q3 = question(Q3, QuestionType.PREWRITTEN_SINGLE, "person/right",
                "The funniest answer was: {@q2.winner}. Who do you think wrote it?", "from=q2");
        Question q4 = question(Q4, QuestionType.DRAW, "draw/none",
                "How did you think {author}'s face looked when they typed {answer}?", "from=q1, ref=q4");
        Question q5 = question(Q5, QuestionType.PREWRITTEN_SINGLE, "pick/votes", "Which drawing is the funniest? Pick up to 2.",
                "from=q4, picks=2");
        Action roster = new Action(null, Phase.ROSTER, 0);
        roster.setPreview("{\"names\":[\"Anna\",\"Bence\",\"Csilla\",\"Dani\",\"Eszter\"],\"unique\":true}");
        Quiz quiz = new Quiz();
        quiz.setName("Yesterday");
        quiz.setActions(new ArrayList<>(List.of(roster,
                new Action(q1, Phase.QUESTION, 60),
                new Action(q2, Phase.QUESTION, 40), new Action(q2, Phase.ANSWER, 15),
                new Action(q3, Phase.QUESTION, 25), new Action(q3, Phase.ANSWER, 10), new Action(q3, Phase.RESULT, 8),
                new Action(q4, Phase.QUESTION, 90),
                new Action(q5, Phase.QUESTION, 40), new Action(q5, Phase.ANSWER, 15), new Action(q5, Phase.RESULT, 10))));
        assertThat(quiz.getActions()).hasSize(11);

        List<Game.Step> steps = GameEngine.snapshot(quiz, new Random(7));
        assertThat(steps).hasSize(10);
        assertThat(steps.get(1).question().options()).containsEntry("from", "q1").containsEntry("overflow", "6")
                .containsEntry("ref", "q2");
        assertThat(steps.get(1).question().mode()).isEqualTo(new Mode(Mode.Ask.PICK, Mode.Score.VOTES));
        assertThat(steps.get(3).question().mode()).isEqualTo(new Mode(Mode.Ask.PERSON, Mode.Score.RIGHT));

        Game g = new Game("ABCDE", "host", "Yesterday", steps, new Random(7), 0);
        for (int i = 1; i <= 8; i++) g.addPlayer("p" + i, "P" + i, null, 0);
        g.start(0);

        writeAll(g); // Q1
        g.skip(1000); // Q2: 7 to choose from each, 6 at most: ballots
        assertThat(part(view(g), "board").get("mode")).isEqualTo("ballots");
        g.players.keySet().forEach(p -> assertThat(ballot(g, p)).hasSize(6));
        voteFirst(g);
        g.skip(2000); // Q2 ANSWER: held
        assertThat(part(view(g), "reveal").get("held")).isEqualTo(true);
        assertThat(total(g)).isZero();
        g.skip(3000); // Q3
        String w = maker(g);
        assertThat((String) part(view(g), "question").get("text")).startsWith("The funniest answer was: “did p");
        for (String p : g.players.keySet()) {
            g.submit(p, null, null, null, null, List.of(p.equals(w) ? (w.equals("p1") ? "p2" : "p1") : w), 0, EVERYONE_ONLINE);
        }
        g.skip(4000); // Q3 ANSWER
        assertThat(part(view(g), "reveal").get("author")).isEqualTo(w);
        assertThat(total(g)).isEqualTo(800 + 700);
        g.skip(5000); // Q3 RESULT
        g.skip(6000); // Q4
        assertThat(st(g, Q4).dealt).hasSize(8);
        g.players.keySet().forEach(p -> g.draw(p, PNG, "image/png", 6500, EVERYONE_ONLINE));
        g.skip(7000); // Q5: everyone sees the 7 others, picks 2
        assertThat(part(view(g), "board").get("mode")).isEqualTo("shared");
        for (String p : g.players.keySet()) {
            g.submit(p, null, null, null, null, ballot(g, p).subList(0, 2), 0, EVERYONE_ONLINE);
        }
        g.skip(8000); // Q5 ANSWER
        g.skip(9000); // Q5 RESULT
        g.skip(10000);
        assertThat(g.status()).isEqualTo(Game.Status.FINISHED);
        assertThat(total(g)).isEqualTo(800 + 700 + 1600);

        GameEngine engine = new GameEngine(mock(QuizRepository.class), mock(UserRepository.class),
                mock(SimpMessagingTemplate.class), mock(PresenceTracker.class), mock(GameRecordRepository.class), JSON);
        try {
            Map<String, Object> content = engine.recordContent(g);
            List<Map<String, Object>> questions = (List<Map<String, Object>>) content.get("questions");
            assertThat(questions).hasSize(5);
            Set<String> options = new HashSet<>();
            questions.forEach(qm -> options.add(String.valueOf(qm.get("options"))));
            assertThat(String.join(" | ", options)).contains("from=q1").contains("ref=q2").contains("picks=2");
            assertThat(questions.get(2).get("mode")).isEqualTo("person/right");
            Map<String, Object> results = (Map<String, Object>) content.get("results");
            Map<String, Object> r3 = (Map<String, Object>) results.get(String.valueOf(Q3));
            assertThat(r3.get("author")).isEqualTo(g.players.get(w).name);
            assertThat((String) r3.get("text")).doesNotContain("{@");
            Map<String, Object> r2 = (Map<String, Object>) results.get(String.valueOf(Q2));
            assertThat(list(r2.get("entries"))).hasSize(8);
        } finally {
            engine.stop();
        }
    }
}
