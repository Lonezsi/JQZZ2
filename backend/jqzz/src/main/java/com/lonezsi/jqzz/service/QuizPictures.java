package com.lonezsi.jqzz.service;

import java.util.HashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.lonezsi.jqzz.model.Action;
import com.lonezsi.jqzz.model.Answer;
import com.lonezsi.jqzz.model.ImageVisibility;
import com.lonezsi.jqzz.model.Question;
import com.lonezsi.jqzz.model.Quiz;
import com.lonezsi.jqzz.repository.ImageRepository;

/**
 * Outside pictures in a quiz become the author's own, fetched once when the quiz is saved
 * (Condom 6): a game then only shows pictures JQZZ serves, so no other site learns the
 * players' addresses. A picture that can't be fetched is left as written (the game won't show it).
 */
@Service
public class QuizPictures {

    private static final Logger log = LoggerFactory.getLogger(QuizPictures.class);

    private final WebPicture web;
    private final ImageService images;
    private final ImageRepository repo;

    public QuizPictures(WebPicture web, ImageService images, ImageRepository repo) {
        this.web = web;
        this.images = images;
        this.repo = repo;
    }

    /** A web address rather than a reference into the picture library. */
    public static boolean isOutside(String ref) {
        return ref != null && (ref.contains("://") || ref.startsWith("//"));
    }

    /** Swap every outside address in the quiz's questions and answers for the author's kept copy. */
    public void localize(Quiz quiz, String authorId) {
        if (quiz == null || quiz.getActions() == null || authorId == null || authorId.isBlank()) return;
        Map<String, String> done = new HashMap<>();
        for (Action action : quiz.getActions()) {
            Question q = action == null ? null : action.getQuestion();
            if (q == null) continue;
            q.setImageUrl(local(q.getImageUrl(), authorId, done));
            q.setElaborationImageUrl(local(q.getElaborationImageUrl(), authorId, done));
            if (q.getAnswers() == null) continue;
            for (Answer a : q.getAnswers()) {
                if (a != null) a.setImageUrl(local(a.getImageUrl(), authorId, done));
            }
        }
    }

    String local(String ref, String authorId, Map<String, String> done) {
        if (!isOutside(ref)) return ref;
        String address = ref.trim();
        String known = done.get(address);
        if (known != null) return known;
        String result = repo.findFirstByUploadedByAndSourceUrl(authorId, address)
                .map(i -> ":" + i.getHandle())
                .orElseGet(() -> fetchAndKeep(address, authorId));
        if (result == null) return ref;
        done.put(address, result);
        return result;
    }

    private String fetchAndKeep(String address, String authorId) {
        try {
            WebPicture.Fetched got = web.fetch(address);
            String name = got.name() == null || got.name().isBlank() ? "picture" : got.name();
            return ":" + images.keep(authorId, name, got.data(), got.mimeType(), ImageVisibility.SEMI_PRIVATE, address).getHandle();
        } catch (RuntimeException e) {
            log.info("A quiz picture from {} wasn't kept: {}", address, e.getMessage());
            return null;
        }
    }
}
