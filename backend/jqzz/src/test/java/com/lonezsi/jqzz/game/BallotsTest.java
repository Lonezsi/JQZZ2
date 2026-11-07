package com.lonezsi.jqzz.game;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

import org.junit.jupiter.api.Test;

/** Dealing ballots and pairs: everyone covered, nobody their own, as even as it gets. */
class BallotsTest {

    /** n entries, written by p0..p(n-1) */
    private static List<Game.Entry> entries(int n) {
        List<Game.Entry> out = new ArrayList<>();
        for (int i = 0; i < n; i++) out.add(new Game.Entry("e" + (i + 1), "p" + i, "answer " + i));
        return out;
    }

    private static List<String> people(int from, int to) {
        List<String> out = new ArrayList<>();
        for (int i = from; i < to; i++) out.add("p" + i);
        return out;
    }

    private static Map<String, String> authors(List<Game.Entry> entries) {
        Map<String, String> out = new HashMap<>();
        entries.forEach(e -> out.put(e.key, e.authorId));
        return out;
    }

    private static Map<String, Integer> times(Map<String, List<List<String>>> dealt, List<Game.Entry> entries) {
        Map<String, Integer> t = new HashMap<>();
        entries.forEach(e -> t.put(e.key, 0));
        dealt.values().forEach(rounds -> rounds.forEach(b -> b.forEach(k -> t.merge(k, 1, Integer::sum))));
        return t;
    }

    @Test
    void deal_coversEveryEntry_whenThereArePlacesForAll() {
        for (int n = 2; n <= 40; n++) {
            for (int cap = 2; cap <= 8; cap++) {
                for (int seed = 1; seed <= 20; seed++) {
                    List<Game.Entry> es = entries(n);
                    Map<String, String> by = authors(es);
                    Map<String, List<List<String>>> d = Ballots.deal(es, people(0, n), cap, 1, new Random(seed));
                    Map<String, Integer> t = times(d, es);
                    assertThat(t.values()).as("n %d cap %d seed %d", n, cap, seed).allMatch(x -> x >= 1);
                    int c = cap;
                    int size = n;
                    d.forEach((v, rounds) -> {
                        assertThat(rounds.get(0)).hasSize(Math.min(c, size - 1)).doesNotHaveDuplicates();
                        assertThat(rounds.get(0)).allMatch(k -> !by.get(k).equals(v));
                    });
                }
            }
        }
    }

    @Test
    void deal_shownCountsDifferByAtMostOne() {
        for (int n = 2; n <= 30; n++) {
            for (int cap = 2; cap <= 8; cap += 3) {
                for (int seed = 1; seed <= 10; seed++) {
                    List<Game.Entry> es = entries(n);
                    // every author votes; then some authors gone and some voters who wrote nothing
                    for (List<String> voters : List.of(people(0, n), people(n / 2, n + 3))) {
                        if (voters.isEmpty()) continue;
                        Map<String, String> by = authors(es);
                        Map<String, List<List<String>>> d = Ballots.deal(es, voters, cap, 2, new Random(seed));
                        Map<String, Integer> t = times(d, es);
                        List<Integer> showable = es.stream()
                                .filter(e -> voters.stream().anyMatch(v -> !v.equals(by.get(e.key))))
                                .map(e -> t.get(e.key)).toList();
                        int most = showable.stream().mapToInt(x -> x).max().orElse(0);
                        int least = showable.stream().mapToInt(x -> x).min().orElse(0);
                        assertThat(most - least).as("n %d cap %d seed %d", n, cap, seed).isLessThanOrEqualTo(1);
                    }
                }
            }
        }
    }

    @Test
    void deal_nobodySeesTheSameEntryTwiceAcrossRounds() {
        List<Game.Entry> es = entries(30);
        Map<String, List<List<String>>> d = Ballots.deal(es, people(0, 4), 5, 5, new Random(7));
        d.values().forEach(rounds -> {
            List<String> all = new ArrayList<>();
            rounds.forEach(all::addAll);
            assertThat(all).doesNotHaveDuplicates();
        });
    }

    @Test
    void deal_sameSeedSameBallots() {
        List<Game.Entry> es = entries(17);
        assertThat(Ballots.deal(es, people(0, 17), 4, 2, new Random(7)))
                .isEqualTo(Ballots.deal(es, people(0, 17), 4, 2, new Random(7)));
    }

