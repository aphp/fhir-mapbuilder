package fr.aphp.mapbuilder.service;

import fr.aphp.mapbuilder.model.CompilationError;
import fr.aphp.mapbuilder.model.ParsingError;
import fr.aphp.mapbuilder.model.TransformationError;
import fr.aphp.mapbuilder.model.ValidationError;
import fr.aphp.mapbuilder.utils.FileUtils;
import ch.ahdis.matchbox.engine.MatchboxEngine;
import ch.ahdis.matchbox.engine.ValidationPolicyAdvisor;
import ch.ahdis.matchbox.engine.cli.VersionUtil;
import org.hl7.fhir.r4.formats.JsonParser;
import org.hl7.fhir.r4.model.StructureMap;
import org.hl7.fhir.r5.elementmodel.Manager;
import org.hl7.fhir.r5.utils.validation.constants.ReferenceValidationPolicy;
import org.hl7.fhir.utilities.validation.ValidationMessage;
import org.hl7.fhir.validation.instance.InstanceValidator;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.io.FileSystemResource;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

@Service
public class MatchBoxService {

    private MatchboxEngine engine;
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(MatchBoxService.class);

    private String paramsPath;
    private String resultPath;
    private String qualityAssessmentPath;


    public MatchBoxService(@Qualifier("matchboxEngineR4") MatchboxEngine matchboxEngine) {
        this.engine = matchboxEngine;
    }


    // method that set path to files for each case with a datetime formated
    public void setPaths(String outputPath) throws IOException {
        if (outputPath == null) {
            log.error("outputPath is null!");
            return; // You should exit early to prevent null usage below
        }

        String folder = FileUtils.createOrRetrieveFolderPath(outputPath);
        String dateTime = FileUtils.generateDateTimeFormatForPath();

        paramsPath = Paths.get(folder, dateTime + "_params.log").toString();
        resultPath = Paths.get(folder, dateTime + "_result.json").toString();
        qualityAssessmentPath = Paths.get(folder, dateTime + "_qa.json").toString();
    }

    public StructureMap compile(String source) throws CompilationError {
        try {
            log.info("Start Compiling fml");
            StructureMap sm = parse(source);
            if (sm == null) {
                log.error("StructureMap is null!");
                return null;
            }

            FileUtils.writeFile(paramsPath, "FML : \n\n" + sm + "\n\n", false);
            log.info("End compiling");
            return sm;
        } catch (Exception exception) {
            throw new CompilationError("Error during compilation process: " + exception.getMessage());
        }
    }

    public StructureMap parse(String source) throws ParsingError {
        try {
            if (source == null) {
                log.error("Source is null!");
                return null;
            }

            String content = Files.readString(Path.of(source));
            StructureMap sm = engine.parseMap(content);
            handleExistingResource(sm);
            return sm;
        } catch (Exception exception) {
            throw new ParsingError("Error during parsing process: ", exception);
        }
    }

    // method that validate structureMap passed when called
    public void validate(StructureMap structureMap) throws ValidationError {
        try {
            final List<ValidationMessage> messages = new ArrayList<>();

            final String json = new JsonParser().composeString(structureMap);
            final ByteArrayInputStream stream = new ByteArrayInputStream(json.getBytes());

            final InstanceValidator validator = engine.getValidator(Manager.FhirFormat.JSON);
            validator.setPolicyAdvisor(new ValidationPolicyAdvisor(ReferenceValidationPolicy.CHECK_VALID));
            validator.validate(null, messages, stream, Manager.FhirFormat.JSON, new ArrayList<>());
            final List<ValidationMessage> validate = engine.filterValidationMessages(messages);

            // Write the json to a file to ensure the persistence of the information if we need to persist information
            if (!messages.isEmpty()) {
                FileUtils.writeFile(qualityAssessmentPath, FileUtils.serializeListObject(validate), false);
            }

        } catch (Exception exception) {
            throw new ValidationError("Error during validation process inside method doValidation");
        }
    }

    // method that transform the data send in args with engine and structureMap give in parameters
    public void transform(final StructureMap structureMap, String data, String output) throws TransformationError, IOException {
        try {
            log.info("Start data transformation");
            final String stringData = Files.readString(Path.of(data));
            FileUtils.writeFile(this.paramsPath, "DATA : \n\n" + stringData, true);

            final String result = engine.transform(stringData, true, structureMap.getUrl(), true);
            FileUtils.writeFile(this.resultPath, result, false);

            log.info("End of transformation");
            log.info("All files can be found inside " + FileUtils.createOrRetrieveFolderPath(output));
        } catch (Exception exception) {
            FileUtils.writeFile(this.resultPath, "Error during transformation process inside method doTransformation " + exception, false);
            throw new TransformationError("Error during transformation process inside method doTransformation " + exception);
        }
    }

    public void includePackages(String... args) {
        try {
            boolean result = this.includePackages(getIgs(args));
            if (result) {
                log.info("Packages included successfully.");
            }
        } catch (Exception e) {
            log.error("Error loading packages, message: {}", e.getMessage());
        }
    }


    public static List<String> getIgs(String[] args) {
        List<String> igs = new ArrayList<>();
        for (int i = 0; i < args.length; i++) {
            if ("-ig".equals(args[i])) {
                if (i + 1 < args.length) {
                    igs.add(args[++i]);
                } else {
                    log.warn("Argument '-ig' provided without a value.");
                }
            }
        }
        return igs;
    }

    public boolean includePackages(List<String> igPaths) {
        log.info("Initializing Packages. Memory Info: {}", VersionUtil.getMemory());
        // Load custom implementation guides from igPaths
        return loadCustomGuides(igPaths);
    }


    public boolean resetAndLoadEngine(List<String> packagePaths) {
        this.engine = new MatchboxEngine.MatchboxEngineBuilder().getEngineR4();
        return includePackages(packagePaths);
    }

    /**
     * Loads custom implementation guides from a list of paths.
     */
    public boolean loadCustomGuides(List<String> igPaths) {
        if (igPaths == null || igPaths.isEmpty()) {
            log.warn("No implementation guides found in parameters.");
            return false;
        }

        log.info("Loading packages from output folder. IG paths: {}", String.join(", ", igPaths));
        boolean success = false;

        for (String igPath : igPaths) {
            try (InputStream inputStream = new FileSystemResource(igPath).getInputStream()) {
                engine.loadPackage(inputStream);
                success = true;
            } catch (Exception e) {
                log.error("Error loading package from output folder. IG path: {}", igPath, e);
            }
        }

        return success;
    }
    private void handleExistingResource(StructureMap sm) {
        if (engine.getContext().hasResource(org.hl7.fhir.r5.model.StructureMap.class, sm.getUrl())) {
            engine.getContext().dropResource(
                    engine.getContext().fetchResource(org.hl7.fhir.r5.model.StructureMap.class, sm.getUrl())
            );
        }
        engine.addCanonicalResource(sm);
    }

}
