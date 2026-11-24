package com.lonezsi.jqzz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.socket.messaging.SessionConnectEvent;

import com.jayway.jsonpath.JsonPath;
import com.lonezsi.jqzz.model.Quiz;
import com.lonezsi.jqzz.repository.QuizRepository;
import com.lonezsi.jqzz.repository.UserRepository;
import com.lonezsi.jqzz.service.LoginKeys;
import com.lonezsi.jqzz.service.PresenceTracker;

/** The Condom pass: headers, who the socket is, quizzes with no author, the people list, the cookie. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = { "jqzz.auth.enforce-login-key=true", "jqzz.cookie.secure=true" })
class CondomTwoTest {

    @Value("${local.server.port}")
    private int port;

    @Autowired
    private QuizRepository quizzes;

    private final HttpClient http = HttpClient.newHttpClient();

    @Test
    void everyResponseCarriesTheSecurityHeaders() throws Exception {
        HttpResponse<String> r = send("GET", "/quizzes", null, null);
        assertThat(r.headers().firstValue("X-Content-Type-Options")).hasValue("nosniff");
        assertThat(r.headers().firstValue("X-Frame-Options")).hasValue("DENY");
        assertThat(r.headers().firstValue("Referrer-Policy")).hasValue("same-origin");
        assertThat(r.headers().firstValue("Content-Security-Policy").orElse(""))
                .contains("frame-ancestors 'none'").contains("script-src 'self'").doesNotContain("accounts.google.com");
    }

    @Test
    void thePeopleListAndTheApiMapAreNotOpen() throws Exception {
        String key = JsonPath.read(send("POST", "/users/register", null, "{\"name\": \"Alice\"}").body(), "$.loginKey");
        assertThat(send("GET", "/users", null, null).statusCode()).isEqualTo(401);
        assertThat(send("GET", "/profile/nobody", null, null).statusCode()).isEqualTo(401);
        assertThat(send("GET", "/users", key, null).statusCode()).isEqualTo(200);
    }

    @Test
    void aQuizAlwaysHasAnAuthorAndNoAuthorMeansTheAdmins() throws Exception {
        String alice = send("POST", "/users/register", null, "{\"name\": \"Alice\"}").body();
        String aliceId = JsonPath.read(alice, "$.id");
        String aliceKey = JsonPath.read(alice, "$.loginKey");
        String bobKey = JsonPath.read(send("POST", "/users/register", null, "{\"name\": \"Bob\"}").body(), "$.loginKey");

        assertThat(send("POST", "/quizzes", null, "{\"name\": \"anon\", \"actions\": []}").statusCode()).isEqualTo(401);
        HttpResponse<String> made = send("POST", "/quizzes", aliceKey, "{\"name\": \"Mine\", \"actions\": []}");
        assertThat(made.statusCode()).isEqualTo(200);
        assertThat(JsonPath.<String>read(made.body(), "$.authorId")).isEqualTo(aliceId);

        Quiz old = new Quiz();
        old.setName("Old");
        long oldId = quizzes.save(old).getId();
        assertThat(send("PUT", "/quizzes/" + oldId, bobKey, "{\"name\": \"Taken\", \"actions\": []}").statusCode()).isEqualTo(403);
        assertThat(send("DELETE", "/quizzes/" + oldId, bobKey, null).statusCode()).isEqualTo(403);
        assertThat(quizzes.findById(oldId)).isPresent();
    }

    @Test
    void theKeyCookieIsSecureAndHttpOnly() throws Exception {
        HttpResponse<String> r = send("POST", "/users/register", null, "{\"name\": \"Alice\"}");
        String cookie = r.headers().firstValue("Set-Cookie").orElse("");
        assertThat(cookie).startsWith("jqzz_key=").contains("Secure").contains("HttpOnly");
    }

    @Test
    void theSocketIsWhoseKeyItShowsNotWhoeverItClaims() {
        LoginKeys keys = mock(LoginKeys.class);
        when(keys.owner("good-key")).thenReturn(Optional.of("anna"));
        when(keys.owner("bad-key")).thenReturn(Optional.empty());
        PresenceTracker presence = new PresenceTracker(mock(UserRepository.class), mock(SimpMessagingTemplate.class), keys, true);

        connect(presence, "s1", "userId", "anna", null);
        assertThat(presence.userOf("s1")).isNull();
        connect(presence, "s2", "userId", "anna", "bad-key");
        assertThat(presence.userOf("s2")).isNull();
        connect(presence, "s3", null, null, "good-key");
        assertThat(presence.userOf("s3")).isEqualTo("anna");
    }

    private static void connect(PresenceTracker presence, String session, String header, String value, String loginKey) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setSessionId(session);
        if (header != null) accessor.addNativeHeader(header, value);
        if (loginKey != null) accessor.addNativeHeader("loginKey", loginKey);
        presence.onConnect(new SessionConnectEvent(presence,
                MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders())));
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
