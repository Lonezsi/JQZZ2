package com.lonezsi.jqzz.service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.json.JsonMapper;

/**
 * Google sign-in. The page's own button opens Google's popup and gets back an
 * access token; Google says at its tokeninfo endpoint whether the token is
 * live, which app it was issued to and whose it is, and only a token issued
 * to this app is taken. Then its userinfo gives the name and picture.
 *
 * Off unless jqzz.google.client-id is set (JQZZ_GOOGLE_CLIENT_ID).
 */
@Service
public class GoogleAuth {

    /** who Google says signed in */
    public record Account(String sub, String email, String name, String picture) {}

    private static final String TOKENINFO = "https://oauth2.googleapis.com/tokeninfo?access_token=";
    private static final String USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";

    private final String clientId;
    private final JsonMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();

    public GoogleAuth(@Value("${jqzz.google.client-id:}") String clientId, JsonMapper json) {
        this.clientId = clientId == null ? "" : clientId.trim();
        this.json = json;
    }

    public boolean enabled() {
        return !clientId.isEmpty();
    }

    public String clientId() {
        return clientId;
    }

    public Account verify(String accessToken) {
        if (!enabled()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Google sign-in isn't set up here");
        if (accessToken == null || accessToken.isBlank()) throw bad("No Google sign-in came with that");

        Map<String, Object> token = get(TOKENINFO + URLEncoder.encode(accessToken, StandardCharsets.UTF_8), null);
        if (token == null) throw bad("Google didn't accept that sign-in. Try again");
        // issued to this app, not to some other site that got hold of a token
        if (!clientId.equals(token.get("aud")) && !clientId.equals(token.get("azp"))) {
            throw bad("That sign-in was meant for another app");
        }
        long expiresIn = Long.parseLong(String.valueOf(token.getOrDefault("expires_in", "0")));
        if (expiresIn <= 0) throw bad("That sign-in has expired. Try again");
        String sub = (String) token.get("sub");
        if (sub == null || sub.isBlank()) throw bad("Google didn't say who signed in");

        Map<String, Object> info = get(USERINFO, accessToken);
        if (info == null || !sub.equals(info.get("sub"))) info = Map.of();
        boolean verified = "true".equals(String.valueOf(token.getOrDefault("email_verified", info.get("email_verified"))));
        String email = (String) (token.get("email") != null ? token.get("email") : info.get("email"));
        return new Account(sub, verified ? email : null, (String) info.get("name"), (String) info.get("picture"));
    }

    /** a JSON answer from Google, or null when it said no */
    @SuppressWarnings("unchecked")
    private Map<String, Object> get(String url, String bearer) {
        try {
            HttpRequest.Builder request = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(10)).GET();
            if (bearer != null) request.header("Authorization", "Bearer " + bearer);
            HttpResponse<String> response = http.send(request.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) return null;
            return json.readValue(response.body(), Map.class);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Couldn't reach Google to check the sign-in");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Couldn't reach Google to check the sign-in");
        }
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
