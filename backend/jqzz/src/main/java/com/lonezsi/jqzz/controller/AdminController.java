package com.lonezsi.jqzz.controller;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.lonezsi.jqzz.config.LoginKeyFilter;
import com.lonezsi.jqzz.game.GameEngine;
import com.lonezsi.jqzz.model.GameRecord;
import com.lonezsi.jqzz.model.Image;
import com.lonezsi.jqzz.model.ImageVisibility;
import com.lonezsi.jqzz.model.Notification;
import com.lonezsi.jqzz.model.Quiz;
import com.lonezsi.jqzz.model.StashItem;
import com.lonezsi.jqzz.model.User;
import com.lonezsi.jqzz.repository.DrawingRepository;
import com.lonezsi.jqzz.repository.GameRecordRepository;
import com.lonezsi.jqzz.repository.ImageRepository;
import com.lonezsi.jqzz.repository.QuizRepository;
import com.lonezsi.jqzz.repository.StashItemRepository;
import com.lonezsi.jqzz.repository.UserRepository;
import com.lonezsi.jqzz.service.NotificationService;
import com.lonezsi.jqzz.service.QuizService;
import com.lonezsi.jqzz.util.AdminSecret;
import com.lonezsi.jqzz.util.IdGenerator;

/**
 * The admin panel's API: everything, everyone's. Two locks in front of it. The
 * request must carry the admin account's login key, and then the answer to its
 * second question, "name of your first pet", trades for a short-lived token
 * that every other route here wants in X-Admin-Token. Anyone else gets a 404,
 * as if there were nothing here.
 */
@RestController
@RequestMapping("/admin")
public class AdminController {

    public static final String TOKEN = "X-Admin-Token";
    static final long TOKEN_MS = TimeUnit.HOURS.toMillis(2);
    static final int TRIES = 5;
    static final long LOCKOUT_MS = TimeUnit.MINUTES.toMillis(15);

    private final UserRepository users;
    private final QuizService quizzes;
    private final QuizRepository quizRepo;
    private final GameRecordRepository records;
    private final DrawingRepository drawings;
    private final ImageRepository images;
    private final StashItemRepository stash;
    private final NotificationService notifications;
    private final GameEngine engine;
    private final SimpMessagingTemplate messaging;

    private final SecureRandom random = new SecureRandom();
    /** token -> when it stops working */
    private final Map<String, Long> tokens = new ConcurrentHashMap<>();
    private int failures;
    private long lockedUntil;

    public AdminController(UserRepository users, QuizService quizzes, QuizRepository quizRepo, GameRecordRepository records,
            DrawingRepository drawings, ImageRepository images, StashItemRepository stash,
            NotificationService notifications, GameEngine engine, SimpMessagingTemplate messaging) {
        this.users = users;
        this.quizzes = quizzes;
        this.quizRepo = quizRepo;
        this.records = records;
        this.drawings = drawings;
        this.images = images;
        this.stash = stash;
        this.notifications = notifications;
        this.engine = engine;
        this.messaging = messaging;
    }

    // ─── the two locks ─────────────────────────────────────────────────

    /** Is this the admin account? Says nothing either way to anyone else. */
    @GetMapping("/question")
    public Map<String, Object> question(@RequestAttribute(value = LoginKeyFilter.USER, required = false) String me) {
        admin(me);
        return Map.of("question", "Name of your first pet");
    }

