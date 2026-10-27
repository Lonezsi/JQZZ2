package com.lonezsi.jqzz.game;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.function.Predicate;

import com.lonezsi.jqzz.model.Phase;
import com.lonezsi.jqzz.model.QuestionType;

/**
 * One running game: a snapshot of a quiz, the people in it, and where it is.
 *
 * Plain Java with the clock passed in ({@code now}), so every rule here can be
 * tested without timers or Spring. {@link GameEngine} owns the clock, the
 * threads and the broadcasting; this owns what happens.
 *
 * The quiz is a list of steps (its playable actions). Each step has a phase:
 * WAITING counts down, QUESTION takes answers, ANSWER reveals them (and is
 * where voting, guessing and knockout battles happen), ELABORATION explains,
 * RESULT shows the leaderboard. A question is "revealed" the first time a
 * step after its QUESTION step shows it, and "settled" (scored) once nothing
 * more can change: straight away for questions scored by their answers, at the
 * end of the ANSWER step for the ones players vote on.
 */
public class Game {

    public static final int VOTE_POINTS = 100;
    public static final int GUESS_POINTS = 100;
    public static final int TIER_POINTS = 50;
    public static final int BATTLE_POINTS = 100;
    public static final int CHAMPION_POINTS = 200;
    public static final List<String> TIERS = List.of("S", "A", "B", "C", "D");
    public static final int MAX_TEXT = 200;
    public static final int MAX_PLAYERS = 200;
    /** once everyone has answered, the phase ends this soon */
    public static final long EVERYONE_DONE_MS = 1500;

    public enum Status { LOBBY, PLAYING, PAUSED, FINISHED }

    public record AnswerSnap(long id, String text, String imageUrl, int value) {}

    /** weight: points it gives, in percent. 100 normally, 0 when not graded, 200 for double. */
    public record QuestionSnap(long id, String text, String imageUrl, QuestionType type,
            String elaborationText, String elaborationImageUrl, List<AnswerSnap> answers, int weight) {
        public QuestionSnap(long id, String text, String imageUrl, QuestionType type,
                String elaborationText, String elaborationImageUrl, List<AnswerSnap> answers) {
            this(id, text, imageUrl, type, elaborationText, elaborationImageUrl, answers, 100);
        }
    }

    public record Step(Phase phase, int seconds, QuestionSnap question) {}

    static final class Player {
        final String id;
        String name;
        String picture;
        int score;
        int gain;

        Player(String id, String name, String picture) {
            this.id = id;
            this.name = name;
            this.picture = picture;
        }
    }

    static final class Entry {
        final String key;
        final String authorId;
        final String text;
        int votes;

        Entry(String key, String authorId, String text) {
            this.key = key;
            this.authorId = authorId;
            this.text = text;
        }
    }

    static final class Match {
        final int id;
        final Entry a;
        final Entry b; // null: a bye
        final Map<String, String> votes = new LinkedHashMap<>();
        Entry winner;

        Match(int id, Entry a, Entry b) {
            this.id = id;
            this.a = a;
            this.b = b;
        }
    }

    static final class Bracket {
        int round;
        int rounds;
        long roundMs;
        long roundEndsAt;
        int nextMatchId = 1;
        List<Match> matches = new ArrayList<>();
        final List<List<Match>> history = new ArrayList<>();
        Entry champion;
        boolean done;
    }

    static final class QState {
        final Map<String, List<Long>> picks = new LinkedHashMap<>();
        final Map<String, String> texts = new LinkedHashMap<>();
        final Map<String, Map<Long, String>> tiers = new LinkedHashMap<>();
        final Map<String, String> votes = new LinkedHashMap<>();
        final Map<String, Map<String, String>> guesses = new LinkedHashMap<>();
        List<Entry> entries = List.of();
        Map<Long, String> consensus = Map.of();
        final Map<String, Integer> gains = new HashMap<>();
        Bracket bracket;
        boolean revealed;
        boolean settled;
    }

    final String code;
    final String hostId;
    final String quizName;
    /** whose quiz it is: picture references like ":handle" are theirs */
    String authorId;
    Long quizId;
    /** set once the finished game has been written to history */
    boolean recorded;
    Long recordId;
    final List<Step> steps;
    final Random random;
    final Map<String, Player> players = new LinkedHashMap<>();
    final Map<Long, QState> questions = new HashMap<>();

