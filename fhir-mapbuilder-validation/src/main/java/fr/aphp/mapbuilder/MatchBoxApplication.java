package fr.aphp.mapbuilder;

import fr.aphp.mapbuilder.service.MatchBoxService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.context.event.EventListener;

@SpringBootApplication
@EnableConfigurationProperties
public class MatchBoxApplication {

    private static final Logger log = LoggerFactory.getLogger(MatchBoxApplication.class);

    @Autowired
    private MatchBoxService matchBoxService;

    private static String[] applicationArgs;
    // Flag to indicate initialization status
    private static boolean initializationComplete = false;

    public static void main(String[] args) {
        log.info("STARTING THE APPLICATION");
        applicationArgs = args;
        SpringApplication.run(MatchBoxApplication.class, args);
        log.info("APPLICATION STARTED");
    }

    @EventListener(ContextRefreshedEvent.class)
    public void onApplicationEvent() {
        log.info("Application context refreshed. Initializing packages...");
        try {
            matchBoxService.includePackages(applicationArgs);
            initializationComplete = true;
        } catch (Exception e) {
            log.error("Error during package initialization", e);
        }
    }

    // Getter for initialization status
    public static boolean isInitializationComplete() {
        return initializationComplete;
    }
}
