package com.lonezsi.jqzz.game;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.function.Predicate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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
    /** one drawing, as the drawing frame exports it */
    public static final int MAX_ART_BYTES = 1_500_000;
    /** every drawing of a game together, so one game can't fill the server */
    public static final long MAX_GAME_ART_BYTES = 160_000_000L;
    /** what a "crowd" number question is worth when its answers don't say */
    public static final int CROWD_NUMBER_POINTS = 1000;
    /** different entries one player can vote for on one question, at most */
    public static final int MOST_PICKS = 10;
    /** "overflow: on": the most options one player sees */
    public static final int OVERFLOW_DEFAULT = 6;
    /** in a prompt: the winning answer of the question labelled so */
    private static final Pattern WINNER = Pattern.compile("\\{@([a-z0-9-]+)\\.winner\\}");
    /** in a prompt: a winner, or who made and what was the answer this player was dealt */
    private static final Pattern FILL = Pattern.compile("\\{@([a-z0-9-]+)\\.winner\\}|\\{(author|answer)\\}", Pattern.CASE_INSENSITIVE);

    public enum Status { LOBBY, PLAYING, PAUSED, FINISHED }

    /** match: the other half of a pair (MATCH questions) */
    public record AnswerSnap(long id, String text, String imageUrl, int value, String match) {
        public AnswerSnap(long id, String text, String imageUrl, int value) {
            this(id, text, imageUrl, value, null);
        }
    }

    /**
     * weight: points it gives, in percent. 100 normally, 0 when not graded, 200 for double.
     * options: what it needs besides answers ("unit" to "m"). speed: answering sooner counts.
     * mode: what players do and how it scores; type is only the stored name, for records.
     */
    public record QuestionSnap(long id, String text, String imageUrl, QuestionType type,
            String elaborationText, String elaborationImageUrl, List<AnswerSnap> answers, int weight,
            Map<String, String> options, boolean speed, Mode mode) {
        public QuestionSnap {
            options = options == null ? Map.of() : Map.copyOf(options);
            if (mode == null) mode = Mode.of(type);
        }

        public QuestionSnap(long id, String text, String imageUrl, QuestionType type,
                String elaborationText, String elaborationImageUrl, List<AnswerSnap> answers, int weight,
                Map<String, String> options, boolean speed) {
            this(id, text, imageUrl, type, elaborationText, elaborationImageUrl, answers, weight, options, speed, null);
        }

        public QuestionSnap(long id, String text, String imageUrl, QuestionType type,
                String elaborationText, String elaborationImageUrl, List<AnswerSnap> answers, int weight) {
            this(id, text, imageUrl, type, elaborationText, elaborationImageUrl, answers, weight, Map.of(), false);
        }

        public QuestionSnap(long id, String text, String imageUrl, QuestionType type,
                String elaborationText, String elaborationImageUrl, List<AnswerSnap> answers) {
            this(id, text, imageUrl, type, elaborationText, elaborationImageUrl, answers, 100);
        }

        /** a number option ("min", "max", "rounds"), or null */
        Double number(String key) {
            return Fuzzy.number(options.get(key));
        }

        /** its hidden label, when another question uses it */
        String ref() {
            return options.get("ref");
        }

        /** the label of the question it takes from, or null */
        String from() {
            String f = options.get("from");
            return f == null || f.isBlank() ? null : f.trim();
        }

        /** how many different ones each player may vote for, 1 to MOST_PICKS */
        int picks() {
            Double p = number("picks");
            return p == null ? 1 : (int) Math.max(1, Math.min(MOST_PICKS, Math.round(p)));
        }

        /** the most options one player sees, or 0: everyone sees them all */
        int overflow() {
            String o = options.get("overflow");
            if (o == null) return 0;
            if (List.of("on", "yes", "true").contains(o.trim().toLowerCase(Locale.ROOT))) return OVERFLOW_DEFAULT;
            Double n = Fuzzy.number(o);
            return n == null || n < 2 ? 0 : (int) Math.min(20, Math.round(n));
        }
    }

    /** a drawing, kept while the game lasts and served by its id */
    public record Art(byte[] bytes, String contentType) {}

    /** open: someone new can still join while this step plays (the "latejoin" setting) */
    public record Step(Phase phase, int seconds, QuestionSnap question, boolean open) {
        public Step(Phase phase, int seconds, QuestionSnap question) {
            this(phase, seconds, question, true);
        }
    }

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

    /** something a player made, on the board: written (text) or drawn (image, an art id) */
    static final class Entry {
        final String key;
        final String authorId;
        final String text;
        final String image;
        int votes;
        /** made about an earlier entry (write or draw with from): that entry, and the question it was made in */
        Entry about;
        long aboutFrom;
        /** ballots: how many times it was on the ballot of someone who voted that round */
        int shown;

        Entry(String key, String authorId, String text) {
            this(key, authorId, text, null);
        }

        Entry(String key, String authorId, String text, String image) {
            this.key = key;
            this.authorId = authorId;
            this.text = text;
            this.image = image;
        }

        /** the same entry under a new key, for a pick that borrows it; votes start again */
        Entry copy(String newKey) {
            Entry e = new Entry(newKey, authorId, text, image);
            e.about = about;
            e.aboutFrom = aboutFrom;
            return e;
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
        /** answer ids: the one picked, the ones picked, or all of them in the player's order (ORDER) */
        final Map<String, List<Long>> picks = new LinkedHashMap<>();
        final Map<String, String> texts = new LinkedHashMap<>();
        final Map<String, Map<Long, String>> tiers = new LinkedHashMap<>();
        /** MATCH: answer id to the key of the other half it was paired with */
        final Map<String, Map<Long, String>> pairs = new LinkedHashMap<>();
        final Map<String, Double> numbers = new LinkedHashMap<>();
        /** player to the art id of their drawing */
        final Map<String, String> drawings = new LinkedHashMap<>();
        /** DRAW_GUESS: player to the answer id of their secret word */
        final Map<String, Long> secrets = new LinkedHashMap<>();
        /** share of the time still left when they answered, for "speed" */
        final Map<String, Double> left = new HashMap<>();
        /**
         * voter to the entry keys they voted for: one, or up to picks; on a pick
         * with ballots, the votes are kept per round in {@code ballots}
         */
        final Map<String, List<String>> votes = new LinkedHashMap<>();
        final Map<String, Map<String, String>> guesses = new LinkedHashMap<>();
        List<Entry> entries = List.of();
        Map<Long, String> consensus = Map.of();
        /** POLL: the most picked options */
        List<Long> top = List.of();
        /** ORDER: the items as shown, shuffled once */
        List<Long> shown;
        /** MATCH: each answer's other half under a key that doesn't give the pair away */
        Map<Long, String> rightKey;
        List<String> rightShown;
        final Map<String, Integer> gains = new HashMap<>();
        Bracket bracket;
        Telephone telephone;
        boolean revealed;
        boolean settled;
        /** a pick that borrows: who sees what, round by round; null when everyone sees all but their own (the board is shared) */
        Ballots ballots;
        /** a pick that borrows: the source's entries are copied in; the vote has been opened */
        boolean borrowed;
        boolean opened;
        /** write or draw with from: the source entry each player makes something about */
        final Map<String, Entry> dealt = new LinkedHashMap<>();
        /** person: who each player named */
        final Map<String, String> named = new LinkedHashMap<>();
        /** anything voted on, or a knockout: the top entry once settled, a tie broken once at random */
        String winner;
        /** the entries that tied for the top before the coin flip; empty without a tie */
        List<String> tied = List.of();
        /** scored, but its points wait for a later person question so they don't give its answer away */
        boolean held;
        /** person + right: points paid with it from the questions it was keeping secret */
        final Map<String, Integer> released = new LinkedHashMap<>();
    }

    final String code;
    final String hostId;
    final String quizName;
    /** whose quiz it is: picture references like ":handle" are theirs */
    String authorId;
    Long quizId;
    /** set once the finished game has been written to history */
    boolean recorded;
    /** taken out by the host: they can't join this game again */
    final Set<String> kicked = new LinkedHashSet<>();
    /** everyone who was ever in: they can always come back, even once the doors close */
    final Set<String> joinedOnce = new LinkedHashSet<>();
    /** when the host's screen went away (0: it's here) */
    long hostAwaySince;
    /** paused because the host's screen went away, not by the host */
    boolean pausedForHost;
    Long recordId;
    final List<Step> steps;
    final Random random;
    final Map<String, Player> players = new LinkedHashMap<>();
    final Map<Long, QState> questions = new HashMap<>();
    /** every drawing in the game by its id; the ids are random, so a link to one gives nothing else away */
    final Map<String, Art> art = new HashMap<>();
    long artBytes;
    /** done with this step and waiting on the host to move on; empties every step */
    final Set<String> hurry = new LinkedHashSet<>();

    Status status = Status.LOBBY;
    int index = -1;
    long endsAt;
    long pausedLeft;
    long pausedAt;
    long version;
    /** what the game's topic last carried, so the next message can be just what changed */
    final Object sendLock = new Object();
    Map<String, Object> lastSent;
    long touchedAt;

    /** who's coming (the quiz's Roster line): players join as one of these names; empty: anyone, as themselves */
    List<String> roster = List.of();
    /** two players can't be the same roster name */
    boolean uniqueNames = true;
    /** everyone who's played since the game started, with the name they had here: who a person question lists, whose answer {author} is */
    final Map<String, String> played = new LinkedHashMap<>();
    /** who's at the game right now; the engine sets it, a test leaves everyone here */
    Predicate<String> here = id -> true;
    /** each distinct question of the steps, by id */
    final Map<Long, QuestionSnap> snaps = new LinkedHashMap<>();
    /** question id -> the question it takes from (its from=, resolved once) */
    final Map<Long, QuestionSnap> sources = new HashMap<>();
    /** question id -> label -> the question its {@label.winner} fills from */
    final Map<Long, Map<String, QuestionSnap>> winnerRefs = new HashMap<>();
    /** person + right question id -> the questions whose makers it asks about: its source, and that one's source while it only borrows */
    final Map<Long, Set<Long>> guards = new LinkedHashMap<>();
    /** finish() is settling everything: nothing is kept back any more */
    boolean finishing;

    public Game(String code, String hostId, String quizName, List<Step> steps, Random random, long now) {
        this.code = code;
        this.hostId = hostId;
        this.quizName = quizName;
        this.steps = List.copyOf(steps);
        this.random = random;
        this.touchedAt = now;
        link();
    }

    /** resolves every from= and {@label.winner} once, by the hidden labels (nearest earlier first) */
    private void link() {
        for (Step s : steps) {
            if (s.question() != null) snaps.putIfAbsent(s.question().id(), s.question());
        }
        List<QuestionSnap> order = new ArrayList<>(snaps.values());
        for (int i = 0; i < order.size(); i++) {
            QuestionSnap q = order.get(i);
            QuestionSnap source = resolve(order, i, q.from());
            if (source != null) sources.put(q.id(), source);
            for (String text : new String[] { q.text(), q.elaborationText() }) {
                if (text == null) continue;
                Matcher m = WINNER.matcher(text);
                while (m.find()) {
                    QuestionSnap filled = resolve(order, i, m.group(1));
                    if (filled != null) winnerRefs.computeIfAbsent(q.id(), k -> new LinkedHashMap<>()).put(m.group(1), filled);
                }
            }
        }
        for (QuestionSnap q : order) {
            if (q.mode().ask() != Mode.Ask.PERSON || q.mode().score() != Mode.Score.RIGHT) continue;
            Set<Long> chain = new LinkedHashSet<>();
            QuestionSnap prev = null;
            QuestionSnap s = sources.get(q.id());
            while (s != null && !chain.contains(s.id()) && (prev == null || borrows(prev))) {
                chain.add(s.id());
                prev = s;
                s = sources.get(s.id());
            }
            if (!chain.isEmpty()) guards.put(q.id(), chain);
        }
    }

    /** the question a label points at from position i: the nearest earlier one with it, else the first; never itself */
    private static QuestionSnap resolve(List<QuestionSnap> order, int i, String label) {
        if (label == null || label.isBlank()) return null;
        for (int j = i - 1; j >= 0; j--) {
            if (label.equals(order.get(j).ref())) return order.get(j);
        }
        for (int j = 0; j < order.size(); j++) {
            if (j != i && label.equals(order.get(j).ref())) return order.get(j);
        }
        return null;
    }

    public String code() { return code; }
    public String hostId() { return hostId; }
    public Status status() { return status; }
    public long touchedAt() { return touchedAt; }

    // ─── people ────────────────────────────────────────────────────────

    public void addPlayer(String id, String name, String picture, long now) {
        addPlayer(id, name, picture, null, now);
    }

    /** as: the roster name they picked, in a game whose quiz has a roster; null keeps the one they have */
    public void addPlayer(String id, String accountName, String picture, String as, long now) {
        if (kicked.contains(id)) throw new IllegalStateException("The host took you out of this game");
        Player existing = players.get(id);
        if (roster.isEmpty()) {
            if (existing != null) {
                existing.name = accountName;
                existing.picture = picture;
            } else {
                if (players.size() >= MAX_PLAYERS) throw new IllegalStateException("This game is full");
                if (!joinedOnce.contains(id) && !open()) {
                    throw new IllegalStateException("This game has started and isn't taking new players");
                }
                players.put(id, new Player(id, accountName, picture));
                joinedOnce.add(id);
            }
        } else {
            boolean asked = as != null && !as.isBlank();
            String wanted = asked ? onRoster(as) : null; // the list's own spelling
            if (asked && wanted == null) throw new IllegalArgumentException("That name isn't on the list");
            if (existing != null) {
                existing.picture = picture; // a roster name is never swapped for the account's
                if (wanted != null && !nameKey(wanted).equals(nameKey(existing.name))) {
                    if (status != Status.LOBBY) throw new IllegalStateException("You can only change who you are before the game starts");
                    claim(wanted, id);
                    existing.name = wanted;
                }
            } else {
                if (players.size() >= MAX_PLAYERS) throw new IllegalStateException("This game is full");
                if (wanted == null) throw new IllegalArgumentException("Pick who you are");
                claim(wanted, id);
                // the list is the guest list: a name on it gets in even once the doors close
                players.put(id, new Player(id, wanted, picture));
                joinedOnce.add(id);
            }
        }
        if (status != Status.LOBBY) played.put(id, players.get(id).name);
        changed(now);
    }

    /** the roster's spelling of a name, or null when it isn't on it */
    private String onRoster(String name) {
        String key = nameKey(name);
        return roster.stream().filter(r -> nameKey(r).equals(key)).findFirst().orElse(null);
    }

    /** unique names: nobody else here already has it */
    private void claim(String wanted, String id) {
        if (uniqueNames && players.values().stream().anyMatch(p -> !p.id.equals(id) && nameKey(p.name).equals(nameKey(wanted)))) {
            throw new IllegalArgumentException(wanted + " is already here");
        }
    }

    public void removePlayer(String id, long now) {
        hurry.remove(id);
        if (players.remove(id) != null) changed(now);
    }

    // ─── while they wait ───────────────────────────────────────────────

    /** A player is done with this step and nudges the host to move on. Once per step. */
    public void hurry(String id, long now) {
        if (!players.containsKey(id)) throw new IllegalStateException("You're not in this game");
        if (status != Status.PLAYING && status != Status.PAUSED) throw new IllegalStateException("The game is not running");
        if (hurry.add(id)) changed(now);
    }

    /** Out, and can't come back to this game. */
    public void kick(String id, long now) {
        kicked.add(id);
        removePlayer(id, now);
    }

    // ─── flow ──────────────────────────────────────────────────────────

    public void start(long now) {
        if (status == Status.PLAYING || status == Status.PAUSED) {
            throw new IllegalStateException("The game is already running");
        }
        forgetAnswers();
        players.values().forEach(p -> { p.score = 0; p.gain = 0; });
        played.clear();
        players.values().forEach(p -> played.put(p.id, p.name));
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
        forgetAnswers();
        players.values().forEach(p -> { p.score = 0; p.gain = 0; });
        recorded = false;
        recordId = null;
        status = Status.LOBBY;
        index = -1;
        endsAt = 0;
        hurry.clear();
        changed(now);
    }

    private void forgetAnswers() {
        questions.clear();
        art.clear();
        artBytes = 0;
        finishing = false;
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
        pausedForHost = false;
        long away = now - pausedAt;
        endsAt += away;
        Bracket b = currentBracket();
        if (b != null && !b.done) b.roundEndsAt += away;
        Telephone t = currentTelephone();
        if (t != null && !t.done) t.roundEndsAt += away;
        Ballots bb = currentBallots();
        if (bb != null && !bb.done && bb.roundEndsAt > 0) bb.roundEndsAt += away;
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
        Telephone t = currentTelephone();
        if (t != null && !t.done && t.roundEndsAt > 0 && now >= t.roundEndsAt && now < endsAt) {
            if (!t.next(now, endsAt)) {
                advance(now); // that was the last round: on to the reveal
                return;
            }
            changed(now);
        }
        Ballots bb = currentBallots();
        if (bb != null && !bb.done && bb.roundEndsAt > 0 && now >= bb.roundEndsAt && now < endsAt) {
            bb.next(now, endsAt);
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
        Telephone t = currentTelephone();
        if (t != null && !t.done && t.roundEndsAt > 0) next = Math.min(next, t.roundEndsAt);
        Ballots bb = currentBallots();
        if (bb != null && !bb.done && bb.roundEndsAt > 0) next = Math.min(next, bb.roundEndsAt);
        return next;
    }

    private void enter(int k, long now) {
        index = k;
        hurry.clear();
        Step step = steps.get(k);
        endsAt = now + Math.max(1, step.seconds()) * 1000L;
        QuestionSnap q = step.question();
        if (q != null) {
            prepareSources(q);
            Phase phase = step.phase();
            if (phase == Phase.ANSWER || phase == Phase.ELABORATION || phase == Phase.RESULT) {
                reveal(q);
            }
            if (phase == Phase.RESULT) settle(q);
            if (phase == Phase.ANSWER && q.mode().score() == Mode.Score.KNOCKOUT) {
                startBracket(q, step.seconds(), now);
            }
            if (phase == Phase.QUESTION && q.mode().score() == Mode.Score.SECRET) {
                QState st = state(q);
                players.keySet().forEach(p -> secret(q, st, p));
            }
            if (phase == Phase.QUESTION && borrows(q)) openVote(q, state(q), step.seconds(), now);
            if (phase == Phase.QUESTION && dealsPairs(q)) dealPairs(q, state(q));
            if (phase == Phase.QUESTION && q.mode().ask() == Mode.Ask.CHAIN) {
                QState st = state(q);
                if (st.telephone == null && !st.revealed) {
                    Double rounds = q.number("rounds");
                    List<String> who = new ArrayList<>(players.keySet());
                    Collections.shuffle(who, random);
                    st.telephone = new Telephone(who, rounds == null ? 0 : rounds.intValue(),
                            Math.max(1, step.seconds()) * 1000L, now);
                }
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
        finishing = true;
        for (Step s : steps) {
            QuestionSnap q = s.question();
            if (q == null) continue;
            QState st = questions.get(q.id());
            if (st == null) continue;
            reveal(q);
            settle(q);
        }
        // the person question that kept these back never came: they're paid now
        for (QState st : questions.values()) {
            if (!st.held) continue;
            st.held = false;
            st.gains.forEach((u, pts) -> {
                Player p = players.get(u);
                if (p == null) return;
                p.score += pts;
                p.gain += pts;
            });
        }
        status = Status.FINISHED;
        index = steps.size();
        hurry.clear();
        endsAt = 0;
        changed(now);
    }

    private void changed(long now) {
        version++;
        touchedAt = now;
    }

    // ─── what players do ───────────────────────────────────────────────

    /** {@link #submit(String, List, String, Map, Map, long, Predicate)} without pairs */
    public void submit(String userId, List<Long> picks, String text, Map<Long, String> tiers,
            long now, Predicate<String> online) {
        submit(userId, picks, text, tiers, null, now, online);
    }

    /**
     * An answer to the current question, replacing any earlier one.
     * {@code picks}: answer ids (choices, polls; every item in order for ORDER);
     * {@code text}: something written, typed or a number; {@code tiers}: answer
     * id to tier (tier lists); {@code pairs}: answer id to the key of its other
     * half (MATCH). Drawings come through {@link #draw}.
     */
    public void submit(String userId, List<Long> picks, String text, Map<Long, String> tiers,
            Map<Long, String> pairs, long now, Predicate<String> online) {
        submit(userId, picks, text, tiers, pairs, null, now, online);
    }

    /**
     * As above; {@code choices}: entry keys on a pick that borrows an earlier
     * question's answers, or the one player named on a person question.
     */
    public void submit(String userId, List<Long> picks, String text, Map<Long, String> tiers,
            Map<Long, String> pairs, List<String> choices, long now, Predicate<String> online) {
        Step step = current();
        if (status != Status.PLAYING || step == null || step.phase() != Phase.QUESTION || step.question() == null) {
            throw new IllegalStateException("Answers are closed");
        }
        requirePlayer(userId);
        QuestionSnap q = step.question();
        QState st = state(q);
        Mode mode = q.mode();
        if (dealsPairs(q)) dealTo(q, st, userId);
        switch (mode.ask()) {
            case PICK -> {
                if (borrows(q)) {
                    voteOn(q, st, userId, choices, now, online);
                    changed(now);
                    return;
                }
                if (picks == null || picks.size() != 1 || !hasAnswer(q, picks.get(0))) {
                    throw new IllegalArgumentException("Pick one answer");
                }
                st.picks.put(userId, List.of(picks.get(0)));
            }
            case PICK_MANY -> {
                if (picks == null || picks.isEmpty()) throw new IllegalArgumentException("Pick at least one answer");
                List<Long> valid = new ArrayList<>(new LinkedHashSet<>(picks));
                if (!valid.stream().allMatch(id -> hasAnswer(q, id))) {
                    throw new IllegalArgumentException("That is not one of the answers");
                }
                st.picks.put(userId, List.copyOf(valid));
            }
            case ORDER -> {
                boolean whole = picks != null && picks.size() == q.answers().size()
                        && new HashSet<>(picks).size() == picks.size() && picks.stream().allMatch(id -> hasAnswer(q, id));
                if (!whole) throw new IllegalArgumentException("Put every item in the order");
                st.picks.put(userId, List.copyOf(picks));
            }
            case RANK -> {
                if (tiers == null || tiers.isEmpty()) throw new IllegalArgumentException("Put something in a tier");
                Map<Long, String> clean = new LinkedHashMap<>();
                tiers.forEach((id, tier) -> {
                    if (id != null && hasAnswer(q, id) && tier != null && TIERS.contains(tier)) clean.put(id, tier);
                });
                if (clean.isEmpty()) throw new IllegalArgumentException("Put something in a tier");
                st.tiers.put(userId, clean);
            }
            case MATCH -> {
                prepare(q, st);
                Map<Long, String> clean = new LinkedHashMap<>();
                if (pairs != null) {
                    pairs.forEach((id, key) -> {
                        if (id != null && hasAnswer(q, id) && key != null && st.rightShown.contains(key)) clean.put(id, key);
                    });
                }
                if (clean.isEmpty()) throw new IllegalArgumentException("Pair at least one");
                st.pairs.put(userId, clean);
            }
            case NUMBER -> {
                Double x = Fuzzy.number(text);
                if (x == null) throw new IllegalArgumentException("That isn't a number");
                Double min = q.number("min");
                Double max = q.number("max");
                if ((min != null && x < min) || (max != null && x > max)) {
                    throw new IllegalArgumentException("Pick a number from " + plain(min) + " to " + plain(max));
                }
                st.numbers.put(userId, x);
            }
            case CHAIN -> {
                Telephone t = playing(st, userId);
                if (t.kind() == Telephone.Kind.DRAW) throw new IllegalArgumentException("This round is for drawing");
                t.put(userId, new Telephone.Link(userId, written(text), null));
                telephoneDone(t, now, online);
                changed(now);
                return;
            }
            case PERSON -> {
                String who = choices == null || choices.size() != 1 ? null : choices.get(0);
                if (who == null || who.isBlank()) throw new IllegalArgumentException("Pick someone");
                if (who.equals(userId)) throw new IllegalArgumentException("Pick someone else");
                if (!peopleFor(q).contains(who)) throw new IllegalArgumentException("Pick someone from the list");
                st.named.put(userId, who);
            }
            case DRAW -> throw new IllegalArgumentException("Send a drawing");
            case WRITE -> {
                String clean = written(text);
                if (mode.score() == Mode.Score.SECRET) {
                    // describing a secret word without saying it
                    AnswerSnap word = secret(q, st, userId);
                    if (word != null && saysIt(clean, word.text())) throw new IllegalArgumentException("No saying the word itself");
                }
                st.texts.put(userId, clean);
            }
            default -> st.texts.put(userId, written(text));
        }
        if (q.speed() && mode.speedy()) st.left.put(userId, timeLeft(step, now));
        if (everyoneDid(answeredBy(st, q), online)) endsAt = Math.min(endsAt, now + EVERYONE_DONE_MS);
        changed(now);
    }

    /** whether a description gives its secret word away: the word, or something close to it, in it */
    static boolean saysIt(String text, String word) {
        String said = " " + Fuzzy.normalize(text) + " ";
        String w = Fuzzy.normalize(word);
        if (w.isEmpty()) return false;
        if (said.contains(" " + w + " ") || said.replace(" ", "").contains(w.replace(" ", ""))) return true;
        for (String part : said.trim().split(" ")) {
            if (Fuzzy.matches(part, w)) return true;
        }
        return false;
    }

    /**
     * A drawing for the current question (the drawn types, and telephone's
     * drawing rounds), replacing any earlier one. Returns its art id.
     */
    public String draw(String userId, byte[] bytes, String contentType, long now, Predicate<String> online) {
        Step step = current();
        if (status != Status.PLAYING || step == null || step.phase() != Phase.QUESTION || step.question() == null) {
            throw new IllegalStateException("Drawing is closed");
        }
        requirePlayer(userId);
        QuestionSnap q = step.question();
        Mode.Ask ask = q.mode().ask();
        if (ask != Mode.Ask.DRAW && ask != Mode.Ask.CHAIN) throw new IllegalArgumentException("This one isn't drawn");
        if (bytes == null || bytes.length == 0) throw new IllegalArgumentException("Draw something first");
        if (bytes.length > MAX_ART_BYTES) throw new IllegalArgumentException("That drawing is too big to send");
        QState st = state(q);
        String id;
        if (ask == Mode.Ask.CHAIN) {
            Telephone t = playing(st, userId);
            if (t.kind() != Telephone.Kind.DRAW) throw new IllegalArgumentException("This round is for writing");
            Telephone.Link before = t.mine(userId);
            id = keepArt(bytes, contentType, before == null ? null : before.image());
            t.put(userId, new Telephone.Link(userId, null, id));
            telephoneDone(t, now, online);
        } else {
            if (dealsPairs(q)) dealTo(q, st, userId);
            id = keepArt(bytes, contentType, st.drawings.get(userId));
            st.drawings.put(userId, id);
            if (everyoneDid(st.drawings.keySet(), online)) endsAt = Math.min(endsAt, now + EVERYONE_DONE_MS);
        }
        changed(now);
        return id;
    }

    /** a drawing by its id, while the game lasts */
    public Art art(String id) {
        return id == null ? null : art.get(id);
    }

    private String keepArt(byte[] bytes, String contentType, String replaces) {
        Art old = replaces == null ? null : art.get(replaces);
        long after = artBytes + bytes.length - (old == null ? 0 : old.bytes().length);
        if (after > MAX_GAME_ART_BYTES) throw new IllegalStateException("This game has no room left for drawings");
        if (old != null) art.remove(replaces);
        String id;
        do {
            id = randomKey(12);
        } while (art.containsKey(id));
        art.put(id, new Art(bytes, contentType));
        artBytes = after;
        return id;
    }

    private String randomKey(int length) {
        String chars = "abcdefghijkmnpqrstuvwxyz23456789";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < length; i++) sb.append(chars.charAt(random.nextInt(chars.length())));
        return sb.toString();
    }

    private Telephone playing(QState st, String userId) {
        Telephone t = st.telephone;
        if (t == null || t.done) throw new IllegalStateException("Nothing is being handed on right now");
        if (!t.players.contains(userId)) throw new IllegalStateException("This one started before you joined: watch this time");
        return t;
    }

    /** when everyone still here has done this round, it ends now */
    private void telephoneDone(Telephone t, long now, Predicate<String> online) {
        List<String> present = t.players.stream().filter(p -> players.containsKey(p) && online.test(p)).toList();
        if (!present.isEmpty() && t.doneThisRound().containsAll(present)) {
            t.roundEndsAt = Math.min(t.roundEndsAt, now + EVERYONE_DONE_MS);
        }
    }

    private static String written(String text) {
        String clean = text == null ? "" : text.strip();
        if (clean.isEmpty()) throw new IllegalArgumentException("Write something first");
        return clean.length() > MAX_TEXT ? clean.substring(0, MAX_TEXT) : clean;
    }

    /** share of this step's time still left, 0 to 1 */
    private double timeLeft(Step step, long now) {
        double total = Math.max(1, step.seconds()) * 1000.0;
        return Math.max(0, Math.min(1, (endsAt - now) / total));
    }

    /** 2.0 -> "2", 2.5 -> "2.5", null -> "any" */
    static String plain(Double x) {
        if (x == null) return "any";
        return x == Math.rint(x) && Math.abs(x) < 1e15 ? String.valueOf(x.longValue()) : String.valueOf(x);
    }

    /**
     * A vote during the ANSWER step. {@code choice}: the entry voted for
     * (write + vote, draw + vote, knockouts with {@code match}); {@code guesses}:
     * entry key to the player guessed to have written it (who wrote it), or to
     * the word guessed for a drawing (draw + guess).
     */
    public void vote(String userId, String choice, Integer match, Map<String, String> guesses,
            long now, Predicate<String> online) {
        vote(userId, choice, null, match, guesses, now, online);
    }

    /** As above; {@code choices}: up to the question's picks entries, in place of one choice. */
    public void vote(String userId, String choice, List<String> choices, Integer match, Map<String, String> guesses,
            long now, Predicate<String> online) {
        Step step = current();
        String interaction = interaction();
        if (status != Status.PLAYING || interaction == null || !List.of("vote", "guess", "bracket").contains(interaction)) {
            throw new IllegalStateException("Voting is closed");
        }
        requirePlayer(userId);
        QState st = state(step.question());
        boolean words = step.question().mode().score() == Mode.Score.SECRET;
        switch (interaction) {
            case "vote" -> {
                QuestionSnap q = step.question();
                List<String> keys = choices != null ? distinct(choices) : choice == null ? List.of() : List.of(choice);
                if (keys.isEmpty()) throw new IllegalArgumentException("That answer is not on the board");
                if (keys.size() > q.picks()) throw new IllegalArgumentException("You can vote for up to " + q.picks());
                for (String key : keys) {
                    Entry e = entry(st, key);
                    if (e == null) throw new IllegalArgumentException("That answer is not on the board");
                    if (e.authorId.equals(userId)) throw new IllegalArgumentException("You can't vote for your own");
                }
                st.votes.put(userId, keys);
                if (everyoneDid(boardDone(q, st), online)) endsAt = Math.min(endsAt, now + EVERYONE_DONE_MS);
            }
            case "guess" -> {
                if (guesses == null || guesses.isEmpty()) throw new IllegalArgumentException("Guess at least one");
                Map<String, String> clean = new LinkedHashMap<>(st.guesses.getOrDefault(userId, Map.of()));
                guesses.forEach((key, said) -> {
                    Entry e = entry(st, key);
                    if (e == null || e.authorId.equals(userId) || said == null) return;
                    if (words && !said.isBlank()) clean.put(key, written(said));
                    if (!words && players.containsKey(said)) clean.put(key, said);
                });
                if (clean.isEmpty()) throw new IllegalArgumentException("Guess at least one");
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

    /**
     * What only this player gets to see right now: their secret word (draw +
     * guess), what they're handed (telephone), what they've drawn so far.
     * Empty when there's nothing.
     */
    public Map<String, Object> task(String userId) {
        Map<String, Object> m = new LinkedHashMap<>();
        Step step = current();
        if (userId == null || !players.containsKey(userId)) return m;
        if (step == null || step.question() == null || step.phase() != Phase.QUESTION) return m;
        if (status != Status.PLAYING && status != Status.PAUSED) return m;
        QuestionSnap q = step.question();
        QState st = state(q);
        m.put("question", q.id());
        Mode mode = q.mode();
        if (mode.score() == Mode.Score.SECRET) {
            AnswerSnap word = secret(q, st, userId);
            m.put("word", word == null ? null : word.text());
        }
        if (dealsPairs(q)) {
            // what they were dealt: the prompt filled in for them, and the answer it's about
            Entry d = dealTo(q, st, userId);
            m.put("prompt", fill(q, q.text(), userId));
            if (d != null) m.put("about", about(d, sources.get(q.id())));
        }
        switch (mode.ask()) {
            case DRAW -> {
                m.put("kind", "draw");
                m.put("drawing", st.drawings.get(userId));
            }
            case WRITE -> m.put("kind", "write");
            case PICK -> {
                if (!borrows(q)) break;
                m.put("kind", "ballot");
                m.put("picks", q.picks());
                Ballots b = st.ballots;
                if (b != null) {
                    m.put("round", b.round);
                    m.put("rounds", b.rounds);
                }
                List<Map<String, Object>> ballot = new ArrayList<>();
                for (String key : optionsOf(st, userId, true)) {
                    Entry e = entry(st, key);
                    if (e != null) ballot.add(entryFace(e));
                }
                m.put("ballot", ballot);
                List<String> chosen = (b != null ? b.votesNow() : st.votes).get(userId);
                m.put("chosen", chosen == null ? List.of() : chosen);
            }
            case PERSON -> {
                m.put("kind", "person");
                m.put("chosen", st.named.get(userId));
                // the maker of the winner picks too, so nobody can tell: their phone says why
                if (q.mode().score() == Mode.Score.RIGHT && userId.equals(rightPerson(q))) m.put("yours", true);
            }
            case CHAIN -> {
                Telephone t = st.telephone;
                if (t == null || t.done) return m;
                if (!t.players.contains(userId)) {
                    m.put("kind", "watch");
                    return m;
                }
                m.put("kind", t.kind().name().toLowerCase());
                m.put("round", t.round);
                m.put("rounds", t.rounds);
                Telephone.Link handed = t.handed(userId);
                if (handed != null) m.put("handed", linkView(handed, false));
                Telephone.Link mine = t.mine(userId);
                if (mine != null) m.put("mine", linkView(mine, false));
            }
            default -> { /* nothing secret about the others */ }
        }
        return m;
    }

    /** their secret word for draw + guess, dealt so the words go round as evenly as they can */
    private AnswerSnap secret(QuestionSnap q, QState st, String userId) {
        if (q.answers().isEmpty()) return null;
        Long have = st.secrets.get(userId);
        if (have == null) {
            Map<Long, Integer> used = new HashMap<>();
            q.answers().forEach(a -> used.put(a.id(), 0));
            st.secrets.values().forEach(id -> used.merge(id, 1, Integer::sum));
            int least = Collections.min(used.values());
            List<Long> free = q.answers().stream().map(AnswerSnap::id).filter(id -> used.get(id) == least).toList();
            have = free.get(random.nextInt(free.size()));
            st.secrets.put(userId, have);
        }
        long id = have;
        return q.answers().stream().filter(a -> a.id() == id).findFirst().orElse(null);
    }

    private static Map<String, Object> linkView(Telephone.Link l, boolean withAuthor) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (withAuthor) m.put("authorId", l.authorId());
        if (l.image() != null) m.put("image", l.image());
        else m.put("text", l.text());
        return m;
    }

    private static Set<String> voters(QState st, Set<String> who) {
        return new LinkedHashSet<>(who);
    }

    /** Has everyone still connected done it? Only players who are online count. */
    private boolean everyoneDid(Set<String> did, Predicate<String> online) {
        List<String> present = players.keySet().stream().filter(online).toList();
        return !present.isEmpty() && did.containsAll(present);
    }

    /**
     * Who's done with the question. Tier lists and pairs are saved with every
     * tap, so time running out loses nothing; they're done once every item has
     * its place, not at the first one.
     */
    private Set<String> answeredBy(QState st, QuestionSnap q) {
        return switch (q.mode().ask()) {
            case PICK, PICK_MANY, ORDER -> borrows(q) ? ballotDone(q, st) : st.picks.keySet();
            case PERSON -> st.named.keySet();
            case RANK -> whole(st.tiers, q);
            case MATCH -> whole(st.pairs, q);
            case NUMBER -> st.numbers.keySet();
            case DRAW -> st.drawings.keySet();
            case CHAIN -> st.telephone == null || st.telephone.done ? Set.of() : st.telephone.doneThisRound();
            case TYPE_IN, WRITE -> st.texts.keySet();
        };
    }

    private static Set<String> whole(Map<String, Map<Long, String>> placed, QuestionSnap q) {
        Set<String> done = new LinkedHashSet<>();
        placed.forEach((user, items) -> {
            if (items.size() >= q.answers().size()) done.add(user);
        });
        return done;
    }

    private void requirePlayer(String userId) {
        if (userId == null || !players.containsKey(userId)) throw new IllegalArgumentException("Join the game first");
    }

    // ─── reveal and score ──────────────────────────────────────────────

    private void reveal(QuestionSnap q) {
        QState st = state(q);
        if (st.revealed) return;
        st.revealed = true;
        Mode mode = q.mode();
        if (mode.entries()) {
            boolean drawn = mode.ask() == Mode.Ask.DRAW;
            List<Map.Entry<String, String>> made = new ArrayList<>((drawn ? st.drawings : st.texts).entrySet());
            Collections.shuffle(made, random);
            List<Entry> entries = new ArrayList<>();
            for (int i = 0; i < made.size(); i++) {
                String key = "e" + (i + 1);
                String author = made.get(i).getKey();
                String value = made.get(i).getValue();
                Entry e = drawn ? new Entry(key, author, null, value) : new Entry(key, author, value);
                if (dealsPairs(q)) {
                    // what it was made about goes with it, into a later vote too
                    e.about = st.dealt.get(author);
                    e.aboutFrom = sources.get(q.id()).id();
                }
                entries.add(e);
            }
            st.entries = entries;
        }
        // a vote that was skipped still has a board
        if (borrows(q) && !st.borrowed) borrow(q, st);
        if (st.telephone != null) {
            st.telephone.done = true;
            st.telephone.roundEndsAt = 0;
        }
        if (!mode.judged()) settle(q);
    }

    private void settle(QuestionSnap q) {
        QState st = state(q);
        if (st.settled) return;
        reveal(q);
        st.settled = true;
        Map<String, Integer> gains = st.gains;
        Mode mode = q.mode();
        switch (mode.score()) {
            case RIGHT -> scoreRight(q, st, gains);
            case CROWD -> scoreCrowd(q, st, gains);
            case VOTES -> {
                countVotes(st);
                // 100 a vote, however often it was seen
                st.entries.forEach(e -> {
                    if (e.votes > 0) gains.merge(e.authorId, e.votes * VOTE_POINTS, Integer::sum);
                });
            }
            case AUTHORS -> st.guesses.forEach((user, g) -> g.forEach((key, author) -> {
                Entry e = entry(st, key);
                if (e != null && e.authorId.equals(author)) {
                    e.votes++; // how many saw through it
                    gains.merge(user, GUESS_POINTS, Integer::sum);
                }
            }));
            case SECRET -> st.guesses.forEach((user, g) -> g.forEach((key, said) -> {
                Entry e = entry(st, key);
                AnswerSnap word = e == null ? null : wordOf(q, st, e.authorId);
                if (word != null && Fuzzy.matches(said, word.text())) {
                    e.votes++; // how many got it
                    int value = Math.max(0, word.value());
                    if (value > 0) {
                        gains.merge(user, value, Integer::sum);
                        gains.merge(e.authorId, value / 2, Integer::sum);
                    }
                }
            }));
            case KNOCKOUT -> {
                if (st.bracket == null) startBracket(q, 0, 0);
                Bracket b = st.bracket;
                while (!b.done) advanceRound(b, 0);
                for (List<Match> round : b.history) {
                    for (Match m : round) {
                        if (m.b != null && m.winner != null) gains.merge(m.winner.authorId, BATTLE_POINTS, Integer::sum);
                    }
                }
                if (b.champion != null) gains.merge(b.champion.authorId, CHAMPION_POINTS, Integer::sum);
                st.winner = b.champion == null ? null : b.champion.key;
            }
            case NONE -> {
                // nobody scores; a ranking still shows where the group put things, a vote what won
                if (mode.ask() == Mode.Ask.RANK) st.consensus = consensus(q, st);
                if (voting(q)) countVotes(st);
            }
        }
        if (voting(q)) pickWinner(st);
        if (q.speed() && mode.speedy()) {
            // the last moment is worth half
            gains.replaceAll((user, points) -> (int) Math.round(points * (0.5 + 0.5 * st.left.getOrDefault(user, 0.0))));
        }
        if (q.weight() != 100) gains.replaceAll((user, points) -> points * q.weight() / 100);
        gains.values().removeIf(points -> points == 0);
        Map<String, Integer> payout = new HashMap<>(gains);
        if (!gains.isEmpty() && hidesMakers(q)) {
            // the answer to a later "who made it": its points would give it away, so they wait
            st.held = true;
            payout.clear();
        }
        if (q.mode().ask() == Mode.Ask.PERSON) {
            // its guess is over: what it was keeping secret is paid now
            questions.forEach((id, h) -> {
                if (!h.held || hidesMakers(snaps.get(id))) return;
                h.held = false;
                h.gains.forEach((u, pts) -> {
                    payout.merge(u, pts, Integer::sum);
                    st.released.merge(u, pts, Integer::sum);
                });
            });
        }
        players.values().forEach(p -> {
            p.gain = payout.getOrDefault(p.id, 0);
            p.score += p.gain;
        });
    }

    /** every vote cast onto its entry; on ballots, also how often each was seen by someone who voted */
    private void countVotes(QState st) {
        Ballots b = st.ballots;
        if (b == null) {
            st.votes.values().forEach(keys -> keys.forEach(key -> {
                Entry e = entry(st, key);
                if (e != null) e.votes++;
            }));
            return;
        }
        for (int r = 0; r < b.rounds; r++) {
            Map<String, List<String>> dealtThen = b.dealt.get(r);
            b.votes.get(r).forEach((voter, keys) -> {
                keys.forEach(key -> {
                    Entry e = entry(st, key);
                    if (e != null) e.votes++;
                });
                if (keys.isEmpty()) return;
                dealtThen.getOrDefault(voter, List.of()).forEach(key -> {
                    Entry e = entry(st, key);
                    if (e != null) e.shown++;
                });
            });
        }
        b.done = true;
        b.roundEndsAt = 0;
    }

    /**
     * The winner, once: the most votes (on ballots, the most votes for the
     * times it was seen), a tie settled at random. Nobody voting leaves every
     * entry tied, so a later "who made it" still has something to ask about.
     */
    private void pickWinner(QState st) {
        if (st.entries.isEmpty()) {
            st.winner = null;
            return;
        }
        boolean perShown = st.ballots != null;
        Comparator<Entry> rank = perShown
                ? (a, b) -> Long.compare((long) a.votes * Math.max(1, b.shown), (long) b.votes * Math.max(1, a.shown))
                : Comparator.comparingInt(e -> e.votes);
        Entry best = Collections.max(st.entries, rank);
        List<Entry> top = st.entries.stream().filter(e -> rank.compare(e, best) == 0).toList();
        st.winner = top.get(random.nextInt(top.size())).key;
        st.tied = top.size() >= 2 ? top.stream().map(e -> e.key).toList() : List.of();
    }

    /** "right": whoever gets it right */
    private void scoreRight(QuestionSnap q, QState st, Map<String, Integer> gains) {
        switch (q.mode().ask()) {
            case PICK, PICK_MANY -> st.picks.forEach((user, picked) -> {
                int sum = picked.stream().mapToInt(id -> valueOf(q, id)).sum();
                if (sum > 0) gains.merge(user, sum, Integer::sum);
            });
            case TYPE_IN -> st.texts.forEach((user, typed) -> {
                AnswerSnap best = bestTyped(q, typed);
                if (best != null && best.value() > 0) gains.merge(user, best.value(), Integer::sum);
            });
            case ORDER -> st.picks.forEach((user, order) -> {
                int sum = 0;
                for (int i = 0; i < order.size() && i < q.answers().size(); i++) {
                    AnswerSnap a = q.answers().get(i);
                    if (order.get(i) == a.id()) sum += Math.max(0, a.value());
                }
                if (sum > 0) gains.merge(user, sum, Integer::sum);
            });
            case MATCH -> st.pairs.forEach((user, paired) -> {
                int sum = 0;
                for (AnswerSnap a : q.answers()) {
                    if (pairedRight(q, st, a, paired.get(a.id()))) sum += Math.max(0, a.value());
                }
                if (sum > 0) gains.merge(user, sum, Integer::sum);
            });
            case NUMBER -> numberGains(q, st).forEach((user, points) -> {
                if (points > 0) gains.merge(user, points, Integer::sum);
            });
            case PERSON -> {
                // the maker can't name themselves, so they can't score
                String right = rightPerson(q);
                if (right != null) st.named.forEach((user, who) -> {
                    if (who.equals(right)) gains.merge(user, GUESS_POINTS, Integer::sum);
                });
            }
            default -> { /* no right answer to get */ }
        }
    }

    /** "crowd": whoever sides with the most */
    private void scoreCrowd(QuestionSnap q, QState st, Map<String, Integer> gains) {
        switch (q.mode().ask()) {
            case PICK -> {
                Map<Long, Integer> counts = pickCounts(q, st);
                int most = counts.values().stream().mapToInt(Integer::intValue).max().orElse(0);
                st.top = most == 0 ? List.of()
                        : counts.entrySet().stream().filter(e -> e.getValue() == most).map(Map.Entry::getKey).toList();
                st.picks.forEach((user, picked) -> {
                    long id = picked.get(0);
                    if (st.top.contains(id) && valueOf(q, id) > 0) gains.merge(user, valueOf(q, id), Integer::sum);
                });
            }
            case RANK -> {
                st.consensus = consensus(q, st);
                st.tiers.forEach((user, placed) -> {
                    long agreed = placed.entrySet().stream()
                            .filter(e -> e.getValue().equals(st.consensus.get(e.getKey()))).count();
                    if (agreed > 0) gains.merge(user, (int) agreed * TIER_POINTS, Integer::sum);
                });
            }
            case NUMBER -> numberGains(q, st).forEach((user, points) -> {
                if (points > 0) gains.merge(user, points, Integer::sum);
            });
            default -> { /* nothing to side with */ }
        }
    }

    /** ORDER shows its items shuffled; MATCH shows the other halves shuffled, under keys of their own */
    private void prepare(QuestionSnap q, QState st) {
        Mode.Ask ask = q.mode().ask();
        if (ask == Mode.Ask.ORDER && st.shown == null) {
            List<Long> right = q.answers().stream().map(AnswerSnap::id).toList();
            List<Long> shown = new ArrayList<>(right);
            for (int tries = 0; tries < 6 && (tries == 0 || shown.equals(right)) && right.size() > 1; tries++) {
                Collections.shuffle(shown, random);
            }
            st.shown = List.copyOf(shown);
        }
        if (ask == Mode.Ask.MATCH && st.rightKey == null) {
            List<AnswerSnap> halves = new ArrayList<>(q.answers());
            Collections.shuffle(halves, random);
            Map<Long, String> keys = new LinkedHashMap<>();
            List<String> shown = new ArrayList<>();
            for (int i = 0; i < halves.size(); i++) {
                keys.put(halves.get(i).id(), "m" + (i + 1));
                shown.add("m" + (i + 1));
            }
            st.rightKey = keys;
            st.rightShown = List.copyOf(shown);
        }
    }

    /** the other half behind a key */
    private static AnswerSnap halfOf(QuestionSnap q, QState st, String key) {
        if (key == null || st.rightKey == null) return null;
        return q.answers().stream().filter(a -> key.equals(st.rightKey.get(a.id()))).findFirst().orElse(null);
    }

    /** two answers with the same other half are as good as each other */
    private static boolean pairedRight(QuestionSnap q, QState st, AnswerSnap a, String key) {
        AnswerSnap half = halfOf(q, st, key);
        return half != null && Fuzzy.normalize(half.match()).equals(Fuzzy.normalize(a.match()));
    }

    /** the accepted answer a typed one counts as, the best scoring if several; null if none */
    private static AnswerSnap bestTyped(QuestionSnap q, String typed) {
        AnswerSnap best = null;
        for (AnswerSnap a : q.answers()) {
            if (Fuzzy.matches(typed, a.text()) && (best == null || a.value() > best.value())) best = a;
        }
        return best;
    }

    /** NUMBER: the number to be close to: the right one, or the room's average for "crowd"; null when there's none */
    private static Double rightNumber(QuestionSnap q, QState st) {
        if (q.mode().score() == Mode.Score.CROWD) {
            return st.numbers.isEmpty() ? null : st.numbers.values().stream().mapToDouble(Double::doubleValue).average().orElse(0);
        }
        return q.answers().isEmpty() ? null : Fuzzy.number(q.answers().get(0).text());
    }

    /** what a number question is worth spot on */
    private static int numberValue(QuestionSnap q) {
        if (!q.answers().isEmpty()) return Math.max(0, q.answers().get(0).value());
        return q.mode().score() == Mode.Score.CROWD ? CROWD_NUMBER_POINTS : 0;
    }

    /**
     * NUMBER: full points spot on, falling to nothing a quarter of the slider
     * away (or half the right number away when there's no slider); whoever came
     * closest gets at least half.
     */
    private static Map<String, Integer> numberGains(QuestionSnap q, QState st) {
        Map<String, Integer> out = new LinkedHashMap<>();
        Double right = rightNumber(q, st);
        if (right == null || st.numbers.isEmpty()) return out;
        int value = numberValue(q);
        Double min = q.number("min");
        Double max = q.number("max");
        double span = min != null && max != null && max > min ? (max - min) / 4 : Math.max(Math.abs(right) / 2, 1);
        double closest = st.numbers.values().stream().mapToDouble(x -> Math.abs(x - right)).min().orElse(0);
        st.numbers.forEach((user, x) -> {
            double off = Math.abs(x - right);
            double points = value * Math.max(0, 1 - off / span);
            if (off <= closest + 1e-9) points = Math.max(points, value / 2.0);
            out.put(user, (int) Math.round(points));
        });
        return out;
    }

    private static Map<Long, Integer> pickCounts(QuestionSnap q, QState st) {
        Map<Long, Integer> counts = new LinkedHashMap<>();
        q.answers().forEach(a -> counts.put(a.id(), 0));
        st.picks.values().forEach(p -> p.forEach(id -> counts.merge(id, 1, Integer::sum)));
        return counts;
    }

    /** DRAW_GUESS: the word the author of a drawing had */
    private static AnswerSnap wordOf(QuestionSnap q, QState st, String authorId) {
        Long id = st.secrets.get(authorId);
        return id == null ? null : q.answers().stream().filter(a -> a.id() == id).findFirst().orElse(null);
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

    /** can someone new join now? in the lobby always; after that, as the quiz says */
    boolean open() {
        Step s = current();
        return status == Status.LOBBY || s == null || s.open();
    }

    Step current() {
        return index >= 0 && index < steps.size() ? steps.get(index) : null;
    }

    private Bracket currentBracket() {
        Step s = current();
        if (s == null || s.phase() != Phase.ANSWER || s.question() == null) return null;
        QState st = questions.get(s.question().id());
        return st == null ? null : st.bracket;
    }

    private Ballots currentBallots() {
        Step s = current();
        if (s == null || s.phase() != Phase.QUESTION || s.question() == null) return null;
        QState st = questions.get(s.question().id());
        return st == null ? null : st.ballots;
    }

    private Telephone currentTelephone() {
        Step s = current();
        if (s == null || s.phase() != Phase.QUESTION || s.question() == null) return null;
        QState st = questions.get(s.question().id());
        return st == null ? null : st.telephone;
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
        return switch (s.question().mode().score()) {
            // a pick scored by votes was voted on while it was asked, and is settled by now
            case VOTES -> s.question().mode().entries() && st.entries.size() >= 2 ? "vote" : null;
            case AUTHORS, SECRET -> st.entries.size() >= 1 && players.size() >= 2 ? "guess" : null;
            case KNOCKOUT -> st.bracket != null && !st.bracket.done ? "bracket" : null;
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

        if (!roster.isEmpty()) v.put("roster", rosterView());
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
                    if (st != null && borrows(q)) v.put("board", boardView(q, st, step));
                    if (st != null && st.telephone != null && !st.telephone.done) {
                        Telephone t = st.telephone;
                        Map<String, Object> tv = new LinkedHashMap<>();
                        tv.put("round", t.round);
                        tv.put("rounds", t.rounds);
                        tv.put("kind", t.kind().name().toLowerCase());
                        tv.put("roundEndsAt", status == Status.PAUSED ? null : t.roundEndsAt);
                        tv.put("roundSeconds", t.roundMs() / 1000.0);
                        tv.put("players", t.players);
                        v.put("telephone", tv);
                    }
                }
                if (revealed) v.put("reveal", revealView(q, st, now));
            }
        }
        String interaction = interaction();
        v.put("interaction", interaction);
        if ("vote".equals(interaction) || "guess".equals(interaction) || "bracket".equals(interaction)) {
            QState st = questions.get(step.question().id());
            Set<String> acted = switch (interaction) {
                case "vote" -> boardDone(step.question(), st);
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
        v.put("hurry", List.copyOf(hurry));
        // the host's screen: here, or gone and (while playing) holding the game
        v.put("hostHere", online.test(hostId));
        v.put("pausedForHost", pausedForHost);
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
        Mode mode = q.mode();
        Mode.Ask ask = mode.ask();
        m.put("id", q.id());
        m.put("text", fill(q, q.text(), null));
        m.put("imageUrl", q.imageUrl());
        m.put("type", type(q).name());
        m.put("ask", ask.key());
        m.put("score", mode.score().key());
        if (q.weight() != 100) m.put("weight", q.weight());
        if (voting(q) && q.picks() > 1) m.put("picks", q.picks());
        // the real prompt is each player's own (task)
        if (dealsPairs(q)) m.put("dealt", true);
        if (ask == Mode.Ask.PERSON) {
            List<Map<String, Object>> people = new ArrayList<>();
            for (String id : peopleFor(q)) {
                Map<String, Object> pm = new LinkedHashMap<>();
                pm.put("id", id);
                pm.put("name", knownName(id));
                people.add(pm);
            }
            m.put("people", people);
            Entry won = mode.score() == Mode.Score.RIGHT ? winnerOf(sources.get(q.id())) : null;
            if (won != null) {
                // what's being asked about, never who made it
                Map<String, Object> em = new LinkedHashMap<>();
                if (won.image != null) em.put("image", won.image);
                else em.put("text", won.text);
                m.put("entry", em);
            }
        }
        if (q.speed() && mode.speedy()) m.put("speed", true);
        if (ask == Mode.Ask.NUMBER) {
            for (String key : List.of("unit", "min", "max")) {
                if (q.options().containsKey(key)) m.put(key, key.equals("unit") ? q.options().get(key) : q.number(key));
            }
        }
        QState st = ask == Mode.Ask.ORDER || ask == Mode.Ask.MATCH ? state(q) : questions.get(q.id());
        if (st != null) prepare(q, st);
        List<AnswerSnap> listed = q.answers();
        if (ask == Mode.Ask.ORDER && st != null) {
            // shuffled, never in the order that scores
            listed = st.shown.stream().map(id -> q.answers().stream().filter(a -> a.id() == id).findFirst().orElseThrow()).toList();
        }
        List<Map<String, Object>> answers = new ArrayList<>();
        for (AnswerSnap a : listed) {
            Map<String, Object> am = new LinkedHashMap<>();
            am.put("id", a.id());
            am.put("text", a.text());
            am.put("imageUrl", a.imageUrl());
            if (revealed) am.put("value", a.value());
            if (revealed && a.match() != null) am.put("match", a.match());
            answers.add(am);
        }
        if (ask == Mode.Ask.MATCH && st != null) {
            List<Map<String, Object>> halves = new ArrayList<>();
            for (String key : st.rightShown) {
                AnswerSnap half = halfOf(q, st, key);
                halves.add(Map.of("key", key, "text", half == null || half.match() == null ? "" : half.match()));
            }
            m.put("halves", halves);
        }
        // what would give the answer away stays hidden until then: what's typed,
        // the number, the secret words (until the guessing is over)
        boolean secret = mode.score() == Mode.Score.SECRET;
        boolean hidden = secret ? st == null || !st.settled : (ask == Mode.Ask.TYPE_IN || ask == Mode.Ask.NUMBER) && !revealed;
        boolean none = mode.entries() && !secret || ask == Mode.Ask.CHAIN || borrows(q) || ask == Mode.Ask.PERSON;
        m.put("answers", none || hidden ? List.of() : answers);
        if (showElaboration) {
            m.put("elaborationText", fill(q, q.elaborationText(), null));
            m.put("elaborationImageUrl", q.elaborationImageUrl());
        }
        return m;
    }

    private Map<String, Object> revealView(QuestionSnap q, QState st, long now) {
        Map<String, Object> r = new LinkedHashMap<>();
        Mode mode = q.mode();
        r.put("settled", st.settled);
        switch (mode.ask()) {
            case PICK, PICK_MANY -> {
                if (!borrows(q)) {
                    r.put("counts", pickCounts(q, st));
                    r.put("correct", switch (mode.score()) {
                        case RIGHT -> q.answers().stream().filter(a -> a.value() > 0).map(AnswerSnap::id).toList();
                        case CROWD -> st.top;
                        default -> List.of();
                    });
                }
            }
            case PERSON -> {
                Map<String, Integer> named = new LinkedHashMap<>();
                st.named.values().forEach(who -> named.merge(who, 1, Integer::sum));
                r.put("named", named);
                if (mode.score() == Mode.Score.RIGHT && st.settled) r.put("author", rightPerson(q));
            }
            case TYPE_IN -> {
                r.put("typed", typedView(q, st));
                r.put("correct", q.answers().stream().filter(a -> a.value() > 0).map(AnswerSnap::id).toList());
            }
            case ORDER -> {
                r.put("order", q.answers().stream().map(AnswerSnap::id).toList());
                Map<Long, Integer> placed = new LinkedHashMap<>();
                for (int i = 0; i < q.answers().size(); i++) {
                    int at = i;
                    long id = q.answers().get(i).id();
                    placed.put(id, (int) st.picks.values().stream().filter(o -> at < o.size() && o.get(at) == id).count());
                }
                r.put("placedRight", placed);
            }
            case MATCH -> {
                Map<Long, Integer> paired = new LinkedHashMap<>();
                for (AnswerSnap a : q.answers()) {
                    paired.put(a.id(), (int) st.pairs.values().stream().filter(p -> pairedRight(q, st, a, p.get(a.id()))).count());
                }
                r.put("pairedRight", paired);
            }
            case NUMBER -> {
                Double right = rightNumber(q, st);
                r.put("right", right);
                if (mode.score() == Mode.Score.CROWD) r.put("average", true);
                r.put("numbers", new LinkedHashMap<>(st.numbers));
                if (right != null && !st.numbers.isEmpty()) {
                    double closest = st.numbers.values().stream().mapToDouble(x -> Math.abs(x - right)).min().orElse(0);
                    r.put("closest", st.numbers.entrySet().stream()
                            .filter(e -> Math.abs(e.getValue() - right) <= closest + 1e-9).map(Map.Entry::getKey).toList());
                }
            }
            case CHAIN -> {
                List<Map<String, Object>> chains = new ArrayList<>();
                Telephone t = st.telephone;
                if (t != null) {
                    for (int c = 0; c < t.chains.size(); c++) {
                        List<Map<String, Object>> links = new ArrayList<>();
                        for (Telephone.Link l : t.chains.get(c)) {
                            if (l != null) links.add(linkView(l, true));
                        }
                        Map<String, Object> cm = new LinkedHashMap<>();
                        cm.put("starter", t.players.get(c));
                        cm.put("links", links);
                        chains.add(cm);
                    }
                }
                r.put("prompt", q.text());
                r.put("chains", chains);
            }
            case RANK -> {
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
        boolean hidden = hidesMakers(q);
        if (board(q)) {
            // who made what stays hidden while players are voting or guessing on it,
            // and while a later question still asks who made it
            boolean showAuthors = !mode.judged() || st.settled;
            List<Map<String, Object>> entries = new ArrayList<>();
            for (Entry e : st.entries) {
                Map<String, Object> em = new LinkedHashMap<>();
                em.put("key", e.key);
                if (e.image != null) em.put("image", e.image);
                else em.put("text", e.text);
                if (e.about != null) em.put("about", about(e.about, snaps.get(e.aboutFrom)));
                if (showAuthors) {
                    if (!hidden) em.put("authorId", e.authorId);
                    em.put("votes", e.votes);
                    if (st.ballots != null) em.put("shown", e.shown);
                }
                if (mode.score() == Mode.Score.SECRET && st.settled) {
                    AnswerSnap word = wordOf(q, st, e.authorId);
                    em.put("word", word == null ? null : word.text());
                    List<Map<String, Object>> said = new ArrayList<>();
                    st.guesses.forEach((user, g) -> {
                        String guess = g.get(e.key);
                        if (guess != null) {
                            said.add(Map.of("userId", user, "text", guess,
                                    "right", word != null && Fuzzy.matches(guess, word.text())));
                        }
                    });
                    em.put("guesses", said);
                }
                entries.add(em);
            }
            r.put("entries", entries);
            if (mode.score() == Mode.Score.AUTHORS) {
                r.put("authors", st.entries.stream().map(e -> e.authorId).distinct().toList());
            }
            if (mode.score() == Mode.Score.KNOCKOUT && st.bracket != null) r.put("bracket", bracketView(st.bracket, hidden));
            if (st.settled && (voting(q) || mode.score() == Mode.Score.KNOCKOUT)) {
                r.put("winner", st.winner);
                if (!st.tied.isEmpty()) r.put("tied", st.tied);
            }
        }
        if (st.settled && !st.held) r.put("gains", st.gains);
        if (st.held) r.put("held", true);
        if (!st.released.isEmpty()) r.put("released", st.released);
        return r;
    }

    private Map<String, Object> bracketView(Bracket b, boolean hidden) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("round", b.round);
        m.put("rounds", b.rounds);
        m.put("roundEndsAt", b.done ? null : b.roundEndsAt);
        m.put("done", b.done);
        m.put("matches", b.matches.stream().map(x -> matchView(x, false, hidden)).toList());
        m.put("history", b.history.stream().map(r -> r.stream().map(x -> matchView(x, true, hidden)).toList()).toList());
        if (b.champion != null) {
            Map<String, Object> c = side(b.champion);
            if (!hidden) c.put("authorId", b.champion.authorId);
            m.put("champion", c);
        }
        return m;
    }

    /** an entry in a battle: its words or its drawing */
    private static Map<String, Object> side(Entry e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("key", e.key);
        if (e.image != null) m.put("image", e.image);
        else m.put("text", e.text);
        return m;
    }

    /** what was typed, alike answers together, most typed first */
    private static List<Map<String, Object>> typedView(QuestionSnap q, QState st) {
        Map<String, Map<String, Object>> groups = new LinkedHashMap<>();
        st.texts.values().forEach(typed -> {
            String key = Fuzzy.normalize(typed);
            Map<String, Object> g = groups.computeIfAbsent(key, k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                AnswerSnap best = bestTyped(q, typed);
                m.put("text", typed);
                m.put("count", 0);
                m.put("right", best != null && best.value() > 0);
                return m;
            });
            g.put("count", (int) g.get("count") + 1);
        });
        List<Map<String, Object>> out = new ArrayList<>(groups.values());
        out.sort((a, b) -> Integer.compare((int) b.get("count"), (int) a.get("count")));
        return out.size() > 40 ? out.subList(0, 40) : out;
    }

    /** hidden: a later question still asks who made these, so the authors stay off */
    private Map<String, Object> matchView(Match x, boolean resolved, boolean hidden) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", x.id);
        m.put("a", side(x.a));
        m.put("b", x.b == null ? null : side(x.b));
        if (resolved) {
            long forA = x.votes.values().stream().filter(k -> k.equals(x.a.key)).count();
            m.put("votesA", forA);
            m.put("votesB", x.votes.size() - forA);
            m.put("winner", x.winner == null ? null : x.winner.key);
            if (!hidden) {
                m.put("authorA", x.a.authorId);
                m.put("authorB", x.b == null ? null : x.b.authorId);
            }
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
        Mode mode = q.mode();
        String filled = fill(q, q.text(), null);
        if (filled != null && !filled.equals(q.text())) r.put("text", filled);
        switch (mode.ask()) {
            case PICK, PICK_MANY -> {
                if (borrows(q)) break; // its entries are below
                List<Integer> counts = new ArrayList<>();
                for (AnswerSnap a : q.answers()) {
                    counts.add((int) st.picks.values().stream().filter(p -> p.contains(a.id())).count());
                }
                r.put("counts", counts);
            }
            case PERSON -> {
                Map<String, Integer> counts = new LinkedHashMap<>();
                st.named.values().forEach(who -> counts.merge(who, 1, Integer::sum));
                List<Map<String, Object>> named = new ArrayList<>();
                counts.entrySet().stream().sorted((a, b) -> b.getValue() - a.getValue())
                        .forEach(c -> named.add(Map.of("by", knownName(c.getKey()), "count", c.getValue())));
                r.put("named", named);
                String right = mode.score() == Mode.Score.RIGHT ? rightPerson(q) : null;
                r.put("author", right == null ? null : knownName(right));
            }
            case ORDER, MATCH -> {
                // how many got each item right, by position
                List<Integer> right = new ArrayList<>();
                for (int i = 0; i < q.answers().size(); i++) {
                    AnswerSnap a = q.answers().get(i);
                    int at = i;
                    right.add((int) (mode.ask() == Mode.Ask.ORDER
                            ? st.picks.values().stream().filter(o -> at < o.size() && o.get(at) == a.id()).count()
                            : st.pairs.values().stream().filter(p -> pairedRight(q, st, a, p.get(a.id()))).count()));
                }
                r.put("right", right);
            }
            case TYPE_IN -> r.put("typed", typedView(q, st));
            case NUMBER -> {
                List<Map<String, Object>> numbers = new ArrayList<>();
                st.numbers.forEach((user, x) -> numbers.add(Map.of("by", nameOf(user), "value", x)));
                r.put("numbers", numbers);
            }
            case RANK -> {
                List<String> tiers = new ArrayList<>();
                for (AnswerSnap a : q.answers()) tiers.add(st.consensus.get(a.id()));
                r.put("tiers", tiers);
            }
            case CHAIN -> {
                List<Map<String, Object>> chains = new ArrayList<>();
                if (st.telephone != null) {
                    for (Telephone.Link[] chain : st.telephone.chains) {
                        List<Map<String, Object>> links = new ArrayList<>();
                        for (Telephone.Link l : chain) {
                            if (l == null) continue;
                            Map<String, Object> lm = new LinkedHashMap<>();
                            lm.put("by", nameOf(l.authorId()));
                            if (l.image() != null) lm.put("image", l.image());
                            else lm.put("text", l.text());
                            links.add(lm);
                        }
                        chains.add(Map.of("links", links));
                    }
                }
                r.put("chains", chains);
            }
            default -> { /* written and drawn: entries below */ }
        }
        if (board(q)) {
            List<Map<String, Object>> entries = new ArrayList<>();
            for (Entry e : st.entries) {
                Map<String, Object> em = new LinkedHashMap<>();
                if (e.image != null) em.put("image", e.image);
                else em.put("text", e.text);
                em.put("by", nameOf(e.authorId));
                em.put("votes", e.votes);
                if (mode.score() == Mode.Score.SECRET) {
                    AnswerSnap word = wordOf(q, st, e.authorId);
                    if (word != null) em.put("word", word.text());
                }
                entries.add(em);
            }
            r.put("entries", entries);
            if (st.bracket != null && st.bracket.champion != null) {
                Map<String, Object> c = side(st.bracket.champion);
                c.remove("key");
                c.put("by", nameOf(st.bracket.champion.authorId));
                r.put("champion", c);
            }
        }
        if (!st.gains.isEmpty()) r.put("gains", new LinkedHashMap<>(st.gains));
        return r;
    }

    // ─── earlier questions ─────────────────────────────────────────────

    /** a pick whose options are an earlier question's answers */
    boolean borrows(QuestionSnap q) {
        return q.mode().ask() == Mode.Ask.PICK && (q.mode().score() == Mode.Score.VOTES || q.from() != null);
    }

    /** has a board of entries: made here (write, draw) or borrowed */
    boolean board(QuestionSnap q) {
        return q.mode().entries() || borrows(q);
    }

    /** people vote on its entries, so it ends up with a winner */
    boolean voting(QuestionSnap q) {
        return borrows(q) || (q.mode().entries() && q.mode().score() == Mode.Score.VOTES);
    }

    /** write or draw with from: everyone gets someone else's answer to make something about */
    boolean dealsPairs(QuestionSnap q) {
        return q.mode().entries() && sources.containsKey(q.id());
    }

    /** whose answers these really are: a pick that borrows is its source's */
    QuestionSnap maker(QuestionSnap q) {
        Set<Long> seen = new HashSet<>();
        QuestionSnap m = q;
        while (borrows(m) && sources.containsKey(m.id()) && seen.add(m.id())) m = sources.get(m.id());
        return m;
    }

    /** an unsettled person question still asks who made this question's answers */
    boolean guarded(long id) {
        if (finishing || status == Status.FINISHED) return false;
        for (Map.Entry<Long, Set<Long>> g : guards.entrySet()) {
            if (!g.getValue().contains(id)) continue;
            QState p = questions.get(g.getKey());
            if (p == null || !p.settled) return true;
        }
        return false;
    }

    /** its makers stay off every screen, and its points wait */
    boolean hidesMakers(QuestionSnap q) {
        return q != null && (guarded(q.id()) || guarded(maker(q).id()));
    }

    /** someone's name in this game, here or gone */
    String knownName(String id) {
        Player p = players.get(id);
        return p != null ? p.name : played.getOrDefault(id, "someone who left");
    }

    /** how names are compared: trimmed, inner spaces collapsed, lowercase */
    static String nameKey(String s) {
        return s == null ? "" : s.strip().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    /**
     * Before a question that uses earlier ones: they're revealed and settled
     * (so their winners are known), and a pick that borrows copies its
     * source's entries in. A source that never ran is left alone.
     */
    private void prepareSources(QuestionSnap q) {
        List<QuestionSnap> needs = new ArrayList<>();
        if (sources.containsKey(q.id())) needs.add(sources.get(q.id()));
        needs.addAll(winnerRefs.getOrDefault(q.id(), Map.of()).values());
        for (QuestionSnap s : needs) {
            QState sst = questions.get(s.id());
            if (sst != null && !sst.settled) {
                reveal(s);
                settle(s);
            }
        }
        if (borrows(q)) {
            QState st = state(q);
            if (!st.borrowed) borrow(q, st);
        }
    }

    /** the source's entries, under keys of their own, in a fresh order */
    private void borrow(QuestionSnap q, QState st) {
        st.borrowed = true;
        QuestionSnap src = sources.get(q.id());
        QState sst = src == null ? null : questions.get(src.id());
        if (sst == null) return;
        List<Entry> from = new ArrayList<>(sst.entries);
        Collections.shuffle(from, random);
        List<Entry> copies = new ArrayList<>();
        for (int i = 0; i < from.size(); i++) copies.add(from.get(i).copy("e" + (i + 1)));
        st.entries = copies;
    }

    /**
     * The vote opens: with an overflow that someone here has more than that
     * many to choose from, everyone here is dealt ballots; otherwise the board
     * is shared, everyone seeing all but their own.
     */
    private void openVote(QuestionSnap q, QState st, int seconds, long now) {
        if (st.opened) return;
        st.opened = true;
        List<String> voters = players.keySet().stream().filter(here).toList();
        int cap = q.overflow();
        boolean tooMany = cap >= 2 && voters.stream()
                .anyMatch(v -> st.entries.stream().filter(e -> !e.authorId.equals(v)).count() > cap);
        if (tooMany) st.ballots = Ballots.open(st.entries, voters, cap, Math.max(1, seconds) * 1000L, now, endsAt, random);
    }

    /** what a voter can vote for this round: their ballot, or everything not theirs; null when they're not dealt yet */
    private List<String> optionsOf(QState st, String voter, boolean deal) {
        if (st.ballots != null) return deal ? st.ballots.ballotOf(voter, st.entries, random) : st.ballots.peek(voter);
        return st.entries.stream().filter(e -> !e.authorId.equals(voter)).map(e -> e.key).toList();
    }

    /** a vote on a pick that borrows, cast while it's asked: the whole list, replacing the last */
    private void voteOn(QuestionSnap q, QState st, String userId, List<String> choices, long now, Predicate<String> online) {
        List<String> keys = choices == null ? List.of() : distinct(choices);
        if (keys.isEmpty()) throw new IllegalArgumentException("Pick one");
        if (keys.size() > q.picks()) throw new IllegalArgumentException("You can vote for up to " + q.picks());
        List<String> options = optionsOf(st, userId, true);
        for (String key : keys) {
            Entry e = entry(st, key);
            if (e == null) {
                throw new IllegalArgumentException(st.ballots != null ? "That one isn't on your list" : "That answer is not on the board");
            }
            if (e.authorId.equals(userId)) throw new IllegalArgumentException("You can't vote for your own");
            if (!options.contains(key)) throw new IllegalArgumentException("That one isn't on your list");
        }
        Ballots b = st.ballots;
        (b != null ? b.votesNow() : st.votes).put(userId, keys);
        if (everyoneDid(ballotDone(q, st), online)) {
            if (b != null && b.round < b.rounds) b.roundEndsAt = Math.min(b.roundEndsAt, now + EVERYONE_DONE_MS);
            else endsAt = Math.min(endsAt, now + EVERYONE_DONE_MS);
        }
    }

    /** done with this round of a pick that borrows: voted for as many as they can, or nothing to vote on */
    private Set<String> ballotDone(QuestionSnap q, QState st) {
        Set<String> done = new LinkedHashSet<>();
        Map<String, List<String>> cast = st.ballots != null ? st.ballots.votesNow() : st.votes;
        for (String p : players.keySet()) {
            List<String> options = optionsOf(st, p, false);
            if (options == null) continue; // away when it was dealt: not done until they've had theirs
            List<String> mine = cast.get(p);
            if (options.isEmpty() || (mine != null && mine.size() >= Math.min(q.picks(), options.size()))) done.add(p);
        }
        return done;
    }

    /** a board vote during the reveal (write or draw): voted for as many as they can */
    private Set<String> boardDone(QuestionSnap q, QState st) {
        Set<String> done = new LinkedHashSet<>();
        st.votes.forEach((voter, keys) -> {
            long theirs = st.entries.stream().filter(e -> !e.authorId.equals(voter)).count();
            if (keys.size() >= Math.min(q.picks(), theirs)) done.add(voter);
        });
        return done;
    }

    private static List<String> distinct(List<String> keys) {
        return keys.stream().filter(k -> k != null && !k.isBlank()).distinct().toList();
    }

    /** write or draw with from: everyone here gets someone else's answer, a different one each while they go round */
    private void dealPairs(QuestionSnap q, QState st) {
        if (!st.dealt.isEmpty()) return;
        QState sst = questions.get(sources.get(q.id()).id());
        if (sst == null) return;
        List<String> who = players.keySet().stream().filter(here).toList();
        st.dealt.putAll(Ballots.pairs(sst.entries, who, random));
    }

    /** what this player makes something about; a latecomer is dealt the least dealt one now */
    private Entry dealTo(QuestionSnap q, QState st, String userId) {
        Entry have = st.dealt.get(userId);
        if (have != null) return have;
        QState sst = questions.get(sources.get(q.id()).id());
        if (sst == null) return null;
        Entry e = Ballots.pairFor(userId, sst.entries, st.dealt, random);
        if (e != null) st.dealt.put(userId, e);
        return e;
    }

    /**
     * The words a screen shows: winners filled in the same for everyone,
     * {author} and {answer} for one player (forPlayer), or ___ on the shared
     * screen. Someone's words always go in quotes.
     */
    String fill(QuestionSnap q, String text, String forPlayer) {
        if (text == null || text.indexOf('{') < 0) return text;
        QState st = questions.get(q.id());
        Entry d = forPlayer == null || st == null ? null : st.dealt.get(forPlayer);
        Matcher m = FILL.matcher(text);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            String put;
            if (m.group(1) != null) {
                Entry won = winnerOf(winnerRefs.getOrDefault(q.id(), Map.of()).get(m.group(1)));
                put = won == null ? "…" : won.image != null ? "a drawing" : quoted(won.text);
            } else if (forPlayer == null) {
                put = "___";
            } else if (m.group(2).equalsIgnoreCase("author")) {
                put = d == null || hidesMakers(sources.get(q.id())) ? "someone" : knownName(d.authorId);
            } else {
                put = d == null || d.text == null ? "something" : quoted(d.text);
            }
            m.appendReplacement(out, Matcher.quoteReplacement(put));
        }
        m.appendTail(out);
        return out.toString();
    }

    private static String quoted(String text) {
        return "“" + text + "”";
    }

    /** an answer something was made about: what it was, and whose, unless that's still a secret */
    private Map<String, Object> about(Entry d, QuestionSnap from) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (!hidesMakers(from)) m.put("name", knownName(d.authorId));
        if (d.image != null) m.put("image", d.image);
        else m.put("text", d.text);
        return m;
    }

    /** an entry as a voter sees it: never who made it */
    private Map<String, Object> entryFace(Entry e) {
        Map<String, Object> m = side(e);
        if (e.about != null) m.put("about", about(e.about, snaps.get(e.aboutFrom)));
        return m;
    }

    /** the settled winner of a question, or null */
    private Entry winnerOf(QuestionSnap q) {
        QState st = q == null ? null : questions.get(q.id());
        return st == null || !st.settled || st.winner == null ? null : entry(st, st.winner);
    }

    /** person + right: whoever made the winner of its source, or null */
    private String rightPerson(QuestionSnap q) {
        Entry won = winnerOf(sources.get(q.id()));
        return won == null ? null : won.authorId;
    }

    /**
     * Who a person question lists: everyone who's played since the start, the
     * players here, and whoever made the answers it's about (so the right one
     * is always there), by name.
     */
    List<String> peopleFor(QuestionSnap q) {
        Set<String> ids = new LinkedHashSet<>(played.keySet());
        ids.addAll(players.keySet());
        QuestionSnap src = sources.get(q.id());
        QState made = src == null ? null : questions.get(maker(src).id());
        if (made != null) made.entries.forEach(e -> ids.add(e.authorId));
        List<String> out = new ArrayList<>(ids);
        out.sort(Comparator.comparing((String id) -> knownName(id), String.CASE_INSENSITIVE_ORDER).thenComparing(id -> id));
        return out;
    }

    private Map<String, Object> rosterView() {
        List<Map<String, Object>> names = new ArrayList<>();
        for (String name : roster) {
            Map<String, Object> n = new LinkedHashMap<>();
            n.put("name", name);
            n.put("taken", players.values().stream().anyMatch(p -> nameKey(p.name).equals(nameKey(name))));
            names.add(n);
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("names", names);
        m.put("unique", uniqueNames);
        return m;
    }

    /** a pick that borrows, while it's asked: the shared wall, or only how the ballots go */
    private Map<String, Object> boardView(QuestionSnap q, QState st, Step step) {
        Map<String, Object> m = new LinkedHashMap<>();
        Ballots b = st.ballots;
        m.put("mode", b == null ? "shared" : "ballots");
        m.put("count", st.entries.size());
        if (b == null) {
            m.put("entries", st.entries.stream().map(this::entryFace).toList());
        } else {
            m.put("cap", b.cap);
            m.put("round", b.round);
            m.put("rounds", b.rounds);
            m.put("roundEndsAt", status == Status.PAUSED ? null : b.roundEndsAt > 0 ? b.roundEndsAt : endsAt);
            m.put("roundSeconds", b.rounds == 1 ? (double) Math.max(1, step.seconds()) : b.roundMs / 1000.0);
        }
        return m;
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

    /** the drawings a finished game shows, to keep with its history */
    Map<String, Art> keptArt() {
        Map<String, Art> kept = new LinkedHashMap<>();
        for (QState st : questions.values()) {
            for (Entry e : st.entries) {
                if (e.image != null && art.containsKey(e.image)) kept.put(e.image, art.get(e.image));
            }
            if (st.telephone != null) {
                for (Telephone.Link[] chain : st.telephone.chains) {
                    for (Telephone.Link l : chain) {
                        if (l != null && l.image() != null && art.containsKey(l.image())) kept.put(l.image(), art.get(l.image()));
                    }
                }
            }
        }
        return kept;
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
