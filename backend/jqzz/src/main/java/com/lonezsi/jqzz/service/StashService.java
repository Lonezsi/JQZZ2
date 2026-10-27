package com.lonezsi.jqzz.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.lonezsi.jqzz.game.GameEngine;
import com.lonezsi.jqzz.model.Action;
import com.lonezsi.jqzz.model.Answer;
import com.lonezsi.jqzz.model.GameRecord;
import com.lonezsi.jqzz.model.ImageVisibility;
import com.lonezsi.jqzz.model.Phase;
import com.lonezsi.jqzz.model.Question;
import com.lonezsi.jqzz.model.QuestionType;
import com.lonezsi.jqzz.model.Quiz;
import com.lonezsi.jqzz.model.StashItem;
import com.lonezsi.jqzz.model.StashKind;
import com.lonezsi.jqzz.repository.GameRecordRepository;
import com.lonezsi.jqzz.repository.QuizRepository;
import com.lonezsi.jqzz.repository.StashItemRepository;
import com.lonezsi.jqzz.repository.UserRepository;
import com.lonezsi.jqzz.model.User;

import tools.jackson.databind.json.JsonMapper;

/**
 * Everyone's stash: quizzes, questions and images they saved to use again.
 *
 * Quizzes and questions are kept as JSON in the shape a finished game records
 * them ({"name", "questions": [{key, text, type, answers, ...}], "steps":
 * [{phase, time, preview, question: key}]}; a single question keeps just its
 * own steps), so a stashed quiz can be opened as a brand new quiz and a stashed
 * question dropped into any quiz. Images are kept by reference to the image
 * library. Naming and visibility follow the image rules, see {@link StashItem}.
 */
@Service
public class StashService {

    private static final String HANDLE = "^[a-zA-Z0-9_]+$";

    private final StashItemRepository stash;
    private final GameRecordRepository records;
    private final QuizRepository quizzes;
    private final QuizService quizService;
    private final ImageService images;
    private final UserRepository users;
    private final JsonMapper json;

    public StashService(StashItemRepository stash, GameRecordRepository records, QuizRepository quizzes,
            QuizService quizService, ImageService images, UserRepository users, JsonMapper json) {
        this.stash = stash;
        this.records = records;
        this.quizzes = quizzes;
        this.quizService = quizService;
        this.images = images;
        this.users = users;
        this.json = json;
    }

    /** Everything you saved. The first time, the default question types are put in. */
    @Transactional
    public List<StashItem> list(String userId) {
        require(userId);
        users.findById(userId).filter(u -> !Boolean.TRUE.equals(u.getTypesSeeded())).ifPresent(u -> {
            addDefaultTypes(userId, false);
            u.setTypesSeeded(true);
            users.save(u);
        });
        return stash.findBySavedByOrderByCreatedAtDesc(userId);
    }

    // ─── question types ────────────────────────────────────────────────

    /**
     * The shapes a new question can take, as everyone starts with them: a
     * type, its steps, and its answer slots. Stash items of kind TYPE hold
     * {"name", "questionType", "answers": [{text, value}], "steps": [{phase, time, preview}]}.
     */
    static final List<Map<String, Object>> DEFAULT_TYPES = List.of(
            type("Full MC question", "PREWRITTEN_SINGLE", 4,
                    step("WAITING", 8, "Pre-question buffer"), step("QUESTION", 30, "Multiple-choice question"),
                    step("ANSWER", 12, "Answer reveal"), step("RESULT", 10, "Leaderboard update")),
            type("True / False", "PREWRITTEN_SINGLE", List.of(answer("True", 100), answer("False", 0)),
                    step("WAITING", 6, "Pre-question buffer"), step("QUESTION", 20, "True or False?"),
                    step("ANSWER", 8, "Answer reveal")),
            type("Question + explain", "PREWRITTEN_SINGLE", 4,
                    step("WAITING", 8, "Pre-question buffer"), step("QUESTION", 30, "Question phase"),
                    step("ANSWER", 10, "Answer locked"), step("ELABORATION", 20, "Deep-dive explanation"),
                    step("RESULT", 10, "Leaderboard update")),
            type("User-gen + vote", "USER_GENERATED_VOTE", 0,
                    step("WAITING", 6, "Pre-question buffer"), step("QUESTION", 40, "Players submit answers"),
                    step("ANSWER", 20, "Vote on best answer"), step("RESULT", 12, "Winner revealed")),
            type("Tier list round", "TIERLIST", 4,
                    step("WAITING", 6, "Pre-question buffer"), step("QUESTION", 60, "Drag items into tiers"),
                    step("RESULT", 15, "Group tier comparison")),
            type("Lightning round", "PREWRITTEN_SINGLE", 4,
                    step("WAITING", 3, "Quick buffer"), step("QUESTION", 10, "Fast question"),
                    step("ANSWER", 5, "Answer reveal")));

