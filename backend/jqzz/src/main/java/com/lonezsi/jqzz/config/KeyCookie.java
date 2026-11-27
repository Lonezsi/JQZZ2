package com.lonezsi.jqzz.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.HttpServletResponse;

/**
 * The login key as a cookie too, for the requests that can't carry a header:
 * pictures in &lt;img&gt; tags. Script can't read it, and other sites can't make
 * a browser send it with anything but a plain GET.
 *
 * Secure (the public site is https only), and on the path the browser sees
 * (the Funnel strips /jqzz before the request gets here), so JR!TER and Foyer
 * next door never receive it. When the path isn't "/", the old cookie at "/"
 * is expired, or the browser would keep sending both.
 */
@Component
public class KeyCookie {

    private final boolean secure;
    private final String path;

    public KeyCookie(@Value("${jqzz.cookie.secure:true}") boolean secure,
                     @Value("${jqzz.cookie.path:/}") String path) {
        this.secure = secure;
        this.path = path;
    }

    public void set(HttpServletResponse response, String key) {
        if (key == null) return;
        response.addHeader(HttpHeaders.SET_COOKIE, build(key, path, java.time.Duration.ofDays(400)).toString());
        if (!"/".equals(path)) {
            response.addHeader(HttpHeaders.SET_COOKIE, build("", "/", java.time.Duration.ZERO).toString());
        }
    }

    /** signing out: the cookie goes */
    public void clear(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, build("", path, java.time.Duration.ZERO).toString());
        if (!"/".equals(path)) {
            response.addHeader(HttpHeaders.SET_COOKIE, build("", "/", java.time.Duration.ZERO).toString());
        }
    }

    private ResponseCookie build(String value, String where, java.time.Duration age) {
        return ResponseCookie.from(LoginKeyFilter.COOKIE, value)
                .httpOnly(true)
                .secure(secure)
                .sameSite("Lax")
                .path(where)
                .maxAge(age)
                .build();
    }
}
