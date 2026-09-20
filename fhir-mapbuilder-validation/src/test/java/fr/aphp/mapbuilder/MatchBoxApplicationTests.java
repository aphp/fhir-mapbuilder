package fr.aphp.mapbuilder;

import static org.assertj.core.api.Assertions.assertThat;

import ch.ahdis.matchbox.engine.MatchboxEngine;
import fr.aphp.mapbuilder.config.MatchboxEngineConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.web.ServerProperties;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

/**
 * Smoke test : le contexte Spring démarre sans instance Matchbox réelle.
 *
 * <p>{@code MatchboxEngineConfig} est mocké pour ne pas construire le vrai moteur ; le bean
 * {@code matchboxEngineR4} dont dépend {@code MatchBoxService} est fourni comme mock nommé.
 */
@SpringBootTest
class MatchBoxApplicationTests {

    @MockBean
    private MatchboxEngineConfig matchboxEngineConfig;

    @MockBean(name = "matchboxEngineR4")
    private MatchboxEngine matchboxEngine;

    @Autowired
    private ServerProperties serverProperties;

    @Test
    void contextLoads() {
        // Le contexte se charge : l'assertion est l'absence d'exception au démarrage.
    }

    /**
     * L'API n'est appelée que par l'extension, depuis la même machine : elle écoute sur la boucle locale
     * uniquement. Sans {@code server.address}, Spring Boot écoute sur toutes les interfaces.
     */
    @Test
    void apiListensOnTheLoopbackInterfaceOnly() {
        assertThat(serverProperties.getAddress())
                .as("server.address doit être défini (absent = toutes les interfaces)")
                .isNotNull();
        assertThat(serverProperties.getAddress().isLoopbackAddress()).isTrue();
    }
}
