package com.lonezsi.jqzz.game;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.Predicate;

import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;

import com.lonezsi.jqzz.model.Action;
import com.lonezsi.jqzz.model.GameRecord;
import com.lonezsi.jqzz.repository.GameRecordRepository;
import tools.jackson.databind.json.JsonMapper;
import com.lonezsi.jqzz.model.Answer;
import com.lonezsi.jqzz.model.Phase;
import com.lonezsi.jqzz.model.PlayerResult;
import com.lonezsi.jqzz.model.Question;
import com.lonezsi.jqzz.model.Quiz;
import com.lonezsi.jqzz.model.User;
import com.lonezsi.jqzz.repository.QuizRepository;
import com.lonezsi.jqzz.repository.UserRepository;
import com.lonezsi.jqzz.service.PresenceTracker;

import jakarta.annotation.PreDestroy;

/**
 * Runs games: keeps them in memory by join code, keeps their clock, and
 * sends every change to /topic/play/{code}. The rules live in {@link Game}.
 *
 * In memory on purpose. A game lasts an evening; a restart losing the ones in
 * progress is a fair price for not putting a half-played game in the database.
 * Every change to a game happens on its own lock, whether it comes from a
 * request or from the clock.
 */
@Service
public class GameEngine {

    /** codes without letters that read as each other (0/O, 1/I) */
    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 5;
    private static final long FORGET_FINISHED_MS = TimeUnit.HOURS.toMillis(1);
    private static final long FORGET_IDLE_MS = TimeUnit.HOURS.toMillis(6);

    private final QuizRepository quizRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messaging;
    private final PresenceTracker presence;
    private final GameRecordRepository records;
    private final JsonMapper json;