    Status status = Status.LOBBY;
    int index = -1;
    long endsAt;
    long pausedLeft;
    long pausedAt;
    long version;
    long touchedAt;

    public Game(String code, String hostId, String quizName, List<Step> steps, Random random, long now) {
        this.code = code;
        this.hostId = hostId;
        this.quizName = quizName;
        this.steps = List.copyOf(steps);
        this.random = random;
        this.touchedAt = now;
    }

    public String code() { return code; }
    public String hostId() { return hostId; }
    public Status status() { return status; }
    public long touchedAt() { return touchedAt; }

    // ─── people ────────────────────────────────────────────────────────

    public void addPlayer(String id, String name, String picture, long now) {
        Player existing = players.get(id);
        if (existing != null) {
            existing.name = name;
            existing.picture = picture;
        } else {
            if (players.size() >= MAX_PLAYERS) throw new IllegalStateException("This game is full");
            players.put(id, new Player(id, name, picture));
        }
        changed(now);
    }

    public void removePlayer(String id, long now) {
        if (players.remove(id) != null) changed(now);
    }

    // ─── flow ──────────────────────────────────────────────────────────

    public void start(long now) {
        if (status == Status.PLAYING || status == Status.PAUSED) {
            throw new IllegalStateException("The game is already running");
        }
        questions.clear();
        players.values().forEach(p -> { p.score = 0; p.gain = 0; });
        recorded = false;
        recordId = null;
        status = Status.PLAYING;
        if (steps.isEmpty()) {
            finish(now);
            return;
        }
        enter(0, now);
    }

    /** Back to the lobby with everyone still in it, ready to play again. */
    public void restart(long now) {
        questions.clear();
        players.values().forEach(p -> { p.score = 0; p.gain = 0; });
        recorded = false;
        recordId = null;
        status = Status.LOBBY;
        index = -1;
        endsAt = 0;
        changed(now);
    }

    public void pause(long now) {
        if (status != Status.PLAYING) throw new IllegalStateException("Nothing to pause");
        status = Status.PAUSED;
        pausedAt = now;
        pausedLeft = Math.max(0, endsAt - now);
        changed(now);
    }

    public void resume(long now) {
        if (status != Status.PAUSED) throw new IllegalStateException("Not paused");
        long away = now - pausedAt;
        endsAt += away;
        Bracket b = currentBracket();
        if (b != null && !b.done) b.roundEndsAt += away;
        status = Status.PLAYING;
        changed(now);
    }

    /** Straight to the next step. */
    public void skip(long now) {
        if (status == Status.PAUSED) resume(now);
        if (status != Status.PLAYING) throw new IllegalStateException("The game is not running");
        advance(now);
    }

    public void end(long now) {
        if (status == Status.LOBBY) throw new IllegalStateException("The game has not started");
        finish(now);
    }

    /** Whatever is due at {@code now}: the end of a knockout round, the end of the step. */
    public void tick(long now) {
        if (status != Status.PLAYING) return;
        Bracket b = currentBracket();
        if (b != null && !b.done && b.roundEndsAt > 0 && now >= b.roundEndsAt && now < endsAt) {
            advanceRound(b, now);
            changed(now);
        }
        if (now >= endsAt) advance(now);
    }

    /** When {@link #tick} next has something to do, or 0 when nothing is scheduled. */
    public long nextDeadline() {
        if (status != Status.PLAYING) return 0;
        long next = endsAt;
        Bracket b = currentBracket();
        if (b != null && !b.done && b.roundEndsAt > 0) next = Math.min(next, b.roundEndsAt);
        return next;
    }

    private void enter(int k, long now) {
        index = k;
        Step step = steps.get(k);
        endsAt = now + Math.max(1, step.seconds()) * 1000L;
        QuestionSnap q = step.question();
        if (q != null) {
            Phase phase = step.phase();
            if (phase == Phase.ANSWER || phase == Phase.ELABORATION || phase == Phase.RESULT) {
                reveal(q);
            }
            if (phase == Phase.RESULT) settle(q);
            if (phase == Phase.ANSWER && q.type() == QuestionType.KNOCKOUT_BATTLE) {
                startBracket(q, step.seconds(), now);
            }
        }
        changed(now);
    }

