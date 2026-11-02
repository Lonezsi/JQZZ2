package com.lonezsi.jqzz.config;

import java.time.Duration;
import java.util.Arrays;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * The built frontend's /assets: every file there has its content's hash in its
 * name, so a browser may keep it for a year without asking again. A new build
 * has new names. Everything else (index.html above all) is still checked on
 * every visit, so a deploy shows up at once.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final String[] assets;

    public WebConfig(@Value("${spring.web.resources.static-locations:classpath:/static/}") String[] locations) {
        this.assets = Arrays.stream(locations)
                .map(l -> l.endsWith("/") ? l + "assets/" : l + "/assets/")
                .toArray(String[]::new);
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/assets/**")
                .addResourceLocations(assets)
                .setCacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable());
    }
}
