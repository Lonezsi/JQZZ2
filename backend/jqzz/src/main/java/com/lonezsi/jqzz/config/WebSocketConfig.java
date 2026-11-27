package com.lonezsi.jqzz.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    /** the site's own address, and localhost for development */
    @org.springframework.beans.factory.annotation.Value("${jqzz.ws.origins:https://jriter.dikdik-kettle.ts.net,http://localhost:*,http://127.0.0.1:*}")
    private String[] origins;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws").setAllowedOriginPatterns(origins)
                .addInterceptors(new KeyHandshake()).withSockJS();
    }

    /** the key cookie of the page that opens the socket says who it is: the page never holds the key */
    static final class KeyHandshake implements org.springframework.web.socket.server.HandshakeInterceptor {
        @Override
        public boolean beforeHandshake(org.springframework.http.server.ServerHttpRequest request,
                org.springframework.http.server.ServerHttpResponse response,
                org.springframework.web.socket.WebSocketHandler handler, java.util.Map<String, Object> attributes) {
            if (request instanceof org.springframework.http.server.ServletServerHttpRequest servlet) {
                String key = LoginKeyFilter.keyOf(servlet.getServletRequest());
                if (key != null && !key.isBlank()) attributes.put("loginKey", key);
            }
            return true;
        }

        @Override
        public void afterHandshake(org.springframework.http.server.ServerHttpRequest request,
                org.springframework.http.server.ServerHttpResponse response,
                org.springframework.web.socket.WebSocketHandler handler, Exception exception) {
        }
    }
}