    private void advance(long now) {
        Step step = current();
        if (step != null && step.question() != null) {
            QuestionSnap q = step.question();
            Step next = index + 1 < steps.size() ? steps.get(index + 1) : null;
            boolean lastOfQuestion = next == null || next.question() == null || next.question().id() != q.id();
            if (step.phase() == Phase.QUESTION && lastOfQuestion) {
                reveal(q);
                settle(q);
            }
            if (step.phase() == Phase.ANSWER) settle(q);
        }
        if (index + 1 >= steps.size()) {
            finish(now);
        } else {
            enter(index + 1, now);
        }
    }

    private void finish(long now) {
        for (Step s : steps) {
            QuestionSnap q = s.question();
            if (q == null) continue;
            QState st = questions.get(q.id());
            if (st == null) continue;
            reveal(q);
            settle(q);
        }
        status = Status.FINISHED;
        index = steps.size();
        endsAt = 0;
        changed(now);
    }

    private void changed(long now) {
        version++;
        touchedAt = now;
    }

    // ─── what players do ───────────────────────────────────────────────

    /**
     * An answer to the current question, replacing any earlier one.
     * {@code picks}: answer ids (choice questions); {@code text}: a written
     * answer; {@code tiers}: answer id to tier (tier lists).
     */
    public void submit(String userId, List<Long> picks, String text, Map<Long, String> tiers,
            long now, Predicate<String> online) {
        Step step = current();
        if (status != Status.PLAYING || step == null || step.phase() != Phase.QUESTION || step.question() == null) {
            throw new IllegalStateException("Answers are closed");
        }
        requirePlayer(userId);
        QuestionSnap q = step.question();
        QState st = state(q);
        switch (type(q)) {
            case PREWRITTEN_SINGLE -> {
                if (picks == null || picks.size() != 1 || !hasAnswer(q, picks.get(0))) {
                    throw new IllegalArgumentException("Pick one answer");
                }
                st.picks.put(userId, List.of(picks.get(0)));
            }
            case PREWRITTEN_MULTIPLE -> {
                if (picks == null || picks.isEmpty()) throw new IllegalArgumentException("Pick at least one answer");
                List<Long> valid = new ArrayList<>(new LinkedHashSet<>(picks));
                if (!valid.stream().allMatch(id -> hasAnswer(q, id))) {
                    throw new IllegalArgumentException("That is not one of the answers");
                }
                st.picks.put(userId, List.copyOf(valid));
            }
            case TIERLIST -> {
                if (tiers == null || tiers.isEmpty()) throw new IllegalArgumentException("Put something in a tier");
                Map<Long, String> clean = new LinkedHashMap<>();
                tiers.forEach((id, tier) -> {
                    if (id != null && hasAnswer(q, id) && tier != null && TIERS.contains(tier)) clean.put(id, tier);
                });
                if (clean.isEmpty()) throw new IllegalArgumentException("Put something in a tier");
                st.tiers.put(userId, clean);
            }
            default -> {
                String clean = text == null ? "" : text.strip();
                if (clean.isEmpty()) throw new IllegalArgumentException("Write something first");
                if (clean.length() > MAX_TEXT) clean = clean.substring(0, MAX_TEXT);
                st.texts.put(userId, clean);
            }
        }
        if (everyoneDid(answeredBy(st, q), online)) endsAt = Math.min(endsAt, now + EVERYONE_DONE_MS);
        changed(now);
    }

