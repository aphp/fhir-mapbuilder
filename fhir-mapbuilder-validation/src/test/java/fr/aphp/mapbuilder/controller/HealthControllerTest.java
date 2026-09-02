package fr.aphp.mapbuilder.controller;

import static org.assertj.core.api.Assertions.assertThat;

import fr.aphp.mapbuilder.MatchBoxApplication;
import java.lang.reflect.Field;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * Both branches of {@code /health}, driven by {@link MatchBoxApplication}'s
 * static initialization flag (flipped by reflection — there is no setter).
 */
class HealthControllerTest {

    private final HealthController controller = new HealthController();

    @BeforeEach
    @AfterEach
    void resetFlag() throws Exception {
        setInitializationComplete(false);
    }

    private static void setInitializationComplete(boolean value) throws Exception {
        Field f = MatchBoxApplication.class.getDeclaredField("initializationComplete");
        f.setAccessible(true);
        f.setBoolean(null, value);
    }

    @Test
    void health_returns200_whenInitializationIsComplete() throws Exception {
        setInitializationComplete(true);

        ResponseEntity<String> response = controller.health();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("fully initialized");
    }

    @Test
    void health_returns503_whileStillStartingUp() {
        ResponseEntity<String> response = controller.health();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody()).contains("starting up");
    }
}
