package com.lonezsi.jqzz.game;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * A telephone question while it is asked. Everyone starts a chain by writing;
 * each round every chain moves one player along, and whoever has it draws
 * what was written or describes what was drawn. In round r (from 1) chain c
 * is with players[(c + r - 1) % n], so nobody gets a chain back until every
 * other player has had it. Drawing rounds get twice the time of writing ones.
 */
final class Telephone {

    /** from players who don't say how many rounds */
    static final int DEFAULT_MOST = 8;
    /** someone playing alone hands it on to themselves this many times */
    static final int ALONE = 3;
    static final int MOST = 20;

    enum Kind { WRITE, DRAW, DESCRIBE }

    /** text or image (an art id), whichever the round asked for */
    record Link(String authorId, String text, String image) {}

    final List<String> players;
    final int rounds;
    private final long[] roundMs;
    int round = 1;
    long roundEndsAt;
    boolean done;
    /** chains.get(c)[r - 1]: what round r added to chain c, or null */
    final List<Link[]> chains = new ArrayList<>();

    /** wanted: the question's "rounds", or 0 to fit the players */
    Telephone(List<String> players, int wanted, long stepMs, long now) {
        this.players = List.copyOf(players);
        int n = this.players.size();
        int r;
        if (n <= 1) r = wanted > 0 ? wanted : ALONE;
        else if (wanted > 0) r = Math.min(wanted, Math.max(n, 3));
        else r = Math.min(Math.max(n, 3), DEFAULT_MOST);
        this.rounds = Math.max(1, Math.min(MOST, r));
        this.roundMs = new long[rounds];
        int weight = 0;
        for (int i = 1; i <= rounds; i++) weight += kind(i) == Kind.DRAW ? 2 : 1;
        for (int i = 1; i <= rounds; i++) {
            roundMs[i - 1] = Math.max(5000, stepMs * (kind(i) == Kind.DRAW ? 2 : 1) / weight);
        }
        for (int c = 0; c < n; c++) chains.add(new Link[rounds]);
        this.roundEndsAt = now + roundMs[0];
    }

    static Kind kind(int round) {
        return round == 1 ? Kind.WRITE : round % 2 == 0 ? Kind.DRAW : Kind.DESCRIBE;
    }

    Kind kind() {
        return kind(round);
    }

    /** the chain they hold in this round, or -1 when they aren't playing it */
    int chainOf(String userId, int r) {
        int i = players.indexOf(userId);
        return i < 0 ? -1 : Math.floorMod(i - (r - 1), players.size());
    }

    /** what they're handed this round: the latest thing in their chain, skipping the blanks */
    Link handed(String userId) {
        int c = chainOf(userId, round);
        if (c < 0) return null;
        Link[] chain = chains.get(c);
        for (int r = round - 1; r >= 1; r--) {
            if (chain[r - 1] != null) return chain[r - 1];
        }
        return null;
    }

    /** what they've put in this round so far */
    Link mine(String userId) {
        int c = chainOf(userId, round);
        return c < 0 ? null : chains.get(c)[round - 1];
    }

    void put(String userId, Link link) {
        int c = chainOf(userId, round);
        if (c >= 0) chains.get(c)[round - 1] = link;
    }

    /** who has put something in this round */
    Set<String> doneThisRound() {
        Set<String> did = new LinkedHashSet<>();
        for (String p : players) {
            if (mine(p) != null) did.add(p);
        }
        return did;
    }

    /** On to the next round; false when that was the last one. */
    boolean next(long now, long endsAt) {
        if (round >= rounds) {
            done = true;
            roundEndsAt = 0;
            return false;
        }
        round++;
        roundEndsAt = Math.min(now + roundMs[round - 1], endsAt);
        return true;
    }
}