    /**
     * A vote during the ANSWER step. {@code choice}: the entry voted for
     * (write + vote, knockout with {@code match}); {@code guesses}: entry key
     * to the player guessed to have written it (who wrote it).
     */
    public void vote(String userId, String choice, Integer match, Map<String, String> guesses,
            long now, Predicate<String> online) {
        Step step = current();
        String interaction = interaction();
        if (status != Status.PLAYING || interaction == null || !List.of("vote", "guess", "bracket").contains(interaction)) {
            throw new IllegalStateException("Voting is closed");
        }
        requirePlayer(userId);
        QState st = state(step.question());
        switch (interaction) {
            case "vote" -> {
                Entry e = entry(st, choice);
                if (e == null) throw new IllegalArgumentException("That answer is not on the board");
                if (e.authorId.equals(userId)) throw new IllegalArgumentException("You can't vote for your own");
                st.votes.put(userId, e.key);
                if (everyoneDid(voters(st, st.votes.keySet()), online)) endsAt = Math.min(endsAt, now + EVERYONE_DONE_MS);
            }
            case "guess" -> {
                if (guesses == null || guesses.isEmpty()) throw new IllegalArgumentException("Guess at least one");
                Map<String, String> clean = new LinkedHashMap<>(st.guesses.getOrDefault(userId, Map.of()));
                guesses.forEach((key, author) -> {
                    Entry e = entry(st, key);
                    if (e != null && !e.authorId.equals(userId) && author != null && players.containsKey(author)) {
                        clean.put(key, author);
                    }
                });
                st.guesses.put(userId, clean);
                long othersEntries = st.entries.stream().filter(e -> !e.authorId.equals(userId)).count();
                Set<String> complete = new LinkedHashSet<>();
                st.guesses.forEach((voter, g) -> {
                    long mine = st.entries.stream().filter(e -> !e.authorId.equals(voter)).count();
                    if (g.size() >= mine) complete.add(voter);
                });
                if (clean.size() >= othersEntries && everyoneDid(voters(st, complete), online)) {
                    endsAt = Math.min(endsAt, now + EVERYONE_DONE_MS);
                }
            }
            default -> {
                Bracket b = st.bracket;
                Match m = b.matches.stream().filter(x -> match != null && x.id == match).findFirst().orElse(null);
                if (m == null || m.winner != null || m.b == null) throw new IllegalArgumentException("That battle is over");
                Entry e = choice != null && choice.equals(m.a.key) ? m.a : choice != null && choice.equals(m.b.key) ? m.b : null;
                if (e == null) throw new IllegalArgumentException("Pick one of the two");
                if (m.a.authorId.equals(userId) || m.b.authorId.equals(userId)) {
                    throw new IllegalArgumentException("You can't judge your own battle");
                }
                m.votes.put(userId, e.key);
            }
        }
        changed(now);
    }

    private static Set<String> voters(QState st, Set<String> who) {
        return new LinkedHashSet<>(who);
    }

    /** Has everyone still connected done it? Only players who are online count. */
    private boolean everyoneDid(Set<String> did, Predicate<String> online) {
        List<String> present = players.keySet().stream().filter(online).toList();
        return !present.isEmpty() && did.containsAll(present);
    }

    private Set<String> answeredBy(QState st, QuestionSnap q) {
        return switch (type(q)) {
            case PREWRITTEN_SINGLE, PREWRITTEN_MULTIPLE -> st.picks.keySet();
            case TIERLIST -> st.tiers.keySet();
            default -> st.texts.keySet();
        };
    }

    private void requirePlayer(String userId) {
        if (userId == null || !players.containsKey(userId)) throw new IllegalArgumentException("Join the game first");
    }

    // ─── reveal and score ──────────────────────────────────────────────

    private void reveal(QuestionSnap q) {
        QState st = state(q);
        if (st.revealed) return;
        st.revealed = true;
        QuestionType type = type(q);
        if (isWritten(type)) {
            List<Map.Entry<String, String>> written = new ArrayList<>(st.texts.entrySet());
            Collections.shuffle(written, random);
            List<Entry> entries = new ArrayList<>();
            for (int i = 0; i < written.size(); i++) {
                entries.add(new Entry("e" + (i + 1), written.get(i).getKey(), written.get(i).getValue()));
            }
            st.entries = entries;
        }
        if (!isVotedOn(type)) settle(q);
    }

