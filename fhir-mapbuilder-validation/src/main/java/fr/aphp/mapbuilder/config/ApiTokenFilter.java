package fr.aphp.mapbuilder.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.HexFormat;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Rejects every request that does not carry the API token, except {@code /health}.
 *
 * <p>Deny by default: a new endpoint is protected without having to be listed here. When no token is configured
 * (standalone jar), one is generated at startup and logged once.
 */
@Component
public class ApiTokenFilter extends OncePerRequestFilter {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(ApiTokenFilter.class);

    private static final String HEADER = "X-MapBuilder-Token";

    private static final String OPEN_PATH = "/health";
    private static final int GENERATED_TOKEN_BYTES = 32;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final byte[] token;

    public ApiTokenFilter(@Value("${mapbuilder.api.token:}") String configuredToken) {
        String effectiveToken = configuredToken;
        if (effectiveToken == null || effectiveToken.isBlank()) {
            byte[] random = new byte[GENERATED_TOKEN_BYTES];
            RANDOM.nextBytes(random);
            effectiveToken = HexFormat.of().formatHex(random);
            log.info("API token (generated): {}", effectiveToken);
        }
        this.token = effectiveToken.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return OPEN_PATH.equals(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String candidate = request.getHeader(HEADER);
        if (candidate != null && MessageDigest.isEqual(token, candidate.getBytes(StandardCharsets.UTF_8))) {
            filterChain.doFilter(request, response);
        } else {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        }
    }
}
