package com.campus.tracking.security;

import com.campus.tracking.model.User;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Issues and verifies HS256 JWTs. The signing secret comes from {@code app.jwt.secret}
 * (env {@code APP_JWT_SECRET}); when absent, a random per-process secret is generated so
 * no secret is ever hardcoded, at the cost of invalidating tokens on restart.
 */
@Service
public class JwtService {

    public static final String ISSUER = "campus-tracking";
    private static final Logger log = LoggerFactory.getLogger(JwtService.class);

    private final SecretKey key;
    private final long expiryMinutes;
    private final JwtEncoder encoder;
    private final JwtDecoder decoder;

    public JwtService(@Value("${app.jwt.secret:}") String secret,
                      @Value("${app.jwt.expiry-minutes:480}") long expiryMinutes) {
        this.key = new SecretKeySpec(resolveSecret(secret), "HmacSHA256");
        this.expiryMinutes = expiryMinutes;
        this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(key));
        NimbusJwtDecoder nimbusDecoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        nimbusDecoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(ISSUER));
        this.decoder = nimbusDecoder;
    }

    private static byte[] resolveSecret(String secret) {
        if (secret == null || secret.isBlank()) {
            log.warn("app.jwt.secret (APP_JWT_SECRET) is not set; using a random secret. "
                    + "Sessions will be invalidated whenever the server restarts.");
            byte[] random = new byte[32];
            new SecureRandom().nextBytes(random);
            return random;
        }
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("app.jwt.secret must be at least 32 bytes long");
        }
        return bytes;
    }

    public IssuedToken issue(User user) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(expiryMinutes, ChronoUnit.MINUTES);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(ISSUER)
                .subject(String.valueOf(user.getId()))
                .issuedAt(now)
                .expiresAt(expiresAt)
                .claim("role", user.getRole().name())
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String token = encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new IssuedToken(token, expiresAt);
    }

    public JwtDecoder decoder() {
        return decoder;
    }

    public record IssuedToken(String token, Instant expiresAt) {
    }
}