    private void settle(QuestionSnap q) {
        QState st = state(q);
        if (st.settled) return;
        reveal(q);
        st.settled = true;
        Map<String, Integer> gains = st.gains;
        switch (type(q)) {
            case PREWRITTEN_SINGLE, PREWRITTEN_MULTIPLE -> st.picks.forEach((user, picked) -> {
                int sum = picked.stream().mapToInt(id -> valueOf(q, id)).sum();
                if (sum > 0) gains.merge(user, sum, Integer::sum);
            });
            case TIERLIST -> {
                st.consensus = consensus(q, st);
                st.tiers.forEach((user, placed) -> {
                    long agreed = placed.entrySet().stream()
                            .filter(e -> e.getValue().equals(st.consensus.get(e.getKey()))).count();
                    if (agreed > 0) gains.merge(user, (int) agreed * TIER_POINTS, Integer::sum);
                });
            }
            case USER_GENERATED_VOTE -> {
                st.votes.values().forEach(key -> {
                    Entry e = entry(st, key);
                    if (e != null) e.votes++;
                });
                st.entries.forEach(e -> {
                    if (e.votes > 0) gains.merge(e.authorId, e.votes * VOTE_POINTS, Integer::sum);
                });
            }
            case USER_GENERATED_IDENTIFY -> st.guesses.forEach((user, g) -> g.forEach((key, author) -> {
                Entry e = entry(st, key);
                if (e != null && e.authorId.equals(author)) {
                    e.votes++; // how many saw through it
                    gains.merge(user, GUESS_POINTS, Integer::sum);
                }
            }));
            case KNOCKOUT_BATTLE -> {
                if (st.bracket == null) startBracket(q, 0, 0);
                Bracket b = st.bracket;
                while (!b.done) advanceRound(b, 0);
                for (List<Match> round : b.history) {
                    for (Match m : round) {
                        if (m.b != null && m.winner != null) gains.merge(m.winner.authorId, BATTLE_POINTS, Integer::sum);
                    }
                }
                if (b.champion != null) gains.merge(b.champion.authorId, CHAMPION_POINTS, Integer::sum);
            }
            default -> { /* written answers on a wall: nothing to score */ }
        }
        if (q.weight() != 100) {
            gains.replaceAll((user, points) -> points * q.weight() / 100);
            gains.values().removeIf(points -> points == 0);
        }
        players.values().forEach(p -> {
            p.gain = gains.getOrDefault(p.id, 0);
            p.score += p.gain;
        });
    }

    private Map<Long, String> consensus(QuestionSnap q, QState st) {
        Map<Long, String> result = new LinkedHashMap<>();
        for (AnswerSnap a : q.answers()) {
            Map<String, Integer> counts = new HashMap<>();
            st.tiers.values().forEach(placed -> {
                String tier = placed.get(a.id());
                if (tier != null) counts.merge(tier, 1, Integer::sum);
            });
            if (counts.isEmpty()) continue;
            int most = Collections.max(counts.values());
            // a tie goes to the higher tier
            TIERS.stream().filter(t -> counts.getOrDefault(t, 0) == most).findFirst()
                    .ifPresent(t -> result.put(a.id(), t));
        }
        return result;
    }

    // ─── knockout ──────────────────────────────────────────────────────

    private void startBracket(QuestionSnap q, int seconds, long now) {
        QState st = state(q);
        if (st.bracket != null) return;
        Bracket b = new Bracket();
        st.bracket = b;
        List<Entry> entries = st.entries;
        if (entries.size() < 2) {
            b.champion = entries.isEmpty() ? null : entries.get(0);
            b.done = true;
            return;
        }
        b.rounds = (int) Math.ceil(Math.log(entries.size()) / Math.log(2));
        b.roundMs = Math.max(4000, seconds * 1000L / b.rounds);
        b.round = 1;
        b.matches = pair(b, entries);
        b.roundEndsAt = now > 0 ? now + b.roundMs : 0;
    }

    private List<Match> pair(Bracket b, List<Entry> entries) {
        List<Match> matches = new ArrayList<>();
        for (int i = 0; i < entries.size(); i += 2) {
            Entry a = entries.get(i);
            Entry c = i + 1 < entries.size() ? entries.get(i + 1) : null;
            matches.add(new Match(b.nextMatchId++, a, c));
        }
        return matches;
    }

