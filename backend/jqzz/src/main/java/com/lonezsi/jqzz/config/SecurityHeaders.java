package com.lonezsi.jqzz.config;

import java.io.IOException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * The same few headers on every response: nobody frames the site, nothing is
 * sniffed into another type, and the page may only run its own scripts (so an
 * injected one, here or on JR!TER / Foyer next door, has nothing to run).
 *
 * Fonts are served from here. https: images stay for profile pictures and the editor's preview of a
 * link before it's saved; games only get JQZZ's own pictures (QuizPictures, Condom 6).
 * Routes that set their own stricter CSP (pictures) get both; the browser
 * applies both, so the stricter one wins.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SecurityHeaders extends OncePerRequestFilter {

    private final String csp;

    public SecurityHeaders(@Value("${jqzz.google.client-id:}") String google) {
        String g = google == null || google.isBlank() ? "" : " https://accounts.google.com";
        this.csp = "default-src 'self'; script-src 'self'" + g
                + "; style-src 'self' 'unsafe-inline'" + g
                + "; font-src 'self' data:"
                + "; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:"
                + "; connect-src 'self' data: blob:; worker-src 'self' blob:; frame-src 'self'" + g
                + "; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");
        response.setHeader("Referrer-Policy", "same-origin");
        response.setHeader("Content-Security-Policy", csp);
        chain.doFilter(request, response);
    }
}
