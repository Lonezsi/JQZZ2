package com.lonezsi.jqzz.config;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.lonezsi.jqzz.model.User;
import com.lonezsi.jqzz.repository.UserRepository;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Who a request is, proven. Requests say who they act for in many places (an
 * X-User-Id header, a userId parameter, a userId / adminId / authorId field in
 * the body, /users/{id}/...), and ids are public, so on their own they prove
 * nothing. Any request that names someone must carry that someone's login key:
 * in the X-Login-Key header, or for plain GETs (pictures in &lt;img&gt; tags) in
 * the jqzz_key cookie set at login. Requests that name nobody pass as before.
 *
 * Controllers can read the proven id from the request attribute {@link #USER}.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class LoginKeyFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Login-Key";
    public static final String COOKIE = "jqzz_key";
    public static final String USER = "jqzz.user";

    private static final Set<String> PARAMS = Set.of("userId", "ownerId", "adminId");
    private static final Set<String> BODY_FIELDS = Set.of("userId", "adminId", "authorId", "hostId", "ownerId");
    /** /users/{x} that aren't an account */
    private static final Set<String> USER_ROUTES = Set.of("register", "login", "logout", "google");

    private final UserRepository users;
    private final boolean enforced;
    private final JsonMapper json = JsonMapper.builder().build();

    public LoginKeyFilter(UserRepository users, @Value("${jqzz.auth.enforce-login-key:true}") boolean enforced) {
        this.users = users;
        this.enforced = enforced;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return "OPTIONS".equals(request.getMethod())
                || path.startsWith("/ws")
                || path.equals("/users/register")
                || path.equals("/users/login")
                || path.startsWith("/users/google/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        boolean reading = "GET".equals(request.getMethod()) || "HEAD".equals(request.getMethod());
        String key = request.getHeader(HEADER);
        // the cookie only counts for reading: another site can make a browser send it on a POST
        if ((key == null || key.isBlank()) && reading) key = cookie(request);
        String me = key == null || key.isBlank() ? null : users.findByLoginKey(key).map(User::getId).orElse(null);
        if (me != null) request.setAttribute(USER, me);
        // the admin panel acts on other people's things by design; AdminController checks it's the admin
        if (request.getRequestURI().startsWith("/admin/")) {
            chain.doFilter(request, response);
            return;
        }

        HttpServletRequest req = request;
        Set<String> claimed = new LinkedHashSet<>();
        String header = request.getHeader("X-User-Id");
        if (header != null && !header.isBlank()) claimed.add(header);
        for (String p : PARAMS) {
            String v = request.getParameter(p);
            if (v != null && !v.isBlank()) claimed.add(v);
        }
        String[] parts = request.getRequestURI().split("/");
        if (!reading && parts.length >= 3 && "users".equals(parts[1]) && !USER_ROUTES.contains(parts[2])) {
            claimed.add(parts[2]);
        }
        String type = request.getContentType();
        if (!reading && type != null && type.contains("json")) {
            byte[] body = request.getInputStream().readAllBytes();
            req = new CachedBody(request, body);
            claimed.addAll(bodyClaims(body, request.getRequestURI().equals("/users/logout")));
        }

        if (enforced && !claimed.isEmpty()) {
            if (me == null) {
                response.sendError(HttpStatus.UNAUTHORIZED.value(), "log in again: this needs your login key");
                return;
            }
            if (!claimed.stream().allMatch(me::equals)) {
                response.sendError(HttpStatus.FORBIDDEN.value(), "that isn't your account");
                return;
            }
        }
        chain.doFilter(req, response);
    }

    private Set<String> bodyClaims(byte[] body, boolean logout) {
        Set<String> out = new LinkedHashSet<>();
        if (body.length == 0) return out;
        try {
            JsonNode node = json.readTree(body);
            if (node == null || !node.isObject()) return out;
            for (Map.Entry<String, JsonNode> field : node.properties()) {
                boolean names = BODY_FIELDS.contains(field.getKey()) || (logout && field.getKey().equals("id"));
                if (names && field.getValue().isString() && !field.getValue().asString().isBlank()) {
                    out.add(field.getValue().asString());
                }
            }
        } catch (RuntimeException e) {
            // not JSON after all: the controller will say so
        }
        return out;
    }

    private static String cookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) if (COOKIE.equals(c.getName())) return c.getValue();
        return null;
    }

    /** the request again, its body read once here and readable again downstream */
    private static final class CachedBody extends HttpServletRequestWrapper {
        private final byte[] body;

        CachedBody(HttpServletRequest request, byte[] body) {
            super(request);
            this.body = body;
        }

        @Override
        public ServletInputStream getInputStream() {
            ByteArrayInputStream in = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override public int read() { return in.read(); }
                @Override public int read(byte[] b, int off, int len) { return in.read(b, off, len); }
                @Override public boolean isFinished() { return in.available() == 0; }
                @Override public boolean isReady() { return true; }
                @Override public void setReadListener(ReadListener listener) {}
            };
        }

        @Override
        public BufferedReader getReader() {
            return new BufferedReader(new InputStreamReader(getInputStream(), StandardCharsets.UTF_8));
        }

        @Override
        public int getContentLength() {
            return body.length;
        }

        @Override
        public long getContentLengthLong() {
            return body.length;
        }
    }
}
