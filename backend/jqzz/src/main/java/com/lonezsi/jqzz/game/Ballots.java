package com.lonezsi.jqzz.game;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

/**
 * Who sees what, for a pick on an earlier question's answers that's too big
 * for one screen (its "overflow"), and who gets which answer to make something
 * about (write or draw with from). Everything is dealt the same way: least
 * shown first, never your own, never one you saw in an earlier round, then
 * swapped about until no answer is shown more than once more than another.
 * That puts every answer on someone's ballot whenever there are places for
 * them all, so another round only comes when one can't show them all.
 */
final class Ballots {

    static final int MOST_ROUNDS = 5;
    static final long LEAST_ROUND_MS = 8000;

    final int cap;
    final int rounds;
    /** 0 with one round: the step's clock is enough */
    final long roundMs;
    int round = 1;
    /** when this round ends; 0 in the last round, which runs to the step's end */
    long roundEndsAt;
    boolean done;
    /** per round (index round - 1): voter -> the entry keys on their ballot, in the order they see them */
    final List<Map<String, List<String>>> dealt = new ArrayList<>();
    /** per round: voter -> the keys they voted for */
    final List<Map<String, List<String>>> votes = new ArrayList<>();

    private Ballots(int cap, int rounds, long roundMs) {
        this.cap = cap;
        this.rounds = rounds;
        this.roundMs = roundMs;
        for (int r = 0; r < rounds; r++) {
            dealt.add(new LinkedHashMap<>());
            votes.add(new LinkedHashMap<>());
        }
    }

    /**
     * Deals the voters here now as few rounds as show every answer someone can
     * see (one that only its own author would see can't be), at most MOST_ROUNDS.
     * The rounds share the step's time, each at least LEAST_ROUND_MS.
     */
    static Ballots open(List<Game.Entry> entries, List<String> voters, int cap, long stepMs, long now, long endsAt,
            Random random) {
        Set<String> coverable = new HashSet<>();
        for (Game.Entry e : entries) {
            if (voters.stream().anyMatch(v -> !v.equals(e.authorId))) coverable.add(e.key);
        }
        Map<String, List<List<String>>> deal = null;
        int r = 1;
        for (; r <= MOST_ROUNDS; r++) {
            deal = deal(entries, voters, cap, r, random);
            Set<String> seen = new HashSet<>();
            deal.values().forEach(each -> each.forEach(seen::addAll));
            if (seen.containsAll(coverable) || r == MOST_ROUNDS) break;
        }
        int rounds = Math.min(r, MOST_ROUNDS);
        long roundMs = rounds == 1 ? 0 : Math.max(LEAST_ROUND_MS, stepMs / rounds);
        Ballots b = new Ballots(cap, rounds, roundMs);
        for (String v : voters) {
            List<List<String>> mine = deal.get(v);
            for (int i = 0; i < rounds; i++) b.dealt.get(i).put(v, List.copyOf(mine.get(i)));
        }
        b.roundEndsAt = rounds == 1 ? 0 : Math.min(now + roundMs, endsAt);
        return b;
    }