    @PostMapping("/unlock")
    public Map<String, Object> unlock(@RequestAttribute(value = LoginKeyFilter.USER, required = false) String me,
            @RequestBody Map<String, String> body) {
        User admin = admin(me);
        long now = System.currentTimeMillis();
        synchronized (this) {
            if (now < lockedUntil) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                        "Too many wrong answers. Try again in " + minutes(lockedUntil - now) + ".");
            }
            if (!AdminSecret.matches(body.get("answer"), admin.getAdminAnswer())) {
                if (++failures >= TRIES) {
                    failures = 0;
                    lockedUntil = now + LOCKOUT_MS;
                }
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "That's not it");
            }
            failures = 0;
        }
        tokens.values().removeIf(until -> until < now);
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        tokens.put(token, now + TOKEN_MS);
        return Map.of("token", token, "expiresAt", now + TOKEN_MS);
    }

    @PostMapping("/lock")
    public ResponseEntity<Void> lock(@RequestHeader(value = TOKEN, required = false) String token) {
        if (token != null) tokens.remove(token);
        return ResponseEntity.noContent().build();
    }

    private User admin(String me) {
        User u = me == null ? null : users.findById(me).orElse(null);
        if (u == null || !u.isAdmin()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return u;
    }

    /** both locks open: the admin's key on the request, and a token that hasn't run out */
    private User unlocked(String me, String token) {
        User u = admin(me);
        Long until = token == null ? null : tokens.get(token);
        if (until == null || until < System.currentTimeMillis()) {
            if (token != null) tokens.remove(token);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Locked: answer the question again");
        }
        return u;
    }

    private static String minutes(long ms) {
        long m = Math.max(1, (ms + 59_999) / 60_000);
        return m == 1 ? "a minute" : m + " minutes";
    }

    // ─── at a glance ───────────────────────────────────────────────────

    @GetMapping("/overview")
    public Map<String, Object> overview(@RequestAttribute(value = LoginKeyFilter.USER, required = false) String me,
            @RequestHeader(value = TOKEN, required = false) String token) {
        unlocked(me, token);
        List<User> people = users.findAll().stream().filter(u -> !u.isAdmin()).toList();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("users", people.size());
        m.put("online", people.stream().filter(User::isOnline).count());
        m.put("quizzes", quizzes.findAll().size());
        m.put("games", engine.everyGame().size());
        m.put("liveGames", engine.liveGames());
        m.put("records", records.count());
        m.put("images", images.count());
        m.put("stash", stash.count());
        return m;
    }

    // ─── people ────────────────────────────────────────────────────────

    @GetMapping("/users")
    public List<Map<String, Object>> users(@RequestAttribute(value = LoginKeyFilter.USER, required = false) String me,
            @RequestHeader(value = TOKEN, required = false) String token) {
        unlocked(me, token);
        Map<String, Integer> made = new HashMap<>();
        for (Quiz q : quizzes.findAll()) if (q.getAuthorId() != null) made.merge(q.getAuthorId(), 1, Integer::sum);
        List<Map<String, Object>> out = new ArrayList<>();
        for (User u : users.findAll()) {
            if (u.isAdmin()) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", u.getId());
            m.put("handle", u.getHandle());
            m.put("name", u.getName());
            m.put("email", u.getEmail());
            m.put("profilePictureUrl", u.getProfilePictureUrl());
            m.put("online", u.isOnline());
            m.put("googleLinked", u.isGoogleLinked());
            m.put("hasKey", u.getLoginKey() != null);
            m.put("quizzes", made.getOrDefault(u.getId(), 0));
            out.add(m);
        }
        out.sort(Comparator.comparing(m -> String.valueOf(m.get("name")).toLowerCase()));
        return out;
    }

    @PatchMapping("/users/{id}")
    public Map<String, Object> editUser(@RequestAttribute(value = LoginKeyFilter.USER, required = false) String me,
            @RequestHeader(value = TOKEN, required = false) String token,
            @PathVariable String id, @RequestBody Map<String, String> body) {
        unlocked(me, token);
        User u = person(id);
        String name = body.get("name");
        if (name != null) {
            if (name.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A name can't be empty");
            u.setName(name.trim());
        }
        String handle = body.get("handle");
        if (handle != null && !handle.equals(u.getHandle())) {
            String clean = handle.trim().toLowerCase();
            if (!clean.matches("[a-z0-9_.-]{2,32}")) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "A handle is 2 to 32 of a-z, 0-9, dot, dash and underscore");
            }
            if (users.existsByHandle(clean)) throw new ResponseStatusException(HttpStatus.CONFLICT, "That handle is taken");
            u.setHandle(clean);
        }
        String email = body.get("email");
        if (email != null) u.setEmail(email.isBlank() ? null : email.trim());
        if (body.containsKey("profilePictureUrl")) {
            String pic = body.get("profilePictureUrl");
            u.setProfilePictureUrl(pic == null || pic.isBlank() ? null : pic.trim());
        }
        User saved = users.save(u);
        messaging.convertAndSend("/topic/users", (Object) Map.of("event", "user_updated", "user", saved));
        return Map.of("id", saved.getId(), "handle", saved.getHandle(), "name", saved.getName());
    }

    /** A new login key; the old one stops working. Shown here once, to hand to its owner. */
    @PostMapping("/users/{id}/key")
    public Map<String, Object> newKey(@RequestAttribute(value = LoginKeyFilter.USER, required = false) String me,
            @RequestHeader(value = TOKEN, required = false) String token, @PathVariable String id) {
        unlocked(me, token);
        User u = person(id);
        u.setLoginKey(IdGenerator.loginKey());
        users.save(u);
        return Map.of("loginKey", u.getLoginKey());
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(@RequestAttribute(value = LoginKeyFilter.USER, required = false) String me,
            @RequestHeader(value = TOKEN, required = false) String token, @PathVariable String id) {
        unlocked(me, token);
        person(id);
        users.deleteById(id);
        messaging.convertAndSend("/topic/users", (Object) Map.of("event", "user_deleted", "user", Map.of("id", id)));
        return ResponseEntity.noContent().build();
    }

    /** anyone but the admin itself, which the panel can't edit or delete */
    private User person(String id) {
        User u = users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such account"));
        if (u.isAdmin()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not the admin account");
        return u;
    }

    // ─── quizzes ───────────────────────────────────────────────────────

    @GetMapping("/quizzes")
    public List<Map<String, Object>> quizzes(@RequestAttribute(value = LoginKeyFilter.USER, required = false) String me,
            @RequestHeader(value = TOKEN, required = false) String token) {
        unlocked(me, token);
        Map<String, String> names = names();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Quiz q : quizzes.findAll()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", q.getId());
            m.put("name", q.getName());
            m.put("authorId", q.getAuthorId());
            m.put("authorName", q.getAuthorId() == null ? null : names.get(q.getAuthorId()));
            m.put("questions", q.getQuestions().size());
            out.add(m);
        }
        out.sort(Comparator.comparing(m -> -((Long) m.get("id"))));
        return out;
    }

    /** the whole quiz, replaced; whoever made it */
    @PutMapping("/quizzes/{id}")
    public Quiz putQuiz(@RequestAttribute(value = LoginKeyFilter.USER, required = false) String me,
            @RequestHeader(value = TOKEN, required = false) String token,
            @PathVariable Long id, @RequestBody Quiz quiz) {
        unlocked(me, token);
        return quizzes.update(id, quiz).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such quiz"));
    }

    /** a new name or a new author, without touching the questions */
    @PatchMapping("/quizzes/{id}")
    public Map<String, Object> patchQuiz(@RequestAttribute(value = LoginKeyFilter.USER, required = false) String me,
            @RequestHeader(value = TOKEN, required = false) String token,
            @PathVariable Long id, @RequestBody Map<String, String> body) {
        unlocked(me, token);
        Quiz q = quizRepo.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such quiz"));
        String name = body.get("name");
        if (name != null && !name.isBlank()) q.setName(name.trim());
        if (body.containsKey("authorId")) {
            String author = body.get("authorId");
            if (author != null && !author.isBlank() && !users.existsById(author)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No such account");
            }
            q.setAuthorId(author == null || author.isBlank() ? null : author);
        }
        Quiz saved = quizRepo.save(q);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", saved.getId());
        m.put("name", saved.getName());
        m.put("authorId", saved.getAuthorId());
        return m;
    }

    @DeleteMapping("/quizzes/{id}")
    public ResponseEntity<Void> deleteQuiz(@RequestAttribute(value = LoginKeyFilter.USER, required = false) String me,
            @RequestHeader(value = TOKEN, required = false) String token, @PathVariable Long id) {
        unlocked(me, token);
        return quizzes.delete(id) ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    // ─── games under way ───────────────────────────────────────────────

    @GetMapping("/games")
    public List<Map<String, Object>> games(@RequestAttribute(value = LoginKeyFilter.USER, required = false) String me,
            @RequestHeader(value = TOKEN, required = false) String token) {
        unlocked(me, token);
        Map<String, String> names = names();
        List<Map<String, Object>> out = engine.everyGame();
        for (Map<String, Object> g : out) g.put("hostName", names.get((String) g.get("hostId")));
        return out;
    }

    /** start, pause, resume, skip, end, restart; or kick with ?playerId= */
    @PostMapping("/games/{code}/{action}")
    public Map<String, Object> control(@RequestAttribute(value = LoginKeyFilter.USER, required = false) String me,
            @RequestHeader(value = TOKEN, required = false) String token,
            @PathVariable String code, @PathVariable String action,
            @RequestParam(value = "playerId", required = false) String playerId) {
        unlocked(me, token);
        engine.force(code, action, playerId);
        return Map.of("ok", true);
    }

    // ─── history ───────────────────────────────────────────────────────

    @GetMapping("/history")
    public List<Map<String, Object>> history(@RequestAttribute(value = LoginKeyFilter.USER, required = false) String me,
            @RequestHeader(value = TOKEN, required = false) String token) {
        unlocked(me, token);
        Map<String, String> names = names();
        List<Map<String, Object>> out = new ArrayList<>();
        for (GameRecord r : records.findAll()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.getId());
            m.put("code", r.getCode());
            m.put("quizName", r.getQuizName());
            m.put("hostName", names.get(r.getHostId()));
            m.put("finishedAt", r.getFinishedAt());
            m.put("players", r.getPlayers().stream().map(p -> Map.of(
                    "name", p.name() == null ? "" : p.name(), "score", p.score(), "ranking", p.ranking())).toList());
            out.add(m);
        }
        out.sort(Comparator.comparing(m -> -((Long) m.get("id"))));
        return out;
    }

    @Transactional
    @DeleteMapping("/history/{id}")
    public ResponseEntity<Void> deleteRecord(@RequestAttribute(value = LoginKeyFilter.USER, required = false) String me,
            @RequestHeader(value = TOKEN, required = false) String token, @PathVariable Long id) {
        unlocked(me, token);
        if (!records.existsById(id)) return ResponseEntity.notFound().build();
        drawings.deleteAll(drawings.findByRecordId(id));
        records.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ─── pictures ──────────────────────────────────────────────────────

    @GetMapping("/images")
    public List<Map<String, Object>> images(@RequestAttribute(value = LoginKeyFilter.USER, required = false) String me,
            @RequestHeader(value = TOKEN, required = false) String token) {
        unlocked(me, token);
        Map<String, String> names = names();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Image i : images.findAll()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", i.getId());
            m.put("handle", i.getHandle());
            m.put("visibility", i.getVisibility());
            m.put("uploadedBy", names.get(i.getUploadedBy() != null ? i.getUploadedBy() : i.getOwnerId()));
            m.put("mimeType", i.getMimeType());
            m.put("size", i.getData() == null ? 0 : i.getData().length);
            m.put("createdAt", i.getCreatedAt());
            out.add(m);
        }
        out.sort(Comparator.comparing(m -> -((Long) m.get("id"))));
        return out;
    }

    /** the picture itself, whoever it belongs to */
    @GetMapping("/images/{id}")
    public ResponseEntity<byte[]> image(@RequestAttribute(value = LoginKeyFilter.USER, required = false) String me,
            @RequestHeader(value = TOKEN, required = false) String token, @PathVariable Long id) {
        unlocked(me, token);
        Image i = images.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return ResponseEntity.ok().header("Content-Type", i.getMimeType()).body(i.getData());
    }

    /** a public picture belongs to nobody; making one private gives it back to whoever uploaded it */
    @PatchMapping("/images/{id}")
    public Map<String, Object> imageVisibility(@RequestAttribute(value = LoginKeyFilter.USER, required = false) String me,
            @RequestHeader(value = TOKEN, required = false) String token,
            @PathVariable Long id, @RequestBody Map<String, String> body) {
        unlocked(me, token);
        Image i = images.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        ImageVisibility v;
        try {
            v = ImageVisibility.valueOf(String.valueOf(body.get("visibility")));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "PUBLIC, PRIVATE or SEMI_PRIVATE");
        }
        if (v == ImageVisibility.PUBLIC) {
            i.setOwnerId(null);
        } else if (i.getOwnerId() == null) {
            if (i.getUploadedBy() == null) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Nobody is known to have uploaded it");
            }
            i.setOwnerId(i.getUploadedBy());
        }
        i.setVisibility(v);
        try {
            images.saveAndFlush(i);
        } catch (RuntimeException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Another picture already has that handle there");
        }
        return Map.of("id", i.getId(), "visibility", v);
    }

    @DeleteMapping("/images/{id}")
    public ResponseEntity<Void> deleteImage(@RequestAttribute(value = LoginKeyFilter.USER, required = false) String me,
            @RequestHeader(value = TOKEN, required = false) String token, @PathVariable Long id) {
        unlocked(me, token);
        if (!images.existsById(id)) return ResponseEntity.notFound().build();
        images.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ─── stash ─────────────────────────────────────────────────────────

    @GetMapping("/stash")
    public List<Map<String, Object>> stash(@RequestAttribute(value = LoginKeyFilter.USER, required = false) String me,
            @RequestHeader(value = TOKEN, required = false) String token) {
        unlocked(me, token);
        Map<String, String> names = names();
        List<Map<String, Object>> out = new ArrayList<>();
        for (StashItem s : stash.findAll()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", s.getId());
            m.put("kind", s.getKind());
            m.put("handle", s.getHandle());
            m.put("title", s.getTitle());
            m.put("visibility", s.getVisibility());
            m.put("savedBy", names.get(s.getSavedBy()));
            m.put("createdAt", s.getCreatedAt());
            out.add(m);
        }
        out.sort(Comparator.comparing(m -> -((Long) m.get("id"))));
        return out;
    }

    @DeleteMapping("/stash/{id}")
    public ResponseEntity<Void> deleteStash(@RequestAttribute(value = LoginKeyFilter.USER, required = false) String me,
            @RequestHeader(value = TOKEN, required = false) String token, @PathVariable Long id) {
        unlocked(me, token);
        if (!stash.existsById(id)) return ResponseEntity.notFound().build();
        stash.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ─── telling everyone ──────────────────────────────────────────────

    @PostMapping("/announce")
    public Map<String, Object> announce(@RequestAttribute(value = LoginKeyFilter.USER, required = false) String me,
            @RequestHeader(value = TOKEN, required = false) String token, @RequestBody Map<String, String> body) {
        unlocked(me, token);
        String text = body.get("text") == null ? "" : body.get("text").trim();
        if (text.isEmpty() || text.length() > 500) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Say something, in 500 characters or fewer");
        }
        int sent = 0;
        for (User u : users.findAll()) {
            if (u.isAdmin()) continue;
            notifications.notify(u.getId(), Notification.ANNOUNCEMENT, null, Map.of("text", text));
            sent++;
        }
        return Map.of("sent", sent);
    }

    /** id -> name, for showing who rather than an id */
    private Map<String, String> names() {
        Map<String, String> m = new HashMap<>();
        for (User u : users.findAll()) m.put(u.getId(), u.isAdmin() ? "Admin" : u.getName());
        return m;
    }
}
