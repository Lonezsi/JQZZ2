package com.lonezsi.jqzz;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;

import com.jayway.jsonpath.JsonPath;
import com.sun.net.httpserver.HttpServer;

/**
 * Signing in with Foyer. A stand-in Foyer answers /api/account the way the real one
 * does: two cookies it knows, everything else nobody.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = "jqzz.auth.enforce-login-key=true")
class FoyerSignInTest {

    static HttpServer foyer;

    @DynamicPropertySource
    static void foyerUrl(DynamicPropertyRegistry registry) throws Exception {
        foyer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        foyer.createContext("/api/account", ex -> {
            String cookie = String.valueOf(ex.getRequestHeaders().getFirst("Cookie"));
            String body = cookie.equals("foyer=anna.cookie.0123")
                    ? "{\"account\": {\"id\": \"f-anna\", \"handle\": \"anna\", \"name\": \"Anna K\"}}"
                    : cookie.equals("foyer=bela.cookie.0123")
                    ? "{\"account\": {\"id\": \"f-bela\", \"handle\": \"bela\", \"name\": \"\"}}"
                    : "{\"account\": null}";
            byte[] raw = body.getBytes(StandardCharsets.UTF_8);
            ex.sendResponseHeaders(200, raw.length);
            ex.getResponseBody().write(raw);
            ex.close();
        });
        foyer.start();
        registry.add("jqzz.foyer.url", () -> "http://127.0.0.1:" + foyer.getAddress().getPort());
    }

    @AfterAll
    static void stop() {
        foyer.stop(0);
    }

    @Value("${local.server.port}")
    private int port;

    private final HttpClient http = HttpClient.newHttpClient();

    @Test
    void foyerOpensTheSameAccountEveryTime() throws Exception {
        // nobody signed in on Foyer
        assertThat(send("GET", "/users/foyer", null, null).body()).contains("\"foyer\":null");
        assertThat(send("POST", "/users/foyer/login", null, null).statusCode()).isEqualTo(401);
        assertThat(send("POST", "/users/foyer/login", "foyer=forged.cookie.0000", null).statusCode()).isEqualTo(401);

        // the first time makes an account from the Foyer one
        assertThat(send("GET", "/users/foyer", "foyer=anna.cookie.0123", null).body()).contains("\"handle\":\"anna\"");
        HttpResponse<String> first = send("POST", "/users/foyer/login", "foyer=anna.cookie.0123", null);
        assertThat(first.statusCode()).isEqualTo(200);
        String id = JsonPath.read(first.body(), "$.id");
        assertThat((String) JsonPath.read(first.body(), "$.name")).isEqualTo("Anna K");
        assertThat((Boolean) JsonPath.read(first.body(), "$.foyerLinked")).isTrue();
        // and every time after, on any device, the same one, with a key of its own
        HttpResponse<String> again = send("POST", "/users/foyer/login", "foyer=anna.cookie.0123", null);
        assertThat((String) JsonPath.read(again.body(), "$.id")).isEqualTo(id);
        assertThat((String) JsonPath.read(again.body(), "$.loginKey")).isNotEqualTo(JsonPath.read(first.body(), "$.loginKey"));
    }

    @Test
    void anAccountFromBeforeIsTiedOnceAndKeepsItsName() throws Exception {
        String guest = send("POST", "/users/register", null, "{\"name\": \"Velvet Moth (guest)\"}").body();
        String id = JsonPath.read(guest, "$.id");
        String key = JsonPath.read(guest, "$.loginKey");
        String other = JsonPath.read(send("POST", "/users/register", null, "{\"name\": \"Other\"}").body(), "$.loginKey");

        // tying takes the account's own key, like everything that acts as it
        assertThat(send("POST", "/users/" + id + "/foyer", "foyer=bela.cookie.0123", null).statusCode()).isEqualTo(401);
        assertThat(sendKeyed("POST", "/users/" + id + "/foyer", "foyer=bela.cookie.0123", other).statusCode()).isEqualTo(403);
        HttpResponse<String> tied = sendKeyed("POST", "/users/" + id + "/foyer", "foyer=bela.cookie.0123", key);
        assertThat(tied.statusCode()).isEqualTo(200);
        assertThat((Boolean) JsonPath.read(tied.body(), "$.foyerLinked")).isTrue();
        // Foyer gave no name, so the guest name stays
        assertThat((String) JsonPath.read(tied.body(), "$.name")).isEqualTo("Velvet Moth (guest)");

        // from now on Foyer opens this account
        HttpResponse<String> in = send("POST", "/users/foyer/login", "foyer=bela.cookie.0123", null);
        assertThat((String) JsonPath.read(in.body(), "$.id")).isEqualTo(id);

        // and no second account can take the same Foyer account
        String third = send("POST", "/users/register", null, "{\"name\": \"Third\"}").body();
        assertThat(sendKeyed("POST", "/users/" + JsonPath.read(third, "$.id") + "/foyer", "foyer=bela.cookie.0123",
                JsonPath.read(third, "$.loginKey")).statusCode()).isEqualTo(409);
    }

    private HttpResponse<String> send(String method, String path, String cookie, String json) throws Exception {
        return sendKeyed(method, path, cookie, null, json);
    }

    private HttpResponse<String> sendKeyed(String method, String path, String cookie, String key) throws Exception {
        return sendKeyed(method, path, cookie, key, null);
    }

    private HttpResponse<String> sendKeyed(String method, String path, String cookie, String key, String json) throws Exception {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
            .header("Content-Type", "application/json")
            .method(method, json == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json));
        if (cookie != null) request.header("Cookie", cookie);
        if (key != null) request.header("X-Login-Key", key);
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }
}
