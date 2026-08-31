package fr.aphp.mapbuilder;

import ch.ahdis.matchbox.engine.MatchboxEngine;
import fr.aphp.mapbuilder.config.MatchboxEngineConfig;
import org.junit.jupiter.api.Test;
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

    @Test
    void contextLoads() {
        // Le contexte se charge : l'assertion est l'absence d'exception au démarrage.
    }
}