    @Test
    void open_addsRoundsOnlyWhenOneRoundCantCover() {
        // 12 answers, only 2 people left who didn't write any of them, 3 each: two rounds
        Ballots two = Ballots.open(entries(12), List.of("x", "y"), 3, 40_000, 0, 40_000, new Random(7));
        assertThat(two.rounds).isEqualTo(2);
        Map<String, Integer> seen = new HashMap<>();
        two.dealt.forEach(r -> r.values().forEach(b -> b.forEach(k -> seen.merge(k, 1, Integer::sum))));
        assertThat(seen).hasSize(12).allSatisfy((k, n) -> assertThat(n).isEqualTo(1));
        assertThat(two.roundMs).isEqualTo(20_000);
        assertThat(two.roundEndsAt).isEqualTo(20_000);

        Ballots one = Ballots.open(entries(10), people(0, 10), 6, 40_000, 0, 40_000, new Random(7));
        assertThat(one.rounds).isEqualTo(1);
        assertThat(one.roundMs).isZero();
        assertThat(one.roundEndsAt).isZero();

        Ballots five = Ballots.open(entries(60), List.of("x"), 6, 40_000, 0, 40_000, new Random(7));
        assertThat(five.rounds).isEqualTo(5);
        Set<String> distinct = new HashSet<>();
        five.dealt.forEach(r -> distinct.addAll(r.get("x")));
        assertThat(distinct).hasSize(30);
        assertThat(five.roundMs).as("at least 8 seconds a round").isEqualTo(Ballots.LEAST_ROUND_MS);
    }

    @Test
    void pairs_capOne_isADerangement() {
        for (int n = 2; n <= 25; n++) {
            for (int seed = 1; seed <= 10; seed++) {
                List<Game.Entry> es = entries(n);
                Map<String, Game.Entry> p = Ballots.pairs(es, people(0, n), new Random(seed));
                assertThat(p).hasSize(n);
                assertThat(p.values().stream().map(e -> e.key).toList()).doesNotHaveDuplicates();
                p.forEach((who, e) -> assertThat(e.authorId).isNotEqualTo(who));
            }
        }
    }

    @Test
    void pairs_morePlayersThanEntries_repeatEvenly() {
        List<Game.Entry> es = entries(3);
        Map<String, Game.Entry> p = Ballots.pairs(es, people(0, 11), new Random(7));
        assertThat(p).hasSize(11);
        Map<String, Integer> counts = new HashMap<>();
        p.forEach((who, e) -> {
            assertThat(e.authorId).isNotEqualTo(who);
            counts.merge(e.key, 1, Integer::sum);
        });
        int most = counts.values().stream().mapToInt(x -> x).max().orElseThrow();
        int least = counts.values().stream().mapToInt(x -> x).min().orElseThrow();
        assertThat(counts).hasSize(3);
        assertThat(most - least).isLessThanOrEqualTo(1);
    }

    @Test
    void pairs_onlyYourOwn_dealsNothing() {
        List<Game.Entry> es = List.of(new Game.Entry("e1", "ann", "mine"));
        assertThat(Ballots.pairs(es, List.of("ann"), new Random(7))).isEmpty();
        assertThat(Ballots.pairFor("ann", es, Map.of(), new Random(7))).isNull();
    }

    @Test
    void ballotOf_aLatecomerGetsTheLeastShown_andNobodyElsesChanges() {
        List<Game.Entry> es = entries(9);
        Ballots b = Ballots.open(es, people(0, 9), 3, 40_000, 0, 40_000, new Random(7));
        Map<String, List<String>> before = new HashMap<>(b.dealt.get(0));
        assertThat(b.peek("late")).isNull();
        List<String> late = b.ballotOf("late", es, new Random(7));
        assertThat(late).hasSize(3).doesNotHaveDuplicates();
        assertThat(b.ballotOf("late", es, new Random(8))).as("the same on a reload").isEqualTo(late);
        before.forEach((v, ballot) -> assertThat(b.peek(v)).isEqualTo(ballot));
        // everyone was shown 3 times: a latecomer's 3 are then shown 4, nobody more
        Map<String, Integer> t = new HashMap<>();
        b.dealt.get(0).values().forEach(ballot -> ballot.forEach(k -> t.merge(k, 1, Integer::sum)));
        assertThat(t.values()).allMatch(n -> n == 3 || n == 4);
    }

    @Test
    void deal_twoHundredByTwoHundred_finishesQuickly() {
        List<Game.Entry> es = entries(200);
        long start = System.nanoTime();
        Ballots b = Ballots.open(es, people(0, 200), 6, 40_000, 0, 40_000, new Random(7));
        long ms = (System.nanoTime() - start) / 1_000_000;
        assertThat(b.rounds).isEqualTo(1);
        assertThat(ms).isLessThan(2000);
    }
}
