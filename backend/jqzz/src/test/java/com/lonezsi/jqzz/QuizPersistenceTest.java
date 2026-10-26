package com.lonezsi.jqzz;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;

import com.jayway.jsonpath.JsonPath;

/**
 * Drives the real HTTP API against an in-memory database, sending quizzes the
 * way the editor does: client-generated ids, one question shared by several
 * actions, and editor-only TEXT / DIVIDER blocks.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class QuizPersistenceTest {

    @Value("${local.server.port}")
    private int port;

    private final HttpClient http = HttpClient.newHttpClient();

    private static final String QUESTION = """
        {"id": 1761477000000001, "text": "Capital of France?", "imageUrl": "",
         "type": "PREWRITTEN_SINGLE", "elaborationText": "Since the 10th century",
         "answers": [{"id": 1761477000000005, "text": "Paris", "value": 100},
                     {"id": 1761477000000006, "text": "London", "value": 0}]}
        """;

    @Test
    void editorSaveSurvivesReload() throws Exception {
        long quizId = createQuiz();

        String body = """
            {"id": %d, "name": "Geography", "authorId": "abc123",
             "actions": [
               {"id": 1761477000000002, "phase": "WAITING", "time": 8, "preview": "Buffer", "question": %s},
               {"id": 1761477000000003, "phase": "QUESTION", "time": 30, "preview": "Ask", "question": %s},
               {"id": 1761477000000004, "phase": "DIVIDER", "time": 0, "preview": "---", "question": null},
               {"id": 1761477000000007, "phase": "TEXT", "time": 0, "preview": "remember the snacks", "question": null}
             ]}
            """.formatted(quizId, QUESTION, QUESTION);

        assertThat(send("PUT", "/quizzes/" + quizId, body).statusCode()).isEqualTo(200);

        String saved = send("GET", "/quizzes/" + quizId, null).body();
        assertThat(JsonPath.<String>read(saved, "$.name")).isEqualTo("Geography");
        assertThat(JsonPath.<List<String>>read(saved, "$.actions[*].phase"))
            .containsExactly("WAITING", "QUESTION", "DIVIDER", "TEXT");
        assertThat(JsonPath.<String>read(saved, "$.actions[3].preview")).isEqualTo("remember the snacks");
        assertThat(JsonPath.<List<String>>read(saved, "$.actions[0].question.answers[*].text"))
            .containsExactly("Paris", "London");
        assertThat(JsonPath.<Object>read(saved, "$.actions[0].question.id"))
            .isEqualTo(JsonPath.read(saved, "$.actions[1].question.id"));
    }

    @Test
    void secondSaveReplacesContentInsteadOfDuplicating() throws Exception {
        long quizId = createQuiz();
        String first = """
            {"name": "Q", "actions": [
               {"id": 11, "phase": "WAITING", "time": 8, "question": %s},
               {"id": 12, "phase": "QUESTION", "time": 30, "question": %s}
            ]}
            """.formatted(QUESTION, QUESTION);
        send("PUT", "/quizzes/" + quizId, first);

        // after a page reload the editor sends back the server's own ids
        String reloaded = send("GET", "/quizzes/" + quizId, null).body();
        Object questionId = JsonPath.read(reloaded, "$.actions[0].question.id");
        String second = """
            {"name": "Q", "actions": [
               {"id": %s, "phase": "QUESTION", "time": 20,
                "question": {"id": %s, "text": "Capital of Italy?", "type": "PREWRITTEN_SINGLE",
                             "answers": [{"text": "Rome", "value": 100}]}}
            ]}
            """.formatted(JsonPath.read(reloaded, "$.actions[1].id"), questionId);
        assertThat(send("PUT", "/quizzes/" + quizId, second).statusCode()).isEqualTo(200);

        String saved = send("GET", "/quizzes/" + quizId, null).body();
        assertThat(JsonPath.<List<Object>>read(saved, "$.actions")).hasSize(1);
        assertThat(JsonPath.<Integer>read(saved, "$.actions[0].time")).isEqualTo(20);
        assertThat(JsonPath.<List<String>>read(saved, "$.actions[0].question.answers[*].text"))
            .containsExactly("Rome");
    }

    @Test
    void savingUnknownQuizIsNotFound() throws Exception {
        assertThat(send("PUT", "/quizzes/987654", "{\"name\": \"x\", \"actions\": []}").statusCode())
            .isEqualTo(404);
    }

    @Test
    void gameStepsOverEditorOnlyBlocks() throws Exception {
        long quizId = createQuiz();
        send("PUT", "/quizzes/" + quizId, """
            {"name": "Q", "actions": [
               {"phase": "TEXT", "time": 0, "preview": "intro"},
               {"phase": "QUESTION", "time": 30, "question": %s},
               {"phase": "DIVIDER", "time": 0}
            ]}
            """.formatted(QUESTION));

        HttpResponse<String> lobby = send("POST", "/lobbies",
            "{\"name\": \"Room\", \"adminId\": \"abc123\", \"quizId\": " + quizId + "}");
        assertThat(lobby.statusCode()).isEqualTo(200);
        long lobbyId = ((Number) JsonPath.read(lobby.body(), "$.id")).longValue();

        assertThat(send("POST", "/game/" + lobbyId + "/start", null).statusCode()).isEqualTo(200);
        assertThat(send("POST", "/game/" + lobbyId + "/next", null).statusCode()).isEqualTo(200);
        String afterFirst = send("GET", "/lobbies/" + lobbyId, null).body();
        assertThat(JsonPath.<String>read(afterFirst, "$.currentAction.phase")).isEqualTo("QUESTION");

        // past the end: reports the quiz as finished instead of failing
        assertThat(send("POST", "/game/" + lobbyId + "/next", null).statusCode()).isEqualTo(200);
        assertThat(JsonPath.<Boolean>read(send("GET", "/lobbies/" + lobbyId, null).body(), "$.quizOver")).isTrue();

        HttpResponse<String> missing = send("POST", "/game/987654/next", null);
        assertThat(missing.statusCode()).isEqualTo(404);
        assertThat(missing.body()).contains("Lobby not found");
    }

    private long createQuiz() throws Exception {
        HttpResponse<String> created = send("POST", "/quizzes", "{\"name\": \"New\", \"authorId\": \"abc123\", \"actions\": []}");
        assertThat(created.statusCode()).isEqualTo(200);
        return ((Number) JsonPath.read(created.body(), "$.id")).longValue();
    }

    private HttpResponse<String> send(String method, String path, String json) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
            .header("Content-Type", "application/json")
            .method(method, json == null
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(json));
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }
}
