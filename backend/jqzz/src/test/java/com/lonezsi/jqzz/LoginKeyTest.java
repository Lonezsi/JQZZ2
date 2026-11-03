package com.lonezsi.jqzz;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import com.jayway.jsonpath.JsonPath;

/**
 * An id is public, so it proves nothing: acting as someone takes their login
 * key, which only they are ever sent.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = "jqzz.auth.enforce-login-key=true")
class LoginKeyTest {

    @Value("${local.server.port}")
    private int port;

    private final HttpClient http = HttpClient.newHttpClient();

    @Test
    void anIdAloneProvesNothing() throws Exception {
        String alice = send("POST", "/users/register", null, "{\"name\": \"Alice\"}").body();
        String aliceId = JsonPath.read(alice, "$.id");
        String aliceKey = JsonPath.read(alice, "$.loginKey");
        String bobKey = JsonPath.read(send("POST", "/users/register", null, "{\"name\": \"Bob\"}").body(), "$.loginKey");
        assertThat(aliceKey).hasSize(32).isNotEqualTo(aliceId);

        // nobody else is sent the key: not in the people list, not in their record
        assertThat(send("GET", "/users", null, null).body()).doesNotContain(aliceKey);
        assertThat(send("GET", "/users/" + aliceId, null, null).body()).doesNotContain(aliceKey);

        // logging in takes the key; the id no longer does
        assertThat(send("POST", "/users/login", null, "{\"key\": \"%s\"}".formatted(aliceKey)).statusCode()).isEqualTo(200);
        assertThat(send("POST", "/users/login", null, "{\"id\": \"%s\"}".formatted(aliceId)).statusCode()).isEqualTo(401);

        // acting as alice: with no key, refused; with bob's key, refused; with hers, fine
        String rename = "{\"name\": \"Mallory\"}";
        assertThat(send("POST", "/users/" + aliceId + "/name", null, rename).statusCode()).isEqualTo(401);
        assertThat(send("POST", "/users/" + aliceId + "/name", bobKey, rename).statusCode()).isEqualTo(403);
        String quiz = "{\"name\": \"Mine\", \"authorId\": \"%s\", \"actions\": []}".formatted(aliceId);
        assertThat(send("POST", "/quizzes", bobKey, quiz).statusCode()).isEqualTo(403);
        HttpResponse<String> made = send("POST", "/quizzes", aliceKey, quiz);
        assertThat(made.statusCode()).isEqualTo(200);
        long quizId = ((Number) JsonPath.read(made.body(), "$.id")).longValue();

        // a quiz is saved over only by whoever made it
        String edit = "{\"name\": \"Taken\", \"actions\": []}";
        assertThat(send("PUT", "/quizzes/" + quizId, bobKey, edit).statusCode()).isEqualTo(403);
        assertThat(send("PUT", "/quizzes/" + quizId, aliceKey, edit).statusCode()).isEqualTo(200);

        // a header claiming to be her counts as a claim too
        HttpRequest delete = HttpRequest.newBuilder(URI.create(url("/quizzes/" + quizId)))
                .header("X-User-Id", aliceId).header("X-Login-Key", bobKey).DELETE().build();
        assertThat(http.send(delete, HttpResponse.BodyHandlers.ofString()).statusCode()).isEqualTo(403);
    }

    private String url(String path) {
        return "http://127.0.0.1:" + port + path;
    }

    private HttpResponse<String> send(String method, String path, String key, String json) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(url(path)))
            .header("Content-Type", "application/json")
            .method(method, json == null
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(json));
        if (key != null) request.header("X-Login-Key", key);
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }
}
