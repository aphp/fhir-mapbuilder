package fr.aphp.mapbuilder.controller;

import fr.aphp.mapbuilder.model.CompilationError;
import fr.aphp.mapbuilder.model.ParsingError;
import fr.aphp.mapbuilder.model.TransformationError;
import fr.aphp.mapbuilder.model.ValidationError;
import fr.aphp.mapbuilder.service.MatchBoxService;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import org.hl7.fhir.r4.model.StructureMap;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/matchbox")
public class MatchBoxController {
    // Unexpected failures never echo the exception text; the detail goes to the server log
    private static final String UNEXPECTED_ERROR_PREFIX = "Unexpected error during ";
    private static final String SEE_LOGS = ". See the validation server logs.";

    private final MatchBoxService matchBoxService;
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(MatchBoxController.class);

    public MatchBoxController(MatchBoxService matchBoxService) {
        this.matchBoxService = matchBoxService;
    }

    @GetMapping("/validate")
    public ResponseEntity<String> validate(
            @RequestParam String source, @RequestParam String data, @RequestParam String output) {

        log.info("Get Validate Request, source:{}, data:{}, output:{}", source, data, output);

        try {
            // Set output paths and compile the StructureMap
            matchBoxService.setPaths(output);
            StructureMap structureMap = matchBoxService.compile(source);

            // Validate and transform if structureMap is available
            return Optional.ofNullable(structureMap)
                    .map(map -> {
                        try {
                            matchBoxService.validate(map);
                            matchBoxService.transform(map, data, output);
                        } catch (ValidationError e) {
                            log.error("Validation error: {}", e.getMessage(), e);
                            return createErrorResponse("Error during validation: " + e.getMessage());
                        } catch (TransformationError e) {
                            log.error("Transformation error: {}", e.getMessage(), e);
                            return createErrorResponse("Error during transformation: " + e.getMessage());
                        } catch (IOException e) {
                            log.error("IO error: {}", e.getMessage(), e);
                            return createErrorResponse("IO Error : " + e.getMessage());
                        }
                        String successMessage = "Validation and transformation are OK";
                        return ResponseEntity.ok(successMessage);
                    })
                    .orElseGet(() -> {
                        String errorMessage = "StructureMap is null!";
                        log.error(errorMessage);
                        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                                .body(errorMessage);
                    });

        } catch (CompilationError e) {
            // The FML compilation message is the product's output for the user
            log.error("Compilation error: {}", e.getMessage(), e);
            return createErrorResponse("Unexpected error: " + e.getMessage());
        } catch (Exception e) {
            log.error("Unexpected error during validation process", e);
            return createErrorResponse(UNEXPECTED_ERROR_PREFIX + "validation" + SEE_LOGS);
        }
    }

    @GetMapping("/parse")
    public ResponseEntity<String> parse(@RequestParam String source) {

        log.info("Get Parsing Request, source:{}", source);

        try {
            matchBoxService.parse(source);
            return ResponseEntity.ok("structureMap is parsed!");

        } catch (ParsingError e) {
            log.error("Parsing error", e);
            return createErrorResponse("Unexpected error: " + e.getMessage());
        } catch (Exception e) {
            log.error("Unexpected error during parsing process", e);
            return createErrorResponse(UNEXPECTED_ERROR_PREFIX + "parsing" + SEE_LOGS);
        }
    }

    @GetMapping("/resetAndLoadEngine")
    public ResponseEntity<Boolean> path(@RequestParam String path) {
        boolean result = this.matchBoxService.resetAndLoadEngine(List.of(path));
        return ResponseEntity.ok(result);
    }

    /**
     * Helper method to create a consistent error response.
     */
    private ResponseEntity<String> createErrorResponse(String message) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(message);
    }
}
