package com.lonezsi.jqzz;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;

import com.jayway.jsonpath.JsonPath;
import com.lonezsi.jqzz.model.User;
import com.lonezsi.jqzz.repository.UserRepository;
import com.lonezsi.jqzz.service.LoginKeys;

/**
 * A login key is kept only as its hash: a copy of the database opens nothing.
 * Keys from before that move over, hashed, and keep working.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
    "jqzz.auth.enforce-login-key=true",
    "spring.datasource.url=jdbc:h2:mem:jqzz-keyhash;DB_CLOSE_DELAY=-1",
})
class LoginKeyHashTest {

    @Value("${local.server.port}")
    private int port;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private UserRepository users;

    @Autowired
    private LoginKeys keys;

    private final HttpClient http = HttpClient.newHttpClient();

    @Test
    void theDatabaseNeverHoldsAKey() throws Exception {
        String alice = send("POST", "/users/register", null, "{\"name\": \"Alice\"}").body();
        String key = JsonPath.read(alice, "$.loginKey");
        String id = JsonPath.read(alice, "$.id");

        // nowhere in the clear: not the account row, not the key table
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM app_user WHERE login_key IS NOT NULL", Integer.class)).isZero();
        assertThat(jdbc.queryForList("SELECT hash FROM login_key", String.class))
                .contains(LoginKeys.hash(key))
                .allSatisfy(h -> assertThat(h).doesNotContain(key));

        // and still the way in, with the key handed back only to whoever showed it
        String in = send("POST", "/users/login", null, "{\"key\": \"%s\"}".formatted(key)).body();
        assertThat((String) JsonPath.read(in, "$.loginKey")).isEqualTo(key);
        assertThat(send("POST", "/users/" + id + "/name", key, "{\"name\": \"Al\"}").statusCode()).isEqualTo(200);
        String renamed = send("POST", "/users/" + id + "/name", key, "{\"name\": \"Ali\"}").body();
        assertThat(renamed).doesNotContain(key).doesNotContain("loginKey");
        assertThat(send("POST", "/users/login", null, "{\"key\": \"%s\"}".formatted(LoginKeys.hash(key))).statusCode())
                .isEqualTo(404);
    }

    @Test
    void anOldKeyKeptInTheClearMovesAndStillWorks() throws Exception {
        User old = new User();
        old.setId("oldtimer01");
        old.setHandle("oldtimer");
        old.setName("Old Timer");
        old.setLoginKey("plaintextkeyfromtheolddays000001");
        users.save(old);

        keys.run(null);

        assertThat(users.findById("oldtimer01").orElseThrow().getLoginKey()).isNull();
        assertThat(keys.owner("plaintextkeyfromtheolddays000001")).contains("oldtimer01");
        assertThat(send("POST", "/users/login", null, "{\"key\": \"plaintextkeyfromtheolddays000001\"}").statusCode())
                .isEqualTo(200);
        // and once moved, an id alone still isn't enough
        assertThat(send("POST", "/users/login", null, "{\"id\": \"oldtimer01\"}").statusCode()).isEqualTo(401);
    }

    private HttpResponse<String> send(String method, String path, String key, String json) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
            .header("Content-Type", "application/json")
            .method(method, json == null
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofString(json));
        if (key != null) request.header("X-Login-Key", key);
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }
}