    private final Map<String, Game> games = new ConcurrentHashMap<>();
    private final Map<String, ScheduledFuture<?>> timers = new ConcurrentHashMap<>();
    private final Random random = new SecureRandom();
    private final ScheduledExecutorService clock = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "jqzz-game-clock");
        t.setDaemon(true);
        return t;
    });

    public GameEngine(QuizRepository quizRepository, UserRepository userRepository,
            SimpMessagingTemplate messaging, PresenceTracker presence,
            GameRecordRepository records, JsonMapper json) {
        this.quizRepository = quizRepository;
        this.userRepository = userRepository;
        this.messaging = messaging;
        this.presence = presence;
        this.records = records;
        this.json = json;
        clock.scheduleAtFixedRate(this::forgetOldGames, 10, 10, TimeUnit.MINUTES);
    }

    @PreDestroy
    void stop() {
        clock.shutdownNow();
    }

    // ─── hosting and joining ───────────────────────────────────────────

    @Transactional(readOnly = true)
    public Map<String, Object> host(Long quizId, String hostId) {
        if (quizId == null || hostId == null || hostId.isBlank()) throw bad("quizId and userId are required");
        if (!userRepository.existsById(hostId)) throw notFound("No such user");
        Quiz quiz = quizRepository.findById(quizId).orElseThrow(() -> notFound("No such quiz"));
        Game game = hostQuiz(quiz, hostId);
        synchronized (game) {
            return view(game);
        }
    }

    /** A game of any quiz, saved or not (a stashed one for practice). */
    private Game hostQuiz(Quiz quiz, String hostId) {
        Random rng = new Random(random.nextLong());
        List<Game.Step> steps = snapshot(quiz, rng);
        if (steps.stream().noneMatch(s -> s.question() != null)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This quiz has no questions to play yet");
        }
        String code = newCode();
        Game game = new Game(code, hostId, quiz.getName(), steps, rng, now());
        game.authorId = quiz.getAuthorId();
        game.quizId = quiz.getId();
        games.put(code, game);
        return game;
    }

    /**
     * The same quiz again, for everyone from a finished game: hosts it and
     * sends each of them an invite on /topic/invite/{userId}.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> rematch(Long recordId, String userId) {
        GameRecord r = records.findById(recordId == null ? -1 : recordId).orElseThrow(() -> notFound("No such game"));
        if (userId == null || !r.involves(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You weren't in that game");
        }
        if (r.getQuizId() == null || !quizRepository.existsById(r.getQuizId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "That quiz is gone. Save it to your stash from this game and open it again.");
        }
        Map<String, Object> view = host(r.getQuizId(), userId);
        String code = (String) view.get("code");
        String from = userRepository.findById(userId).map(User::getName).orElse("someone");
        Set<String> invited = new LinkedHashSet<>();
        invited.add(r.getHostId());
        r.getPlayers().forEach(p -> invited.add(p.userId()));
        invited.remove(userId);
        for (String id : invited) {
            messaging.convertAndSend("/topic/invite/" + id,
                    (Object) Map.of("code", code, "from", from, "quizName", String.valueOf(r.getQuizName())));
        }
        return view;
    }

    /** A quiz played alone: you host it, you play it, it starts straight away. */
    @Transactional(readOnly = true)
    public Map<String, Object> practice(Quiz quiz, String userId) {
        User user = userRepository.findById(userId == null ? "" : userId).orElseThrow(() -> notFound("No such user"));
        Game game = hostQuiz(quiz, userId);
        return change(game, g -> {
            g.addPlayer(user.getId(), user.getName(), user.getProfilePictureUrl(), now());
            g.start(now());
        });
    }

    @Transactional(readOnly = true)
    public Map<String, Object> practice(Long quizId, String userId) {
        if (quizId == null) throw bad("quizId is required");
        return practice(quizRepository.findById(quizId).orElseThrow(() -> notFound("No such quiz")), userId);
    }

    public Map<String, Object> join(String code, String userId) {
        Game game = find(code);
        User user = userRepository.findById(userId == null ? "" : userId).orElseThrow(() -> notFound("No such user"));
        return change(game, g -> g.addPlayer(user.getId(), user.getName(), user.getProfilePictureUrl(), now()));
    }

    public Map<String, Object> leave(String code, String userId) {
        return change(find(code), g -> g.removePlayer(userId, now()));
    }

    public Map<String, Object> state(String code) {
        Game game = find(code);
        synchronized (game) {
            return view(game);
        }
    }

    // ─── the host's controls ───────────────────────────────────────────

    public Map<String, Object> start(String code, String userId) {
        return hostChange(code, userId, g -> g.start(now()));
    }

    public Map<String, Object> pause(String code, String userId) {
        return hostChange(code, userId, g -> g.pause(now()));
    }

    public Map<String, Object> resume(String code, String userId) {
        return hostChange(code, userId, g -> g.resume(now()));
    }

    public Map<String, Object> skip(String code, String userId) {
        return hostChange(code, userId, g -> g.skip(now()));
    }

    public Map<String, Object> end(String code, String userId) {
        return hostChange(code, userId, g -> g.end(now()));
    }

    public Map<String, Object> restart(String code, String userId) {
        return hostChange(code, userId, g -> g.restart(now()));
    }

    public Map<String, Object> kick(String code, String userId, String playerId) {
        return hostChange(code, userId, g -> g.removePlayer(playerId, now()));
    }

    // ─── what players send ─────────────────────────────────────────────

    public Map<String, Object> submit(String code, String userId, List<Long> picks, String text,
            Map<Long, String> tiers) {
        return change(find(code), g -> g.submit(userId, picks, text, tiers, now(), online()));
    }

    public Map<String, Object> vote(String code, String userId, String choice, Integer match,
            Map<String, String> guesses) {
        return change(find(code), g -> g.vote(userId, choice, match, guesses, now(), online()));
    }

    // ─── the clock ─────────────────────────────────────────────────────

    private void reschedule(Game game) {
        ScheduledFuture<?> old = timers.remove(game.code());
        if (old != null) old.cancel(false);
        long deadline;
        synchronized (game) {
            deadline = game.nextDeadline();
        }
        if (deadline <= 0) return;
        long delay = Math.max(0, deadline - now());
        timers.put(game.code(), clock.schedule(() -> fire(game.code()), delay, TimeUnit.MILLISECONDS));
    }

    private void fire(String code) {
        Game game = games.get(code);
        if (game == null) return;
        try {
            synchronized (game) {
                game.tick(now());
            }
            reschedule(game);
            publish(game);
            record(game);
        } catch (RuntimeException e) {
            // one broken game must not stop the clock for the others
            System.err.println("game " + code + ": " + e);
        }
    }

    private void forgetOldGames() {
        long now = now();
        for (Game game : new ArrayList<>(games.values())) {
            boolean finished = game.status() == Game.Status.FINISHED && now - game.touchedAt() > FORGET_FINISHED_MS;
            boolean idle = now - game.touchedAt() > FORGET_IDLE_MS;
            if (finished || idle) {
                games.remove(game.code());
                ScheduledFuture<?> t = timers.remove(game.code());
                if (t != null) t.cancel(false);
            }
        }
    }

    // ─── plumbing ──────────────────────────────────────────────────────

    private interface Change {
        void apply(Game game);
    }

    private Map<String, Object> hostChange(String code, String userId, Change change) {
        Game game = find(code);
        if (userId == null || !userId.equals(game.hostId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the host can do that");
        }
        return change(game, change);
    }

    private Map<String, Object> change(Game game, Change change) {
        Map<String, Object> view;
        try {
            synchronized (game) {
                change.apply(game);
                view = view(game);
            }
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
        reschedule(game);
        messaging.convertAndSend("/topic/play/" + game.code(), (Object) view);
        if (record(game)) {
            synchronized (game) {
                view = view(game);
            }
        }
        return view;
    }

    // ─── history ───────────────────────────────────────────────────────

    /**
     * A game that has just finished goes into everyone's history, once. The
     * record holds its own copy of what was asked, so the quiz can change or
     * go away afterwards. Returns whether it wrote one.
     */
    private boolean record(Game game) {
        GameRecord record;
        synchronized (game) {
            if (game.status() != Game.Status.FINISHED || game.recorded) return false;
            game.recorded = true;
            if (game.players.isEmpty()) return false; // nobody played: nothing to remember
            record = new GameRecord();
            record.setCode(game.code());
            record.setQuizId(game.quizId);
            record.setQuizName(game.quizName);
            record.setHostId(game.hostId());
            record.setAuthorId(game.authorId);
            record.setFinishedAt(LocalDateTime.now());
            record.setContent(json.writeValueAsString(recordContent(game)));
            List<Game.Player> sorted = new ArrayList<>(game.players.values());
            sorted.sort((a, b) -> Integer.compare(b.score, a.score));
            int rank = 0;
            Integer last = null;
            for (int i = 0; i < sorted.size(); i++) {
                Game.Player p = sorted.get(i);
                if (last == null || p.score != last) rank = i + 1;
                last = p.score;
                record.getPlayers().add(new PlayerResult(p.id, p.name, p.score, rank));
            }
        }
        try {
            GameRecord saved = records.save(record);
            synchronized (game) {
                game.recordId = saved.getId();
                game.version++;
            }
            publish(game);
            return true;
        } catch (RuntimeException e) {
            System.err.println("game " + game.code() + ": could not save its history: " + e);
            return false;
        }
    }

    /**
     * What was played, as stash-ready JSON: {"name", "questions": [...], "steps":
     * [{phase, time, preview, question}]}. Picture references relative to the
     * author (":handle") are written out in full ("author:handle"), so they still
     * point at the author's picture after being copied into someone else's stash.
     */
    Map<String, Object> recordContent(Game game) {
        Map<Long, Map<String, Object>> questions = new LinkedHashMap<>();
        Map<String, Object> results = new LinkedHashMap<>();
        List<Map<String, Object>> steps = new ArrayList<>();
        for (Game.Step s : game.steps) {
            Map<String, Object> step = new LinkedHashMap<>();
            step.put("phase", s.phase().name());
            step.put("time", s.seconds());
            step.put("preview", s.phase().name().toLowerCase());
            Game.QuestionSnap q = s.question();
            step.put("question", q == null ? null : q.id());
            steps.add(step);
            if (q != null && !questions.containsKey(q.id())) {
                Map<String, Object> qm = new LinkedHashMap<>();
                qm.put("key", q.id());
                qm.put("text", q.text());
                qm.put("type", Game.type(q).name());
                qm.put("imageUrl", absolute(q.imageUrl(), game.authorId));
                qm.put("elaborationText", q.elaborationText());
                qm.put("elaborationImageUrl", absolute(q.elaborationImageUrl(), game.authorId));
                List<Map<String, Object>> answers = new ArrayList<>();
                for (Game.AnswerSnap a : q.answers()) {
                    Map<String, Object> am = new LinkedHashMap<>();
                    am.put("text", a.text());
                    am.put("value", a.value());
                    am.put("imageUrl", absolute(a.imageUrl(), game.authorId));
                    answers.add(am);
                }
                qm.put("answers", answers);
                questions.put(q.id(), qm);
                results.put(String.valueOf(q.id()), game.results(q));
            }
        }
        Map<String, Object> content = new LinkedHashMap<>();
        content.put("name", game.quizName);
        content.put("questions", new ArrayList<>(questions.values()));
        content.put("steps", steps);
        // what happened, by question key; left out when it goes to a stash
        content.put("results", results);
        return content;
    }

    /** ":handle" means the author's picture; spell that out so it survives being copied. */
    public static String absolute(String ref, String authorId) {
        if (ref == null || ref.isBlank()) return ref;
        if (ref.startsWith(":") && authorId != null) return authorId + ref;
        return ref;
    }

    private void publish(Game game) {
        Map<String, Object> view;
        synchronized (game) {
            view = view(game);
        }
        messaging.convertAndSend("/topic/play/" + game.code(), (Object) view);
    }

    private Map<String, Object> view(Game game) {
        return game.view(now(), online());
    }

    private Predicate<String> online() {
        return presence::isOnline;
    }

    private Game find(String code) {
        Game game = code == null ? null : games.get(code.trim().toUpperCase());
        if (game == null) throw notFound("No game with that code");
        return game;
    }

    private String newCode() {
        String code;
        do {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < CODE_LENGTH; i++) sb.append(CODE_CHARS.charAt(random.nextInt(CODE_CHARS.length())));
            code = sb.toString();
        } while (games.containsKey(code));
        return code;
    }

    /** The playable steps of a quiz, frozen, so editing it mid-game changes nothing. */
    /**
     * The quiz as the steps a game runs through. SETTING blocks switch settings
     * for everything after them until the next one changes them: questions
     * under "shuffle" swap places among themselves (each keeping its own steps
     * together), "mix" shuffles a question's answers, "grade=off" makes it
     * worth nothing and "points=2" double.
     */
    static List<Game.Step> snapshot(Quiz quiz, Random random) {
        Settings settings = new Settings();
        List<List<Game.Step>> blocks = new ArrayList<>();
        List<Boolean> shuffled = new ArrayList<>();
        Map<Long, Game.QuestionSnap> snaps = new HashMap<>();
        long[] spare = {-1}; // ids for a quiz that was never saved
        Long last = null;
        boolean fresh = true;
        for (Action a : quiz.getActions()) {
            if (a.getPhase() == Phase.SETTING) {
                settings.apply(a.getPreview());
                fresh = true;
                continue;
            }
            if (a.getPhase() == null || !a.getPhase().isPlayable()) continue;
            Question q = a.getQuestion();
            Game.QuestionSnap qs = null;
            if (q != null) {
                if (q.getId() == null) q.setId(spare[0]--);
                qs = snaps.computeIfAbsent(q.getId(), id -> snap(q, settings, random, spare));
            }
            Long key = qs == null ? null : qs.id();
            if (fresh || key == null || !key.equals(last)) {
                blocks.add(new ArrayList<>());
                shuffled.add(settings.shuffle);
            }
            blocks.get(blocks.size() - 1).add(new Game.Step(a.getPhase(), Math.max(1, a.getTime()), qs));
            last = key;
            fresh = false;
        }
        for (int i = 0; i < blocks.size(); ) {
            if (!shuffled.get(i)) { i++; continue; }
            int j = i;
            while (j < blocks.size() && shuffled.get(j)) j++;
            Collections.shuffle(blocks.subList(i, j), random);
            i = j;
        }
        List<Game.Step> steps = new ArrayList<>();
        blocks.forEach(steps::addAll);
        return steps;
    }

    private static Game.QuestionSnap snap(Question q, Settings settings, Random random, long[] spare) {
        List<Game.AnswerSnap> answers = new ArrayList<>();
        for (Answer ans : q.getAnswers()) {
            long id = ans.getId() != null ? ans.getId() : spare[0]--;
            answers.add(new Game.AnswerSnap(id, ans.getText(), ans.getImageUrl(), ans.getValue()));
        }
        if (settings.mix) Collections.shuffle(answers, random);
        return new Game.QuestionSnap(q.getId(), q.getText(), q.getImageUrl(), q.getType(),
                q.getElaborationText(), q.getElaborationImageUrl(), answers, settings.weight());
    }

    /** What a SETTING block can switch, e.g. "shuffle=on, points=2". */
    static final class Settings {
        boolean shuffle;
        boolean mix;
        boolean grade = true;
        int points = 100;

        void apply(String text) {
            if (text == null) return;
            for (String part : text.split("[,;]")) {
                String[] kv = part.trim().split("\\s*=\\s*", 2);
                String key = kv[0].trim().toLowerCase();
                String value = kv.length > 1 ? kv[1].trim().toLowerCase() : "on";
                boolean on = !List.of("off", "false", "no", "0").contains(value);
                switch (key) {
                    case "shuffle" -> shuffle = on;
                    case "mix" -> mix = on;
                    case "grade" -> grade = on;
                    case "points" -> points = percent(value);
                    default -> { /* unknown: ignored, so older servers survive newer quizzes */ }
                }
            }
        }

        int weight() {
            return grade ? points : 0;
        }

        private static int percent(String value) {
            try {
                double x = Double.parseDouble(value.replaceFirst("^[x×]", ""));
                return (int) Math.max(0, Math.min(1000, Math.round(x * 100)));
            } catch (NumberFormatException e) {
                return 100;
            }
        }
    }

    long now() {
        return System.currentTimeMillis();
    }

    private static ResponseStatusException notFound(String message) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, message);
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
