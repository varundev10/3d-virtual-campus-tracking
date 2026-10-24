package com.campus.tracking.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Component;

import java.security.Principal;

/**
 * Authenticates STOMP sessions with the same JWT used for REST calls (sent as the
 * {@code Authorization} header of the CONNECT frame) and restricts the campus-wide
 * location feed to administrators.
 */
@Component
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    public static final String LOCATIONS_TOPIC = "/topic/locations";

    @Autowired
    private JwtService jwtService;

    @Autowired
    private DatabaseJwtAuthenticationConverter converter;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) return message;

        StompCommand command = accessor.getCommand();
        if (StompCommand.CONNECT.equals(command)) {
            String header = accessor.getFirstNativeHeader("Authorization");
            if (header == null || !header.startsWith("Bearer ")) {
                throw new MessagingException("Missing bearer token");
            }
            try {
                Authentication auth = converter.convert(jwtService.decoder().decode(header.substring(7)));
                accessor.setUser(auth);
            } catch (JwtException | AuthenticationException e) {
                throw new MessagingException("Invalid or expired token");
            }
        } else if (StompCommand.SUBSCRIBE.equals(command) || StompCommand.SEND.equals(command)) {
            Principal user = accessor.getUser();
            if (!(user instanceof Authentication auth) || !auth.isAuthenticated()) {
                throw new MessagingException("Authentication required");
            }
            boolean admin = auth.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
            if (StompCommand.SUBSCRIBE.equals(command) && LOCATIONS_TOPIC.equals(accessor.getDestination()) && !admin) {
                throw new MessagingException("Admin role required for the campus location feed");
            }
        }
        return message;
    }
}
