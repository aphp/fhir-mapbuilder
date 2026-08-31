package fr.aphp.mapbuilder.controller;

import fr.aphp.mapbuilder.MatchBoxApplication;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

    @GetMapping("/health")
    public ResponseEntity<String> health() {
        if (MatchBoxApplication.isInitializationComplete()) {
            String message = "Application is running and fully initialized!";
            return ResponseEntity.ok(message);
        } else {
            String message = "Application is starting up. Initialization in progress.";
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(message);
        }
    }
}