    private void advanceRound(Bracket b, long now) {
        List<Entry> winners = new ArrayList<>();
        for (Match m : b.matches) {
            if (m.winner == null) {
                if (m.b == null) {
                    m.winner = m.a;
                } else {
                    long forA = m.votes.values().stream().filter(k -> k.equals(m.a.key)).count();
                    long forB = m.votes.size() - forA;
                    m.winner = forA > forB ? m.a : forB > forA ? m.b : (random.nextBoolean() ? m.a : m.b);
                }
            }
            winners.add(m.winner);
        }
        b.history.add(b.matches);
        if (winners.size() <= 1) {
            b.champion = winners.isEmpty() ? null : winners.get(0);
            b.matches = List.of();
            b.done = true;
            b.roundEndsAt = 0;
            return;
        }
        b.round++;
        b.matches = pair(b, winners);
        b.roundEndsAt = now > 0 ? Math.min(now + b.roundMs, endsAt) : 0;
    }

    // ─── reading it ────────────────────────────────────────────────────

    Step current() {
        return index >= 0 && index < steps.size() ? steps.get(index) : null;
    }

    private Bracket currentBracket() {
        Step s = current();
        if (s == null || s.phase() != Phase.ANSWER || s.question() == null) return null;
        QState st = questions.get(s.question().id());
        return st == null ? null : st.bracket;
    }

    /** What players can do right now: answer, vote, guess, bracket, or nothing. */
    String interaction() {
        Step s = current();
        if (status != Status.PLAYING && status != Status.PAUSED) return null;
        if (s == null || s.question() == null) return null;
        if (s.phase() == Phase.QUESTION) return "answer";
        if (s.phase() != Phase.ANSWER) return null;
        QState st = questions.get(s.question().id());
        if (st == null || st.settled) return null;
        return switch (type(s.question())) {
            case USER_GENERATED_VOTE -> st.entries.size() >= 2 ? "vote" : null;
            case USER_GENERATED_IDENTIFY -> st.entries.size() >= 1 && players.size() >= 2 ? "guess" : null;
            case KNOCKOUT_BATTLE -> st.bracket != null && !st.bracket.done ? "bracket" : null;
            default -> null;
        };
    }

    /** The whole state as the screens see it. Nothing secret before it is revealed. */
    public Map<String, Object> view(long now, Predicate<String> online) {
        Map<String, Object> v = new LinkedHashMap<>();
        v.put("code", code);
        v.put("hostId", hostId);
        v.put("quizName", quizName);
        v.put("authorId", authorId);
        v.put("recordId", recordId);
        v.put("status", status.name());
        v.put("version", version);
        v.put("now", now);
        v.put("index", index);
        v.put("total", steps.size());

        List<Long> order = questionOrder();
        v.put("questionCount", order.size());

        Step step = current();
        if (step != null) {
            v.put("phase", step.phase().name());
            v.put("seconds", step.seconds());
            v.put("endsAt", status == Status.PAUSED ? null : endsAt);
            v.put("pausedLeft", status == Status.PAUSED ? pausedLeft : null);
            QuestionSnap q = step.question();
            if (q != null) {
                QState st = questions.get(q.id());
                boolean revealed = st != null && st.revealed;
                boolean showElaboration = step.phase() == Phase.ELABORATION || step.phase() == Phase.RESULT || revealed;
                v.put("questionNumber", order.indexOf(q.id()) + 1);
                v.put("question", questionView(q, revealed, showElaboration));
                if (step.phase() == Phase.QUESTION) {
                    v.put("answered", st == null ? List.of() : List.copyOf(answeredBy(st, q)));
                }
                if (revealed) v.put("reveal", revealView(q, st, now));
            }
        }
        String interaction = interaction();
        v.put("interaction", interaction);
        if ("vote".equals(interaction) || "guess".equals(interaction) || "bracket".equals(interaction)) {
            QState st = questions.get(step.question().id());
            Set<String> acted = switch (interaction) {
                case "vote" -> st.votes.keySet();
                case "guess" -> st.guesses.keySet();
                default -> {
                    Set<String> s = new LinkedHashSet<>();
                    st.bracket.matches.forEach(m -> s.addAll(m.votes.keySet()));
                    yield s;
                }
            };
            v.put("acted", List.copyOf(acted));
        }
        v.put("players", playersView(online));
        return v;
    }

    private List<Long> questionOrder() {
        List<Long> order = new ArrayList<>();
        for (Step s : steps) {
            if (s.question() != null && !order.contains(s.question().id())) order.add(s.question().id());
        }
        return order;
    }