    /**
     * full: your types are thrown away and the defaults put back.
     * add: the defaults you don't have (by name) are added, nothing is removed.
     */
    @Transactional
    public List<StashItem> resetTypes(String userId, boolean full) {
        require(userId);
        if (full) stash.deleteAll(stash.findBySavedByAndKind(userId, StashKind.TYPE));
        addDefaultTypes(userId, !full);
        return stash.findBySavedByAndKind(userId, StashKind.TYPE);
    }

    private void addDefaultTypes(String userId, boolean skipExisting) {
        Set<String> have = new LinkedHashSet<>();
        if (skipExisting) stash.findBySavedByAndKind(userId, StashKind.TYPE).forEach(i -> have.add(i.getTitle()));
        for (Map<String, Object> t : DEFAULT_TYPES) {
            String name = (String) t.get("name");
            if (!have.contains(name)) store(StashKind.TYPE, name, "default", t, userId);
        }
    }

    /**
     * A question's shape as a new type: from a game you were in (recordId +
     * questionKey) or from a question in your stash (itemId).
     */
    @Transactional
    public StashItem asType(String userId, Long recordId, Long questionKey, Long itemId, String title) {
        require(userId);
        Map<String, Object> single;
        String source;
        if (itemId != null) {
            StashItem item = get(itemId, userId);
            if (item.getKind() != StashKind.QUESTION) throw bad("Only a question has a type to save");
            single = read(item.getPayload());
            source = item.getTitle();
        } else {
            GameRecord record = records.findById(recordId == null ? -1 : recordId)
                    .orElseThrow(() -> notFound("No such game"));
            if (!record.involves(userId)) throw forbidden("You weren't in that game");
            single = questionKey == null ? null : singleQuestion(read(record.getContent()), questionKey);
            if (single == null) throw notFound("That question isn't in this game");
            source = record.getQuizName();
        }
        Map<String, Object> shape = shapeOf(single);
        if (title != null && !title.isBlank()) shape.put("name", title.trim());
        return store(StashKind.TYPE, (String) shape.get("name"), source, shape, userId).get(0);
    }

    /** What a question looks like with its words taken out. */
    @SuppressWarnings("unchecked")
    static Map<String, Object> shapeOf(Map<String, Object> single) {
        List<Map<String, Object>> qs = (List<Map<String, Object>>) single.getOrDefault("questions", List.of());
        Map<String, Object> q = qs.isEmpty() ? Map.of() : qs.get(0);
        String type = str(q.get("type")) == null ? "PREWRITTEN_SINGLE" : str(q.get("type"));
        List<Map<String, Object>> answers = new ArrayList<>();
        for (Map<String, Object> a : (List<Map<String, Object>>) q.getOrDefault("answers", List.of())) {
            answers.add(answer("", a.get("value") instanceof Number n ? n.intValue() : 0));
        }
        List<Map<String, Object>> steps = new ArrayList<>();
        for (Map<String, Object> s : (List<Map<String, Object>>) single.getOrDefault("steps", List.of())) {
            steps.add(step(String.valueOf(s.get("phase")), s.get("time") instanceof Number n ? n.intValue() : 10,
                    str(s.get("preview"))));
        }
        Map<String, Object> shape = new LinkedHashMap<>();
        shape.put("name", type.toLowerCase().replace('_', ' ') + " shape");
        shape.put("questionType", type);
        shape.put("answers", answers);
        shape.put("steps", steps);
        return shape;
    }

