package fr.aphp.mapbuilder.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.springframework.context.ConfigurableApplicationContext;

class ShutdownControllerTest {

    @Test
    void shutdown_returnsMessage_andClosesTheContextAsynchronously() {
        ConfigurableApplicationContext context = mock(ConfigurableApplicationContext.class);

        String body = new ShutdownController(context).shutdownApplication();

        assertThat(body).isEqualTo("Application is shutting down...");
        // the controller closes the context on a background thread after a ~1s delay
        verify(context, timeout(5000)).close();
    }
}