    private Map<String, Object> questionView(QuestionSnap q, boolean revealed, boolean showElaboration) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", q.id());
        m.put("text", q.text());
        m.put("imageUrl", q.imageUrl());
        m.put("type", type(q).name());
        if (q.weight() != 100) m.put("weight", q.weight());
        List<Map<String, Object>> answers = new ArrayList<>();
        for (AnswerSnap a : q.answers()) {
            Map<String, Object> am = new LinkedHashMap<>();
            am.put("id", a.id());
            am.put("text", a.text());
            am.put("imageUrl", a.imageUrl());
            if (revealed) am.put("value", a.value());
            answers.add(am);
        }
        // written questions have no answers to show; choices and tier items do
        m.put("answers", isWritten(type(q)) ? List.of() : answers);
        if (showElaboration) {
            m.put("elaborationText", q.elaborationText());
            m.put("elaborationImageUrl", q.elaborationImageUrl());
        }
        return m;
    }

    private Map<String, Object> revealView(QuestionSnap q, QState st, long now) {
        Map<String, Object> r = new LinkedHashMap<>();
        QuestionType type = type(q);
        r.put("settled", st.settled);
        switch (type) {
            case PREWRITTEN_SINGLE, PREWRITTEN_MULTIPLE -> {
                Map<Long, Integer> counts = new LinkedHashMap<>();
                q.answers().forEach(a -> counts.put(a.id(), 0));
                st.picks.values().forEach(p -> p.forEach(id -> counts.merge(id, 1, Integer::sum)));
                r.put("counts", counts);
                r.put("correct", q.answers().stream().filter(a -> a.value() > 0).map(AnswerSnap::id).toList());
            }
            case TIERLIST -> {
                Map<Long, Map<String, Integer>> counts = new LinkedHashMap<>();
                q.answers().forEach(a -> {
                    Map<String, Integer> c = new LinkedHashMap<>();
                    TIERS.forEach(t -> c.put(t, 0));
                    counts.put(a.id(), c);
                });
                st.tiers.values().forEach(placed -> placed.forEach((id, tier) -> {
                    Map<String, Integer> c = counts.get(id);
                    if (c != null) c.merge(tier, 1, Integer::sum);
                }));
                r.put("tierCounts", counts);
                r.put("consensus", st.consensus);
            }
            default -> { /* written: entries below */ }
        }
        if (isWritten(type)) {
            // who wrote what stays hidden while players are voting or guessing on it
            boolean showAuthors = type == QuestionType.USER_GENERATED || st.settled;
            List<Map<String, Object>> entries = new ArrayList<>();
            for (Entry e : st.entries) {
                Map<String, Object> em = new LinkedHashMap<>();
                em.put("key", e.key);
                em.put("text", e.text);
                if (showAuthors) {
                    em.put("authorId", e.authorId);
                    em.put("votes", e.votes);
                }
                entries.add(em);
            }
            r.put("entries", entries);
            if (type == QuestionType.USER_GENERATED_IDENTIFY) {
                r.put("authors", st.entries.stream().map(e -> e.authorId).distinct().toList());
            }
            if (type == QuestionType.KNOCKOUT_BATTLE && st.bracket != null) r.put("bracket", bracketView(st.bracket));
        }
        if (st.settled) r.put("gains", st.gains);
        return r;
    }

    private Map<String, Object> bracketView(Bracket b) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("round", b.round);
        m.put("rounds", b.rounds);
        m.put("roundEndsAt", b.done ? null : b.roundEndsAt);
        m.put("done", b.done);
        m.put("matches", b.matches.stream().map(x -> matchView(x, false)).toList());
        m.put("history", b.history.stream().map(r -> r.stream().map(x -> matchView(x, true)).toList()).toList());
        if (b.champion != null) {
            m.put("champion", Map.of("key", b.champion.key, "text", b.champion.text, "authorId", b.champion.authorId));
        }
        return m;
    }

    private Map<String, Object> matchView(Match x, boolean resolved) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", x.id);
        m.put("a", Map.of("key", x.a.key, "text", x.a.text));
        m.put("b", x.b == null ? null : Map.of("key", x.b.key, "text", x.b.text));
        if (resolved) {
            long forA = x.votes.values().stream().filter(k -> k.equals(x.a.key)).count();
            m.put("votesA", forA);
            m.put("votesB", x.votes.size() - forA);
            m.put("winner", x.winner == null ? null : x.winner.key);
            m.put("authorA", x.a.authorId);
            m.put("authorB", x.b == null ? null : x.b.authorId);
        }
        return m;
    }

    private List<Map<String, Object>> playersView(Predicate<String> online) {
        List<Player> sorted = new ArrayList<>(players.values());
        sorted.sort(Comparator.comparingInt((Player p) -> -p.score));
        List<Map<String, Object>> out = new ArrayList<>();
        int rank = 0;
        Integer last = null;
        for (int i = 0; i < sorted.size(); i++) {
            Player p = sorted.get(i);
            if (last == null || p.score != last) rank = i + 1;
            last = p.score;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", p.id);
            m.put("name", p.name);
            m.put("picture", p.picture);
            m.put("score", p.score);
            m.put("gain", p.gain);
            m.put("rank", rank);
            m.put("online", online.test(p.id));
            out.add(m);
        }
        return out;
    }

    // ─── small helpers ─────────────────────────────────────────────────

    /**
     * What happened on a question, for the history: how many picked each
     * answer (by position), the group's tiers, what was written and by whom,
     * and who scored. Empty if the game never got to it.
     */
    Map<String, Object> results(QuestionSnap q) {
        Map<String, Object> r = new LinkedHashMap<>();
        QState st = questions.get(q.id());
        if (st == null) return r;
        QuestionType type = type(q);
        switch (type) {
            case PREWRITTEN_SINGLE, PREWRITTEN_MULTIPLE -> {
                List<Integer> counts = new ArrayList<>();
                for (AnswerSnap a : q.answers()) {
                    counts.add((int) st.picks.values().stream().filter(p -> p.contains(a.id())).count());
                }
                r.put("counts", counts);
            }
            case TIERLIST -> {
                List<String> tiers = new ArrayList<>();
                for (AnswerSnap a : q.answers()) tiers.add(st.consensus.get(a.id()));
                r.put("tiers", tiers);
            }
            default -> { /* written: entries below */ }
        }
        if (isWritten(type)) {
            List<Map<String, Object>> entries = new ArrayList<>();
            for (Entry e : st.entries) {
                Map<String, Object> em = new LinkedHashMap<>();
                em.put("text", e.text);
                em.put("by", nameOf(e.authorId));
                em.put("votes", e.votes);
                entries.add(em);
            }
            r.put("entries", entries);
            if (st.bracket != null && st.bracket.champion != null) {
                r.put("champion", Map.of("text", st.bracket.champion.text, "by", nameOf(st.bracket.champion.authorId)));
            }
        }
        if (!st.gains.isEmpty()) r.put("gains", new LinkedHashMap<>(st.gains));
        return r;
    }

    private String nameOf(String userId) {
        Player p = players.get(userId);
        return p == null ? "someone who left" : p.name;
    }

    private QState state(QuestionSnap q) {
        return questions.computeIfAbsent(q.id(), k -> new QState());
    }

    static QuestionType type(QuestionSnap q) {
        return q.type() == null ? QuestionType.PREWRITTEN_SINGLE : q.type();
    }

    static boolean isWritten(QuestionType t) {
        return t == QuestionType.USER_GENERATED || t == QuestionType.USER_GENERATED_VOTE
                || t == QuestionType.USER_GENERATED_IDENTIFY || t == QuestionType.KNOCKOUT_BATTLE;
    }

    static boolean isVotedOn(QuestionType t) {
        return t == QuestionType.USER_GENERATED_VOTE || t == QuestionType.USER_GENERATED_IDENTIFY
                || t == QuestionType.KNOCKOUT_BATTLE;
    }

    private static boolean hasAnswer(QuestionSnap q, Long id) {
        return id != null && q.answers().stream().anyMatch(a -> a.id() == id);
    }

    private static int valueOf(QuestionSnap q, long id) {
        return q.answers().stream().filter(a -> a.id() == id).mapToInt(AnswerSnap::value).findFirst().orElse(0);
    }

    private static Entry entry(QState st, String key) {
        if (key == null) return null;
        return st.entries.stream().filter(e -> e.key.equals(key)).findFirst().orElse(null);
    }
}
