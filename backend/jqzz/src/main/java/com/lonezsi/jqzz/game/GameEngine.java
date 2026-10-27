package com.lonezsi.jqzz.game;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
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

import com.lonezsi.jqzz.model.Action;
import com.lonezsi.jqzz.model.Answer;
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

    private final Map<String, Game> games = new ConcurrentHashMap<>();
    private final Map<String, ScheduledFuture<?>> timers = new ConcurrentHashMap<>();
    private final Random random = new SecureRandom();
    private final ScheduledExecutorService clock = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "jqzz-game-clock");
        t.setDaemon(true);
        return t;
    });

    public GameEngine(QuizRepository quizRepository, UserRepository userRepository,
            SimpMessagingTemplate messaging, PresenceTracker presence) {
        this.quizRepository = quizRepository;
        this.userRepository = userRepository;
        this.messaging = messaging;
        this.presence = presence;
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
        List<Game.Step> steps = snapshot(quiz);
        if (steps.stream().noneMatch(s -> s.question() != null)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This quiz has no questions to play yet");
        }
        String code = newCode();
        Game game = new Game(code, hostId, quiz.getName(), steps, new Random(random.nextLong()), now());
        game.authorId = quiz.getAuthorId();
        games.put(code, game);
        return view(game);
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
        return view;
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
    static List<Game.Step> snapshot(Quiz quiz) {
        List<Game.Step> steps = new ArrayList<>();
        for (Action a : quiz.getActions()) {
            if (a.getPhase() == null || !a.getPhase().isPlayable()) continue;
            Question q = a.getQuestion();
            Game.QuestionSnap qs = null;
            if (q != null) {
                List<Game.AnswerSnap> answers = new ArrayList<>();
                for (Answer ans : q.getAnswers()) {
                    answers.add(new Game.AnswerSnap(ans.getId(), ans.getText(), ans.getImageUrl(), ans.getValue()));
                }
                qs = new Game.QuestionSnap(q.getId(), q.getText(), q.getImageUrl(), q.getType(),
                        q.getElaborationText(), q.getElaborationImageUrl(), answers);
            }
            steps.add(new Game.Step(a.getPhase(), Math.max(1, a.getTime()), qs));
        }
        return steps;
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
