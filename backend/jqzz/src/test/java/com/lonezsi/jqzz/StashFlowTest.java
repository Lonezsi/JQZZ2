package com.lonezsi.jqzz;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;

import com.jayway.jsonpath.JsonPath;
import com.lonezsi.jqzz.model.ImageVisibility;
import com.lonezsi.jqzz.service.ImageService;

/**
 * A game played over the real HTTP API ends up in the history of everyone in
 * it, and from there in their stash, named and shared like images are.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class StashFlowTest {

    @Value("${local.server.port}")
    private int port;

    @Autowired
    private ImageService images;

    private final HttpClient http = HttpClient.newHttpClient();

    @Test
    void finishedGameGoesToHistoryAndIntoTheStash() throws Exception {
        String alice = register("Alice");
        String bob = register("Bob");
        String carol = register("Carol");
        images.uploadImage("river", alice, ImageVisibility.SEMI_PRIVATE,
                new MockMultipartFile("file", "river.png", "image/png", new byte[] {1, 2, 3}));

        String q1 = """
            {"id": 1, "text": "Longest river?", "imageUrl": ":river", "type": "PREWRITTEN_SINGLE",
             "answers": [{"text": "Nile", "value": 100}, {"text": "Danube", "value": 0}]}
            """;
        String q2 = """
            {"id": 2, "text": "Rank these rivers", "type": "TIERLIST",
             "answers": [{"text": "Tisza"}, {"text": "Rhine"}]}
            """;
        String quiz = send("POST", "/quizzes", null, """
            {"name": "Rivers of the world", "authorId": "%s", "actions": [
               {"phase": "TEXT", "time": 0, "preview": "warm up"},
               {"phase": "QUESTION", "time": 20, "preview": "ask", "question": %s},
               {"phase": "ANSWER", "time": 10, "preview": "answer", "question": %s},
               {"phase": "QUESTION", "time": 30, "preview": "rank", "question": %s}
            ]}
            """.formatted(alice, q1, q1, q2)).body();
        long quizId = id(quiz, "$.id");

        // play it: alice hosts, bob joins, alice ends it early
        String code = JsonPath.read(send("POST", "/play/host", null,
                "{\"quizId\": %d, \"userId\": \"%s\"}".formatted(quizId, alice)).body(), "$.code");
        assertThat(send("POST", "/play/" + code + "/join", null, "{\"userId\": \"%s\"}".formatted(bob)).statusCode())
                .isEqualTo(200);
        String started = send("POST", "/play/" + code + "/start", null, "{\"userId\": \"%s\"}".formatted(alice)).body();
        List<Number> nile = JsonPath.read(started, "$.question.answers[?(@.text == 'Nile')].id");
        send("POST", "/play/" + code + "/submit", null,
                "{\"userId\": \"%s\", \"picks\": [%d]}".formatted(bob, nile.get(0).longValue()));
        String ended = send("POST", "/play/" + code + "/end", null, "{\"userId\": \"%s\"}".formatted(alice)).body();
        assertThat(JsonPath.<String>read(ended, "$.status")).isEqualTo("FINISHED");
        long recordId = id(ended, "$.recordId");

        // history: the host and the player see it, nobody else does
        String bobs = send("GET", "/history", bob, null).body();
        assertThat(JsonPath.<List<Object>>read(bobs, "$[?(@.id == " + recordId + ")]")).hasSize(1);
        assertThat(JsonPath.<Boolean>read(send("GET", "/history/" + recordId, alice, null).body(), "$.hosted")).isTrue();
        assertThat(JsonPath.<List<Object>>read(send("GET", "/history", carol, null).body(), "$")).isEmpty();
        assertThat(send("GET", "/history/" + recordId, carol, null).statusCode()).isEqualTo(403);

        String record = send("GET", "/history/" + recordId, bob, null).body();
        assertThat(JsonPath.<String>read(record, "$.you.name")).isEqualTo("Bob");
        assertThat(JsonPath.<List<String>>read(record, "$.content.questions[*].text"))
                .containsExactly("Longest river?", "Rank these rivers");
        long firstKey = id(record, "$.content.questions[0].key");
        // what happened is kept too: bob picked the Nile
        assertThat(JsonPath.<List<Integer>>read(record, "$.content.results." + firstKey + ".counts"))
                .containsExactly(1, 0);

        // the whole quiz, and the picture it used
        assertThat(send("POST", "/stash/from-game", carol, "{\"recordId\": %d}".formatted(recordId)).statusCode())
                .isEqualTo(403);
        String saved = send("POST", "/stash/from-game", bob, "{\"recordId\": %d}".formatted(recordId)).body();
        assertThat(JsonPath.<List<String>>read(saved, "$[*].kind")).containsExactly("QUIZ", "IMAGE");
        assertThat(JsonPath.<String>read(saved, "$[0].handle")).isEqualTo("rivers_of_the_world");
        assertThat(JsonPath.<String>read(saved, "$[0].reference")).isEqualTo(bob + ":rivers_of_the_world");
        assertThat(JsonPath.<String>read(saved, "$[0].visibility")).isEqualTo("PRIVATE");
        assertThat(JsonPath.<String>read(saved, "$[1].handle")).isEqualTo("river");
        assertThat(JsonPath.<String>read(saved, "$[1].title")).isEqualTo(alice + ":river");
        long quizItem = id(saved, "$[0].id");
        // the author's own picture is already theirs, so it doesn't come along for them
        assertThat(JsonPath.<List<String>>read(
                send("POST", "/stash/from-game", alice, "{\"recordId\": %d}".formatted(recordId)).body(), "$[*].kind"))
                .containsExactly("QUIZ");

        // one question; its picture is already stashed, so only the question comes back
        String one = send("POST", "/stash/from-game", bob,
                "{\"recordId\": %d, \"questionKey\": %d}".formatted(recordId, firstKey)).body();
        assertThat(JsonPath.<List<String>>read(one, "$[*].kind")).containsExactly("QUESTION");
        assertThat(JsonPath.<String>read(one, "$[0].title")).isEqualTo("Longest river?");
        String again = send("POST", "/stash/from-game", bob,
                "{\"recordId\": %d, \"questionKey\": %d}".formatted(recordId, firstKey)).body();
        assertThat(JsonPath.<String>read(again, "$[0].handle")).isEqualTo("longest_river_2");

        String stash = send("GET", "/stash", bob, null).body();
        assertThat(JsonPath.<List<Object>>read(stash, "$.items[?(@.kind != 'TYPE')]")).hasSize(4);

        // everyone starts with the default question types; resetting brings them back
        List<Number> types = JsonPath.read(stash, "$.items[?(@.kind == 'TYPE')].id");
        assertThat(types).hasSize(6);
        send("DELETE", "/stash/" + types.get(0).longValue(), bob, null);
        assertThat(JsonPath.<List<Object>>read(send("POST", "/stash/types/reset", bob, "{\"mode\": \"add\"}").body(), "$"))
                .hasSize(6);
        assertThat(JsonPath.<List<Object>>read(send("POST", "/stash/types/reset", bob, "{\"mode\": \"add\"}").body(), "$"))
                .hasSize(6);
        // a question from the game, kept as a shape: its type and steps, no words
        String shape = send("POST", "/stash/as-type", bob,
                "{\"recordId\": %d, \"questionKey\": %d, \"title\": \"river style\"}".formatted(recordId, firstKey)).body();
        assertThat(JsonPath.<String>read(shape, "$.kind")).isEqualTo("TYPE");
        assertThat(JsonPath.<String>read(shape, "$.payload")).contains("PREWRITTEN_SINGLE").doesNotContain("Nile");
        long shapeId = id(shape, "$.id");
        assertThat(send("PATCH", "/stash/" + shapeId, bob, "{\"payload\": \"{\\\"steps\\\": []}\"}").statusCode())
                .isEqualTo(400);
        assertThat(JsonPath.<List<Object>>read(send("POST", "/stash/types/reset", bob, "{\"mode\": \"full\"}").body(), "$"))
                .hasSize(6);

        // private: only bob. semi-private: anyone with bob's id. public: by handle alone.
        String ref = "/stash/resolve?kind=QUIZ&ref=";
        assertThat(send("GET", ref + bob + ":rivers_of_the_world", carol, null).statusCode()).isEqualTo(404);
        assertThat(send("GET", ref + ":rivers_of_the_world", bob, null).statusCode()).isEqualTo(200);
        send("PATCH", "/stash/" + quizItem, bob, "{\"visibility\": \"SEMI_PRIVATE\"}");
        assertThat(send("GET", ref + bob + ":rivers_of_the_world", carol, null).statusCode()).isEqualTo(200);
        String made = send("PATCH", "/stash/" + quizItem, bob, "{\"visibility\": \"PUBLIC\"}").body();
        assertThat(JsonPath.<String>read(made, "$.reference")).isEqualTo("rivers_of_the_world");
        assertThat(send("GET", ref + "rivers_of_the_world", carol, null).statusCode()).isEqualTo(200);

        // carol copies it; her copy can't take the same public name
        String copy = send("POST", "/stash/from-ref", carol,
                "{\"kind\": \"QUIZ\", \"ref\": \"rivers_of_the_world\"}").body();
        long copyId = id(copy, "$.id");
        assertThat(JsonPath.<String>read(copy, "$.reference")).isEqualTo(carol + ":rivers_of_the_world");
        assertThat(send("PATCH", "/stash/" + copyId, carol, "{\"visibility\": \"PUBLIC\"}").statusCode()).isEqualTo(409);
        assertThat(send("PATCH", "/stash/" + copyId, carol, "{\"handle\": \"bad name!\"}").statusCode()).isEqualTo(400);
        assertThat(send("DELETE", "/stash/" + quizItem, carol, null).statusCode()).isEqualTo(403);

        // opened, it is a quiz of carol's that still points at alice's picture
        String opened = send("POST", "/stash/" + copyId + "/open", carol, null).body();
        String reloaded = send("GET", "/quizzes/" + id(opened, "$.id"), null, null).body();
        assertThat(JsonPath.<String>read(reloaded, "$.authorId")).isEqualTo(carol);
        assertThat(JsonPath.<List<String>>read(reloaded, "$.actions[*].phase"))
                .containsExactly("QUESTION", "ANSWER", "QUESTION");
        assertThat(JsonPath.<String>read(reloaded, "$.actions[0].question.imageUrl")).isEqualTo(alice + ":river");
        assertThat(JsonPath.<Object>read(reloaded, "$.actions[0].question.id"))
                .isEqualTo(JsonPath.read(reloaded, "$.actions[1].question.id"));

        // the stash copy leaves the night's results behind
        assertThat(JsonPath.<String>read(send("GET", "/stash/" + quizItem, bob, null).body(), "$.payload"))
                .doesNotContain("results");

        // public items can be browsed and show on bob's profile
        assertThat(JsonPath.<List<String>>read(send("GET", "/stash/public?kind=QUIZ&q=rivers", carol, null).body(),
                "$[*].handle")).contains("rivers_of_the_world");
        String bobSeenByCarol = send("GET", "/profile/" + bob, carol, null).body();
        assertThat(JsonPath.<Boolean>read(bobSeenByCarol, "$.self")).isFalse();
        assertThat(JsonPath.<List<Object>>read(bobSeenByCarol, "$.games")).isEmpty();
        assertThat(JsonPath.<Integer>read(bobSeenByCarol, "$.stats.played")).isEqualTo(1);
        assertThat(JsonPath.<List<String>>read(bobSeenByCarol, "$.shelf[*].handle")).contains("rivers_of_the_world");
        String bobSeenByAlice = send("GET", "/profile/" + bob, alice, null).body();
        assertThat(JsonPath.<List<Object>>read(bobSeenByAlice, "$.games")).hasSize(1);

        // practice: alone, started straight away, from the stash
        String practice = send("POST", "/play/practice", null,
                "{\"userId\": \"%s\", \"stashId\": %d}".formatted(bob, quizItem)).body();
        assertThat(JsonPath.<String>read(practice, "$.status")).isEqualTo("PLAYING");
        assertThat(JsonPath.<List<String>>read(practice, "$.players[*].id")).containsExactly(bob);

        // rematch: a new game of the same quiz
        HttpResponse<String> rematch = send("POST", "/play/rematch", null,
                "{\"userId\": \"%s\", \"recordId\": %d}".formatted(bob, recordId));
        assertThat(rematch.statusCode()).isEqualTo(200);
        assertThat(JsonPath.<String>read(rematch.body(), "$.code")).isNotEqualTo(code);
        assertThat(send("POST", "/play/rematch", null,
                "{\"userId\": \"%s\", \"recordId\": %d}".formatted(carol, recordId)).statusCode()).isEqualTo(403);

        assertThat(send("DELETE", "/stash/" + quizItem, bob, null).statusCode()).isEqualTo(204);
    }

    private String register(String name) throws Exception {
        return JsonPath.read(send("POST", "/users/register", null, "{\"name\": \"%s\"}".formatted(name)).body(), "$.id");
    }

    private static long id(String json, String path) {
        return ((Number) JsonPath.read(json, path)).longValue();
    }

    private HttpResponse<String> send(String method, String path, String userId, String json) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
            .header("Content-Type", "application/json")
            .method(method, json == null
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(json));
        if (userId != null) request.header("X-User-Id", userId);
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }
}