    /**
     * voter -> one ballot per round. Least shown first (ties in a shuffled
     * order), never your own, never one you had in an earlier round; then an
     * answer shown most is swapped for one shown least on a ballot that can
     * take it, until the counts are at most one apart. Each swap lowers the sum
     * of the squared counts, so it ends; and while two counts are two or more
     * apart, some holder of the one shown most can always take the other.
     */
    static Map<String, List<List<String>>> deal(List<Game.Entry> entries, List<String> voters, int cap, int rounds,
            Random random) {
        Map<String, String> author = new HashMap<>();
        List<String> keys = new ArrayList<>();
        for (Game.Entry e : entries) {
            author.put(e.key, e.authorId);
            keys.add(e.key);
        }
        Collections.shuffle(keys, random);
        Map<String, Integer> order = new HashMap<>();
        for (int i = 0; i < keys.size(); i++) order.put(keys.get(i), i);
        Map<String, Integer> times = new HashMap<>();
        keys.forEach(k -> times.put(k, 0));
        List<String> who = new ArrayList<>(voters);
        Collections.shuffle(who, random);

        Map<String, List<List<String>>> out = new LinkedHashMap<>();
        Map<String, Set<String>> had = new HashMap<>();
        for (String v : who) {
            out.put(v, new ArrayList<>());
            had.put(v, new HashSet<>());
        }
        for (int r = 0; r < rounds; r++) {
            for (String v : who) {
                Set<String> mine = had.get(v);
                List<String> pool = new ArrayList<>();
                for (String k : keys) {
                    if (!v.equals(author.get(k)) && !mine.contains(k)) pool.add(k);
                }
                pool.sort(Comparator.comparingInt(times::get)); // stable: the shuffled order breaks ties
                List<String> ballot = new ArrayList<>(pool.subList(0, Math.min(cap, pool.size())));
                ballot.forEach(k -> times.merge(k, 1, Integer::sum));
                mine.addAll(ballot);
                out.get(v).add(ballot);
            }
        }

        // an answer only its own author could be shown can't be, so it doesn't count as least shown
        List<String> showable = keys.stream().filter(k -> who.stream().anyMatch(v -> !v.equals(author.get(k)))).toList();
        while (showable.size() > 1) {
            String a = null;
            String b = null;
            for (String k : showable) {
                if (a == null || times.get(k) > times.get(a)) a = k;
                if (b == null || times.get(k) < times.get(b)) b = k;
            }
            if (times.get(a) - times.get(b) <= 1) break;
            boolean swapped = false;
            for (String v : who) {
                if (v.equals(author.get(b)) || had.get(v).contains(b)) continue;
                List<List<String>> mine = out.get(v);
                for (List<String> ballot : mine) {
                    int at = ballot.indexOf(a);
                    if (at < 0) continue;
                    ballot.set(at, b);
                    had.get(v).remove(a);
                    had.get(v).add(b);
                    times.merge(a, -1, Integer::sum);
                    times.merge(b, 1, Integer::sum);
                    swapped = true;
                    break;
                }
                if (swapped) break;
            }
            if (!swapped) break;
        }
        for (List<List<String>> mine : out.values()) {
            for (List<String> ballot : mine) Collections.shuffle(ballot, random);
        }
        return out;
    }

    /** this round's ballot; a latecomer is dealt one (least shown first), nobody else's changes */
    List<String> ballotOf(String voter, List<Game.Entry> entries, Random random) {
        Map<String, List<String>> now = dealt.get(round - 1);
        List<String> have = now.get(voter);
        if (have != null) return have;
        Set<String> before = new HashSet<>();
        Map<String, Integer> shown = new HashMap<>();
        for (Map<String, List<String>> r : dealt) {
            List<String> mine = r.get(voter);
            if (mine != null) before.addAll(mine);
            r.values().forEach(ballot -> ballot.forEach(k -> shown.merge(k, 1, Integer::sum)));
        }
        List<String> pool = new ArrayList<>();
        for (Game.Entry e : entries) {
            if (!voter.equals(e.authorId) && !before.contains(e.key)) pool.add(e.key);
        }
        Collections.shuffle(pool, random);
        pool.sort(Comparator.comparingInt(k -> shown.getOrDefault(k, 0)));
        List<String> ballot = new ArrayList<>(pool.subList(0, Math.min(cap, pool.size())));
        Collections.shuffle(ballot, random);
        List<String> kept = List.copyOf(ballot);
        now.put(voter, kept);
        return kept;
    }

    /** this round's ballot if dealt, without dealing */
    List<String> peek(String voter) {
        return dealt.get(round - 1).get(voter);
    }

    /** this round's votes */
    Map<String, List<String>> votesNow() {
        return votes.get(round - 1);
    }

    /** on to the next round (only called before the last) */
    void next(long now, long endsAt) {
        if (round >= rounds) return;
        round++;
        roundEndsAt = round == rounds ? 0 : Math.min(now + roundMs, endsAt);
    }

    /** one each: who gets which answer to write or draw about */
    static Map<String, Game.Entry> pairs(List<Game.Entry> entries, List<String> players, Random random) {
        Map<String, Game.Entry> byKey = new HashMap<>();
        entries.forEach(e -> byKey.put(e.key, e));
        Map<String, Game.Entry> out = new LinkedHashMap<>();
        deal(entries, players, 1, 1, random).forEach((p, rounds) -> {
            List<String> one = rounds.get(0);
            if (!one.isEmpty()) out.put(p, byKey.get(one.get(0)));
        });
        return out;
    }

    /** a latecomer's: the least dealt one that isn't theirs, or null */
    static Game.Entry pairFor(String player, List<Game.Entry> entries, Map<String, Game.Entry> dealt, Random random) {
        Map<String, Integer> used = new HashMap<>();
        dealt.values().forEach(e -> used.merge(e.key, 1, Integer::sum));
        List<Game.Entry> pool = new ArrayList<>();
        for (Game.Entry e : entries) {
            if (!player.equals(e.authorId)) pool.add(e);
        }
        if (pool.isEmpty()) return null;
        Collections.shuffle(pool, random);
        pool.sort(Comparator.comparingInt(e -> used.getOrDefault(e.key, 0)));
        return pool.get(0);
    }
}
