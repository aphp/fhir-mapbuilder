package fr.aphp.mapbuilder.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.aphp.mapbuilder.config.ApiTokenFilter;
import fr.aphp.mapbuilder.service.MatchBoxService;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/**
 * The API token is the security boundary of the validation server: every endpoint
 * except {@code /health} must reject callers that do not present it.
 */
@ExtendWith(OutputCaptureExtension.class)
@WebMvcTest(
        controllers = {MatchBoxController.class, HealthController.class, ShutdownController.class},
        properties = "mapbuilder.api.token=secret-token")
class ApiTokenAuthenticationTest {

    private static final String HEADER = "X-MapBuilder-Token";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private MatchBoxService matchBoxService;

    @Test
    void api_returns401_whenTokenIsMissing() throws Exception {
        mockMvc.perform(get("/api/matchbox/parse").param("source", "map.fml"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().string(""));
    }

    @Test
    void api_returns401_whenTokenIsWrong() throws Exception {
        mockMvc.perform(get("/api/matchbox/parse").param("source", "map.fml").header(HEADER, "not-the-token"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().string(""));
    }

    @Test
    void api_returns200_whenTokenIsCorrect() throws Exception {
        mockMvc.perform(get("/api/matchbox/parse").param("source", "map.fml").header(HEADER, "secret-token"))
                .andExpect(status().isOk());
    }

    /**
     * The extension probes the token with a parameterless call: the token check must answer before parameter
     * binding, so 401 means a rejected token and anything else means an accepted one.
     */
    @Test
    void tokenProbe_isRejectedBeforeParameterBinding() throws Exception {
        mockMvc.perform(get("/api/matchbox/parse")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/matchbox/parse").header(HEADER, "not-the-token"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/matchbox/parse").header(HEADER, "secret-token"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shutdown_returns401_whenTokenIsMissing() throws Exception {
        mockMvc.perform(get("/shutdown")).andExpect(status().isUnauthorized());
    }

    @Test
    void health_isReachable_withoutToken() throws Exception {
        int status = mockMvc.perform(get("/health")).andReturn().getResponse().getStatus();

        // 200 or 503 depending on startup progress: anything but 401
        assertThat(status).isIn(200, 503);
    }

    @Test
    void generatedToken_isLoggedOnce_andAuthenticatesRequests(CapturedOutput output) throws Exception {
        MockMvc standalone = MockMvcBuilders.standaloneSetup(
                        new MatchBoxController(Mockito.mock(MatchBoxService.class)),
                        new ShutdownController(Mockito.mock(ConfigurableApplicationContext.class)))
                .addFilters(new ApiTokenFilter(""))
                .build();

        Matcher logged =
                Pattern.compile("API token \\(generated\\): ([0-9a-f]{64})").matcher(output);
        assertThat(logged.find()).as("generated token is logged").isTrue();
        assertThat(logged.find()).as("generated token is logged only once").isFalse();
        logged.reset().find();

        standalone
                .perform(get("/api/matchbox/parse").param("source", "map.fml"))
                .andExpect(status().isUnauthorized());
        standalone
                .perform(get("/api/matchbox/parse").param("source", "map.fml").header(HEADER, logged.group(1)))
                .andExpect(status().isOk());
    }
}
