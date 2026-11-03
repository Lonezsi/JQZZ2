package com.lonezsi.jqzz;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import com.jayway.jsonpath.JsonPath;
import com.lonezsi.jqzz.util.AdminSecret;

/**
 * The admin account: made at start, with its details only in a file; hidden
 * from everyone; and its panel behind both its login key and the answer to
 * its second question.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
    "jqzz.auth.enforce-login-key=true",
    "jqzz.admin.bootstrap=true",
    "jqzz.admin.dir=target/admin-test",
    "spring.datasource.url=jdbc:h2:mem:jqzz-admin;DB_CLOSE_DELAY=-1",
})
class AdminTest {

    @Value("${local.server.port}")
    private int port;

    private final HttpClient http = HttpClient.newHttpClient();

    @Test
    void theAnswerIsLongAndHasSymbols() {
        String a = AdminSecret.answer();
        assertThat(a).hasSize(24);
        assertThat(a.chars().filter(c -> !Character.isLetterOrDigit(c)).count()).isGreaterThanOrEqualTo(6);
        String stored = AdminSecret.hash(a);
        assertThat(stored).doesNotContain(a);
        assertThat(AdminSecret.matches(a, stored)).isTrue();
        assertThat(AdminSecret.matches(a + "x", stored)).isFalse();
        assertThat(AdminSecret.hash(a)).isNotEqualTo(stored);
    }

    @Test
    void thePanelTakesBothLocks() throws Exception {
        List<String> lines = Files.readAllLines(Path.of("target/admin-test/ADMIN-CREDENTIALS.txt"));
        String key = lines.get(lines.indexOf("1. Log in with this login key:") + 1).trim();
        String answer = lines.stream().dropWhile(l -> !l.startsWith("2.")).skip(1).findFirst().orElseThrow().trim();

        String alice = send("POST", "/users/register", null, null, "{\"name\": \"Alice\"}").body();
        String aliceId = JsonPath.read(alice, "$.id");
        String aliceKey = JsonPath.read(alice, "$.loginKey");

        // the admin is nobody's to see
        assertThat(send("GET", "/users", null, null, null).body()).doesNotContain("Admin");
        String me = send("POST", "/users/login", null, null, "{\"key\": \"%s\"}".formatted(key)).body();
        assertThat((Boolean) JsonPath.read(me, "$.admin")).isTrue();
        String adminId = JsonPath.read(me, "$.id");
        assertThat(send("GET", "/users/" + adminId, null, null, null).statusCode()).isEqualTo(404);

        // anyone else finds nothing here, right answer or not
        assertThat(send("GET", "/admin/question", aliceKey, null, null).statusCode()).isEqualTo(404);
        assertThat(send("POST", "/admin/unlock", aliceKey, null, unlock(answer)).statusCode()).isEqualTo(404);
        assertThat(send("GET", "/admin/users", null, null, null).statusCode()).isEqualTo(404);

        // the admin's key alone opens nothing
        assertThat(send("GET", "/admin/question", key, null, null).statusCode()).isEqualTo(200);
        assertThat(send("GET", "/admin/users", key, null, null).statusCode()).isEqualTo(403);
        assertThat(send("POST", "/admin/unlock", key, null, unlock("Rex")).statusCode()).isEqualTo(401);

        String token = JsonPath.read(send("POST", "/admin/unlock", key, null, unlock(answer)).body(), "$.token");
        // the token is the admin's only: with alice's key it is nothing
        assertThat(send("GET", "/admin/users", aliceKey, token, null).statusCode()).isEqualTo(404);

        String users = send("GET", "/admin/users", key, token, null).body();
        assertThat(users).contains(aliceId).doesNotContain(aliceKey).doesNotContain(adminId);

        // see all, edit all: someone else's name, quiz and key
        assertThat(send("PATCH", "/admin/users/" + aliceId, key, token, "{\"name\": \"Alicia\"}").statusCode()).isEqualTo(200);
        String quiz = "{\"name\": \"Hers\", \"authorId\": \"%s\", \"actions\": []}".formatted(aliceId);
        long quizId = ((Number) JsonPath.read(send("POST", "/quizzes", aliceKey, null, quiz).body(), "$.id")).longValue();
        assertThat(send("PATCH", "/admin/quizzes/" + quizId, key, token, "{\"name\": \"Renamed\"}").statusCode()).isEqualTo(200);
        assertThat(send("GET", "/quizzes/" + quizId, null, null, null).body()).contains("Renamed");
        String newKey = JsonPath.read(send("POST", "/admin/users/" + aliceId + "/key", key, token, null).body(), "$.loginKey");
        assertThat(newKey).isNotEqualTo(aliceKey);
        assertThat(send("POST", "/users/login", null, null, "{\"key\": \"%s\"}".formatted(aliceKey)).statusCode()).isEqualTo(404);
        assertThat(send("DELETE", "/admin/quizzes/" + quizId, key, token, null).statusCode()).isEqualTo(204);

        // not itself
        assertThat(send("DELETE", "/admin/users/" + adminId, key, token, null).statusCode()).isEqualTo(403);

        // locked again, the token is spent
        send("POST", "/admin/lock", key, token, null);
        assertThat(send("GET", "/admin/overview", key, token, null).statusCode()).isEqualTo(403);
    }

    private static String unlock(String answer) {
        return "{\"answer\": \"%s\"}".formatted(answer.replace("\\", "\\\\").replace("\"", "\\\""));
    }

    private HttpResponse<String> send(String method, String path, String key, String token, String json) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
            .header("Content-Type", "application/json")
            .method(method, json == null
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(json));
        if (key != null) request.header("X-Login-Key", key);
        if (token != null) request.header("X-Admin-Token", token);
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }
}
