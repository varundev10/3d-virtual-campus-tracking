package com.campus.tracking.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Autowired
    private DatabaseJwtAuthenticationConverter jwtAuthenticationConverter;

    @Value("${app.cors.allowed-origins:http://localhost:5173,http://127.0.0.1:5173}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // Stateless bearer-token API: no cookies are used for auth, so CSRF does not apply.
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(h -> h.frameOptions(f -> f.sameOrigin()))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login", "/api/auth/register").permitAll()
                        // Names only, so the registration form can offer a department choice.
                        .requestMatchers(HttpMethod.GET, "/api/auth/departments").permitAll()
                        // SockJS handshake; STOMP frames are authenticated by StompAuthChannelInterceptor.
                        .requestMatchers("/ws/**").permitAll()
                        .requestMatchers("/actuator/health", "/error").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/faculty/**").hasAnyRole("FACULTY", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/alerts/*/acknowledge").hasAnyRole("FACULTY", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/users").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/users").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/users/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/users/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/users/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/attendance/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/campus-locations/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/campus-locations/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/campus-locations/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                .oauth2ResourceServer(o -> o
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter))
                        .authenticationEntryPoint((req, res, ex) ->
                                writeJson(res, HttpServletResponse.SC_UNAUTHORIZED, "Authentication required"))
                        .accessDeniedHandler((req, res, ex) ->
                                writeJson(res, HttpServletResponse.SC_FORBIDDEN, "You do not have permission for this action")))
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) ->
                                writeJson(res, HttpServletResponse.SC_UNAUTHORIZED, "Authentication required"))
                        .accessDeniedHandler((req, res, ex) ->
                                writeJson(res, HttpServletResponse.SC_FORBIDDEN, "You do not have permission for this action")));
        return http.build();
    }

    private static void writeJson(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write("{\"message\":\"" + message + "\"}");
    }

    @Bean
    public JwtDecoder jwtDecoder(JwtService jwtService) {
        return jwtService.decoder();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOriginList());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }

    public List<String> allowedOriginList() {
        return Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
