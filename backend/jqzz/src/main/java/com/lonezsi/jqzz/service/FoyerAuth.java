package com.lonezsi.jqzz.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Who the visitor is on Foyer, the home server's front door, which signs people in for
 * every site on the machine.
 *
 * Every site is on one hostname, so Foyer's "foyer" cookie (Path=/) arrives here with each
 * request. JQZZ never checks it itself: it hands it to Foyer over the loopback and asks
 * who it belongs to (GET {foyer}/api/account). One place knows the passwords and signs the
 * cookies, and signing out of Foyer signs out of this too.
 *
 * Answers are kept for a short while so a burst of requests asks once. Foyer being down is
 * "nobody signed in", never an error: JQZZ works without it, the way it always has.
 */
@Service
public class FoyerAuth {

    public record Account(String id, String handle, String name) {}

    public static final String COOKIE = "foyer";
    private static final long KEEP_MS = 30_000;

    private final String base;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
    private final JsonMapper json = JsonMapper.builder().build();
    private final Map<String, Seen> seen = new ConcurrentHashMap<>();

    private record Seen(Account account, long at) {}

    public FoyerAuth(@Value("${jqzz.foyer.url:http://127.0.0.1:7000}") String base) {
        this.base = base.replaceAll("/+$", "");
    }

    /** the Foyer account this request's cookie belongs to, if any */
    public Optional<Account> who(HttpServletRequest request) {
        String token = null;
        if (request.getCookies() != null) {
            for (Cookie c : request.getCookies()) {
                if (COOKIE.equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank()) token = c.getValue();
            }
        }
        if (token == null || base.isEmpty()) return Optional.empty();
        long now = System.currentTimeMillis();
        Seen s = seen.get(token);
        if (s != null && now - s.at() < KEEP_MS) return Optional.ofNullable(s.account());
        Account a = ask(token);
        if (seen.size() > 1000) seen.clear();
        seen.put(token, new Seen(a, now));
        return Optional.ofNullable(a);
    }

    private Account ask(String token) {
        // the cookie value is Foyer's own base64url and a dot; anything else isn't one
        if (!token.matches("[A-Za-z0-9_.-]{10,400}")) return null;
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(base + "/api/account"))
                    .timeout(Duration.ofSeconds(3))
                    .header("Cookie", COOKIE + "=" + token)
                    .GET().build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200) return null;
            JsonNode a = json.readTree(res.body()).path("account");
            if (a.isMissingNode() || a.isNull() || a.path("id").asString("").isEmpty()) return null;
            return new Account(a.path("id").asString(), a.path("handle").asString(""), a.path("name").asString(""));
        } catch (Exception e) {
            return null;
        }
    }
}