    @SafeVarargs
    private static Map<String, Object> type(String name, String questionType, int blanks, Map<String, Object>... steps) {
        List<Map<String, Object>> answers = new ArrayList<>();
        for (int i = 0; i < blanks; i++) answers.add(answer("", i == 0 ? 100 : 0));
        return type(name, questionType, answers, steps);
    }

    @SafeVarargs
    private static Map<String, Object> type(String name, String questionType, List<Map<String, Object>> answers,
            Map<String, Object>... steps) {
        Map<String, Object> t = new LinkedHashMap<>();
        t.put("name", name);
        t.put("questionType", questionType);
        t.put("answers", answers);
        t.put("steps", List.of(steps));
        return t;
    }

    private static Map<String, Object> step(String phase, int time, String preview) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("phase", phase);
        s.put("time", time);
        s.put("preview", preview);
        return s;
    }

    private static Map<String, Object> answer(String text, int value) {
        Map<String, Object> a = new LinkedHashMap<>();
        a.put("text", text);
        a.put("value", value);
        return a;
    }

    // ─── putting things in ─────────────────────────────────────────────

    /** A question from a game you were in, or the whole quiz when questionKey is null. */
    @Transactional
    public List<StashItem> fromGame(Long recordId, Long questionKey, String userId) {
        require(userId);
        GameRecord record = records.findById(recordId == null ? -1 : recordId)
                .orElseThrow(() -> notFound("No such game"));
        if (!record.involves(userId)) throw forbidden("You weren't in that game");
        Map<String, Object> content = new LinkedHashMap<>(read(record.getContent()));
        content.remove("results"); // what happened that night stays in the history
        String source = record.getQuizName();
        if (questionKey == null) {
            return store(StashKind.QUIZ, nameOf(content, "quiz"), source, content, userId);
        }
        Map<String, Object> single = singleQuestion(content, questionKey);
        if (single == null) throw notFound("That question isn't in this game");
        return store(StashKind.QUESTION, titleOf(single), source, single, userId);
    }

    /** A quiz from the editor, as it is now. */
    @Transactional
    public List<StashItem> fromQuiz(Long quizId, String userId) {
        require(userId);
        Quiz quiz = quizzes.findById(quizId == null ? -1 : quizId).orElseThrow(() -> notFound("No such quiz"));
        Map<String, Object> content = quizContent(quiz);
        return store(StashKind.QUIZ, nameOf(content, "quiz"), quiz.getName(), content, userId);
    }

    /** Someone else's public or semi-private item, copied into your own stash. */
    @Transactional
    public StashItem fromReference(StashKind kind, String ref, String userId) {
        require(userId);
        StashItem original = resolve(kind, ref, userId).orElseThrow(() -> notFound("Nothing you can see is called " + ref));
        StashItem copy = new StashItem();
        copy.setKind(original.getKind());
        copy.setTitle(original.getTitle());
        copy.setSource(ref);
        copy.setPayload(original.getPayload());
        copy.setImageId(original.getImageId());
        copy.setSavedBy(userId);
        copy.setVisibility(ImageVisibility.PRIVATE);
        copy.setOwnerId(userId);
        copy.setHandle(freeHandle(original.getKind(), original.getHandle(), userId));
        copy.setCreatedAt(LocalDateTime.now());
        return stash.save(copy);
    }

    // ─── changing and removing ─────────────────────────────────────────

    /** New handle, title or visibility. Handles follow the image rules for the namespace it lands in. */
    @Transactional
    public StashItem update(Long id, String userId, String handle, ImageVisibility visibility, String title) {
        return update(id, userId, handle, visibility, title, null);
    }

    /** payload: a type's new shape, as JSON. Only types are edited this way. */
    @Transactional
    @SuppressWarnings("unchecked")
    public StashItem update(Long id, String userId, String handle, ImageVisibility visibility, String title,
            String payload) {
        StashItem item = mine(id, userId);
        if (payload != null) {
            if (item.getKind() != StashKind.TYPE) throw bad("Only a question type can be edited");
            Map<String, Object> shape;
            try {
                shape = json.readValue(payload, Map.class);
            } catch (RuntimeException e) {
                throw bad("That isn't a question type");
            }
            if (!(shape.get("steps") instanceof List<?> steps) || steps.isEmpty()) {
                throw bad("A question type needs at least one step");
            }
            item.setPayload(json.writeValueAsString(shape));
        }
        String newHandle = handle == null || handle.isBlank() ? item.getHandle() : handle.trim();
        if (!newHandle.matches(HANDLE)) {
            throw bad("Handle must contain only letters, numbers, and underscores");
        }
        ImageVisibility newVisibility = visibility == null ? item.getVisibility() : visibility;
        String newOwner = newVisibility == ImageVisibility.PUBLIC ? null : item.getSavedBy();
        boolean moved = !newHandle.equals(item.getHandle()) || !Objects.equals(newOwner, item.getOwnerId());
        if (moved) {
            boolean taken = newOwner == null
                    ? stash.existsByKindAndHandleAndOwnerIdIsNull(item.getKind(), newHandle)
                    : stash.existsByKindAndOwnerIdAndHandle(item.getKind(), newOwner, newHandle);
            if (taken) {
                throw conflict(newOwner == null
                        ? "Another public " + item.getKind().name().toLowerCase() + " is already called " + newHandle
                        : "You already have a " + item.getKind().name().toLowerCase() + " called " + newHandle);
            }
        }
        item.setHandle(newHandle);
        item.setOwnerId(newOwner);
        item.setVisibility(newVisibility);
        if (title != null && !title.isBlank()) item.setTitle(title.trim());
        return stash.save(item);
    }

    @Transactional
    public void delete(Long id, String userId) {
        stash.delete(mine(id, userId));
    }

    // ─── finding and using ─────────────────────────────────────────────

    /** Public items of a kind, newest first, whose title or name has the words in it. */
    @Transactional(readOnly = true)
    public List<StashItem> browse(StashKind kind, String query) {
        String q = query == null ? "" : query.trim().toLowerCase();
        return stash.findTop200ByKindAndOwnerIdIsNullOrderByCreatedAtDesc(kind).stream()
                .filter(i -> q.isEmpty()
                        || (i.getTitle() != null && i.getTitle().toLowerCase().contains(q))
                        || i.getHandle().toLowerCase().contains(q))
                .limit(60)
                .toList();
    }

    /** What someone made public: the shelf on their profile. */
    @Transactional(readOnly = true)
    public List<StashItem> publicOf(String userId) {
        return stash.findBySavedByAndOwnerIdIsNullOrderByCreatedAtDesc(userId);
    }

    /** A stashed quiz or question as a quiz that is never saved, to practice on. */
    @Transactional(readOnly = true)
    public Quiz practiceQuiz(Long id, String userId) {
        StashItem item = get(id, userId);
        if (item.getKind() == StashKind.IMAGE) throw bad("A picture can't be played");
        Map<String, Object> content = read(item.getPayload());
        Quiz quiz = new Quiz();
        quiz.setName(nameOf(content, item.getTitle()));
        quiz.setActions(actionsOf(content));
        return quiz;
    }

    /**
     * The image rules, for stash items: "handle" is public, ":handle" is your own,
     * "owner:handle" is someone else's and only reachable when it isn't private.
     */
    @Transactional(readOnly = true)
    public Optional<StashItem> resolve(StashKind kind, String ref, String userId) {
        if (kind == null || ref == null || ref.isBlank()) return Optional.empty();
        String[] parts = ref.trim().split(":", 2);
        if (parts.length == 1) return stash.findByKindAndHandleAndOwnerIdIsNull(kind, parts[0]);
        String owner = parts[0].isEmpty() ? userId : parts[0];
        return stash.findByKindAndOwnerIdAndHandle(kind, owner, parts[1])
                .filter(item -> item.getVisibility() != ImageVisibility.PRIVATE || owner.equals(userId));
    }

    /** One item, if you may see it: yours, or anyone's that isn't private. */
    @Transactional(readOnly = true)
    public StashItem get(Long id, String userId) {
        StashItem item = stash.findById(id == null ? -1 : id).orElseThrow(() -> notFound("No such stash item"));
        if (!item.getSavedBy().equals(userId) && item.getVisibility() == ImageVisibility.PRIVATE) {
            throw forbidden("That one is private");
        }
        return item;
    }

    /** A stashed quiz as a brand new quiz of yours, ready to edit or play. */
    @Transactional
    public Quiz open(Long id, String userId) {
        require(userId);
        StashItem item = get(id, userId);
        if (item.getKind() != StashKind.QUIZ) throw bad("Only a quiz can be opened as a quiz");
        Map<String, Object> content = read(item.getPayload());
        Quiz incoming = new Quiz();
        incoming.setName(nameOf(content, item.getTitle()));
        incoming.setAuthorId(userId);
        incoming.setActions(actionsOf(content));
        return quizService.create(incoming);
    }

    // ─── the shapes ────────────────────────────────────────────────────

    /** A quiz from the editor in the stash shape, picture references made absolute. */
    Map<String, Object> quizContent(Quiz quiz) {
        Map<Long, Map<String, Object>> questions = new LinkedHashMap<>();
        List<Map<String, Object>> steps = new ArrayList<>();
        for (Action a : quiz.getActions()) {
            Map<String, Object> step = new LinkedHashMap<>();
            step.put("phase", a.getPhase() == null ? Phase.TEXT.name() : a.getPhase().name());
            step.put("time", a.getTime());
            step.put("preview", a.getPreview());
            Question q = a.getQuestion();
            step.put("question", q == null ? null : q.getId());
            steps.add(step);
            if (q != null && !questions.containsKey(q.getId())) {
                Map<String, Object> qm = new LinkedHashMap<>();
                qm.put("key", q.getId());
                qm.put("text", q.getText());
                qm.put("type", (q.getType() == null ? QuestionType.PREWRITTEN_SINGLE : q.getType()).name());
                qm.put("imageUrl", GameEngine.absolute(q.getImageUrl(), quiz.getAuthorId()));
                qm.put("elaborationText", q.getElaborationText());
                qm.put("elaborationImageUrl", GameEngine.absolute(q.getElaborationImageUrl(), quiz.getAuthorId()));
                List<Map<String, Object>> answers = new ArrayList<>();
                for (Answer ans : q.getAnswers()) {
                    Map<String, Object> am = new LinkedHashMap<>();
                    am.put("text", ans.getText());
                    am.put("value", ans.getValue());
                    am.put("imageUrl", GameEngine.absolute(ans.getImageUrl(), quiz.getAuthorId()));
                    answers.add(am);
                }
                qm.put("answers", answers);
                questions.put(q.getId(), qm);
            }
        }
        Map<String, Object> content = new LinkedHashMap<>();
        content.put("name", quiz.getName());
        content.put("questions", new ArrayList<>(questions.values()));
        content.put("steps", steps);
        return content;
    }

    /** One question out of a quiz-shaped content, with only its own steps. */
    @SuppressWarnings("unchecked")
    static Map<String, Object> singleQuestion(Map<String, Object> content, Long key) {
        List<Map<String, Object>> questions = (List<Map<String, Object>>) content.getOrDefault("questions", List.of());
        Map<String, Object> question = questions.stream()
                .filter(q -> key.equals(asLong(q.get("key")))).findFirst().orElse(null);
        if (question == null) return null;
        List<Map<String, Object>> steps = ((List<Map<String, Object>>) content.getOrDefault("steps", List.of()))
                .stream().filter(s -> key.equals(asLong(s.get("question")))).toList();
        Map<String, Object> single = new LinkedHashMap<>();
        single.put("name", question.get("text"));
        single.put("questions", List.of(question));
        single.put("steps", steps);
        return single;
    }

    /** The content as actions the quiz service can save, sharing questions by key. */
    @SuppressWarnings("unchecked")
    static List<Action> actionsOf(Map<String, Object> content) {
        Map<Long, Question> byKey = new LinkedHashMap<>();
        long temp = -1;
        for (Map<String, Object> q : (List<Map<String, Object>>) content.getOrDefault("questions", List.of())) {
            Question question = new Question();
            question.setId(temp--); // only used to share one question between its steps
            question.setText(str(q.get("text")));
            question.setImageUrl(str(q.get("imageUrl")));
            question.setElaborationText(str(q.get("elaborationText")));
            question.setElaborationImageUrl(str(q.get("elaborationImageUrl")));
            try {
                question.setType(QuestionType.valueOf(str(q.get("type"))));
            } catch (RuntimeException e) {
                question.setType(QuestionType.PREWRITTEN_SINGLE);
            }
            List<Answer> answers = new ArrayList<>();
            for (Map<String, Object> a : (List<Map<String, Object>>) q.getOrDefault("answers", List.of())) {
                Answer answer = new Answer();
                answer.setText(str(a.get("text")));
                answer.setValue(a.get("value") instanceof Number n ? n.intValue() : 0);
                answer.setImageUrl(str(a.get("imageUrl")));
                answers.add(answer);
            }
            question.setAnswers(answers);
            byKey.put(asLong(q.get("key")), question);
        }
        List<Action> actions = new ArrayList<>();
        for (Map<String, Object> s : (List<Map<String, Object>>) content.getOrDefault("steps", List.of())) {
            Action action = new Action();
            action.setPhase(Phase.fromString(String.valueOf(s.getOrDefault("phase", "TEXT"))));
            action.setTime(s.get("time") instanceof Number n ? n.intValue() : 0);
            action.setPreview(str(s.get("preview")));
            Long key = asLong(s.get("question"));
            if (key != null) action.setQuestion(byKey.get(key));
            actions.add(action);
        }
        return actions;
    }

    // ─── storing ───────────────────────────────────────────────────────

    /**
     * The item itself, then every picture it uses that resolves for you, each as
     * an image item. Your own uploads are left out: they are in your stash anyway.
     */
    private List<StashItem> store(StashKind kind, String title, String source, Map<String, Object> content,
            String userId) {
        List<StashItem> made = new ArrayList<>();
        StashItem item = new StashItem();
        item.setKind(kind);
        item.setTitle(clip(title, 120));
        item.setSource(source);
        item.setPayload(json.writeValueAsString(content));
        item.setSavedBy(userId);
        item.setVisibility(ImageVisibility.PRIVATE);
        item.setOwnerId(userId);
        item.setHandle(freeHandle(kind, title, userId));
        item.setCreatedAt(LocalDateTime.now());
        made.add(stash.save(item));

        for (String ref : imageRefs(content)) {
            images.resolveReference(ref, userId).ifPresent(imageId -> {
                if (images.isUploadedBy(imageId, userId)
                        || stash.existsBySavedByAndKindAndImageId(userId, StashKind.IMAGE, imageId)) return;
                StashItem image = new StashItem();
                image.setKind(StashKind.IMAGE);
                image.setTitle(ref);
                image.setSource(title);
                image.setImageId(imageId);
                image.setSavedBy(userId);
                image.setVisibility(ImageVisibility.PRIVATE);
                image.setOwnerId(userId);
                // named after the picture, not its owner: "anna:sunset" becomes sunset
                image.setHandle(freeHandle(StashKind.IMAGE, ref.substring(ref.indexOf(':') + 1), userId));
                image.setCreatedAt(LocalDateTime.now());
                made.add(stash.save(image));
            });
        }
        return made;
    }

    @SuppressWarnings("unchecked")
    private static Set<String> imageRefs(Map<String, Object> content) {
        Set<String> refs = new LinkedHashSet<>();
        for (Map<String, Object> q : (List<Map<String, Object>>) content.getOrDefault("questions", List.of())) {
            addRef(refs, q.get("imageUrl"));
            addRef(refs, q.get("elaborationImageUrl"));
            for (Map<String, Object> a : (List<Map<String, Object>>) q.getOrDefault("answers", List.of())) {
                addRef(refs, a.get("imageUrl"));
            }
        }
        return refs;
    }

    private static void addRef(Set<String> refs, Object ref) {
        if (ref instanceof String s && !s.isBlank() && !s.matches("^(https?:|data:).*")) refs.add(s);
    }

    /** A handle from a title, free in the stasher's private namespace for that kind. */
    private String freeHandle(StashKind kind, String title, String userId) {
        String base = title == null ? "" : title.toLowerCase().replaceAll("[^a-z0-9]+", "_").replaceAll("^_+|_+$", "");
        if (base.isEmpty()) base = kind.name().toLowerCase();
        if (base.length() > 40) base = base.substring(0, 40).replaceAll("_+$", "");
        String handle = base;
        for (int n = 2; stash.existsByKindAndOwnerIdAndHandle(kind, userId, handle); n++) handle = base + "_" + n;
        return handle;
    }

    // ─── small helpers ─────────────────────────────────────────────────

    private StashItem mine(Long id, String userId) {
        require(userId);
        StashItem item = stash.findById(id == null ? -1 : id).orElseThrow(() -> notFound("No such stash item"));
        if (!item.getSavedBy().equals(userId)) throw forbidden("That isn't in your stash");
        return item;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> read(String payload) {
        if (payload == null || payload.isBlank()) return Map.of();
        return json.readValue(payload, Map.class);
    }

    private static String nameOf(Map<String, Object> content, String fallback) {
        Object name = content.get("name");
        return name instanceof String s && !s.isBlank() ? s : fallback;
    }

    @SuppressWarnings("unchecked")
    private static String titleOf(Map<String, Object> single) {
        List<Map<String, Object>> qs = (List<Map<String, Object>>) single.getOrDefault("questions", List.of());
        String text = qs.isEmpty() ? null : str(qs.get(0).get("text"));
        return text == null || text.isBlank() ? "question" : text;
    }

    private static String clip(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private static Long asLong(Object o) {
        if (o instanceof Number n) return n.longValue();
        if (o instanceof String s && s.matches("-?\\d+")) return Long.parseLong(s);
        return null;
    }

    private static String require(String userId) {
        if (userId == null || userId.isBlank()) throw bad("userId is required");
        return userId;
    }

    private static ResponseStatusException notFound(String m) { return new ResponseStatusException(HttpStatus.NOT_FOUND, m); }
    private static ResponseStatusException forbidden(String m) { return new ResponseStatusException(HttpStatus.FORBIDDEN, m); }
    private static ResponseStatusException bad(String m) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, m); }
    private static ResponseStatusException conflict(String m) { return new ResponseStatusException(HttpStatus.CONFLICT, m); }
}
