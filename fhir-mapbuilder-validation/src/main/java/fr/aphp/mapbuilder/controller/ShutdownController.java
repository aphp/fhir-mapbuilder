package fr.aphp.mapbuilder.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ShutdownController {

    private final ConfigurableApplicationContext context;

    @Autowired
    public ShutdownController(ConfigurableApplicationContext context) {
        this.context = context;
    }

    @GetMapping("/shutdown")
    public String shutdownApplication() {
        new Thread(() -> {
                    try {
                        Thread.sleep(1000); // Delay for graceful shutdown
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                    context.close(); // Close the application context
                })
                .start();

        return "Application is shutting down...";
    }
}
