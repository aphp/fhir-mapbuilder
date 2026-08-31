package fr.aphp.mapbuilder.config;

import ch.ahdis.matchbox.engine.MatchboxEngine;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MatchboxEngineConfig {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(MatchboxEngineConfig.class);

    @Bean("matchboxEngineR4")
    public MatchboxEngine matchboxEngine() {
        log.info("Initializing MatchboxEngine...");
        return new MatchboxEngine.MatchboxEngineBuilder().getEngineR4();
    }


    @Bean
    public WebServerFactoryCustomizer<TomcatServletWebServerFactory> serverPortCustomizer() {
        return factory -> {
            String port = System.getProperty("server.port", "9031");
            factory.setPort(Integer.parseInt(port));
        };
    }
}
