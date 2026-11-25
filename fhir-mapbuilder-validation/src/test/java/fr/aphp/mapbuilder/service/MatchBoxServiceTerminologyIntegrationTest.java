package fr.aphp.mapbuilder.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;
import java.util.zip.GZIPOutputStream;
import org.apache.commons.compress.archivers.tar.TarArchiveEntry;
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream;
import org.hl7.fhir.r4.model.StructureMap;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.io.TempDir;

/**
 * Terminology resources of the loaded packages must reach the engine on every OS (#276).
 *
 * <p>On Windows, matchbox-engine 4.1.x skipped every CodeSystem, ValueSet, NamingSystem and
 * ConceptMap, of the core packages and of the IG packages alike: {@code translate()} could not
 * find the IG's ConceptMap and the StructureMap QA reported the core ValueSets as not found. The
 * fix is the shadowed {@code ch.ahdis.matchbox.engine.packages.LazyTerminologyLoader}. This test
 * replays the reproduction of the issue through {@link MatchBoxService}; it only fails on Windows
 * without the fix, so run it there ({@code mvn verify}) after any change to the shadow or to the
 * matchbox version.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class MatchBoxServiceTerminologyIntegrationTest {

    private static final String PACKAGE_FOLDER = "integration/terminology-package/";
    private static final List<String> PACKAGE_FILES = List.of("package.json", ".index.json", "ConceptMap-gender.json");

    @TempDir
    static Path workDir;

    private MatchBoxService service;
    private String fml;
    private String inputJson;

    @BeforeAll
    void setUp() throws Exception {
        Path tgz = buildPackage(workDir.resolve("package.tgz"));
        fml = copyResource("integration/translate.map", workDir.resolve("translate.map"));
        inputJson = copyResource("integration/input.json", workDir.resolve("input.json"));

        service = new MatchBoxService(null);
        assertThat(service.resetAndLoadEngine(List.of(tgz.toString()))).isTrue();
    }

    @Test
    void transform_translatesWithAConceptMapOfTheLoadedPackage() throws Exception {
        Path out = Files.createDirectories(workDir.resolve("transform"));
        service.setPaths(out.toString());
        StructureMap sm = service.compile(fml);

        service.transform(sm, inputJson, out.toString());

        String result = Files.readString(findOutput(out, "_result.json").orElseThrow());
        assertThat((String) JsonPath.read(result, "$.id")).isEqualTo("pat1");
        // the ConceptMap maps female -> male: only a resolved ConceptMap gives "male"
        assertThat((String) JsonPath.read(result, "$.gender")).isEqualTo("male");
    }

    @Test
    void validate_findsTheCoreValueSets() throws Exception {
        Path out = Files.createDirectories(workDir.resolve("validate"));
        service.setPaths(out.toString());
        StructureMap sm = service.compile(fml);

        service.validate(sm);

        // the QA file is only written when there are messages
        Optional<Path> qa = findOutput(out, "_qa.json");
        if (qa.isPresent()) {
            assertThat(Files.readString(qa.get()))
                    .doesNotContainPattern("ValueSet 'http://hl7.org/fhir/ValueSet/[^']*' not found");
        }
    }

    /** Builds an IG package as the IG Publisher does: a {@code package/} folder with its index. */
    private Path buildPackage(Path tgz) throws IOException {
        try (OutputStream file = Files.newOutputStream(tgz);
                GZIPOutputStream gzip = new GZIPOutputStream(file);
                TarArchiveOutputStream tar = new TarArchiveOutputStream(gzip)) {
            for (String name : PACKAGE_FILES) {
                byte[] content = readResource(PACKAGE_FOLDER + name);
                TarArchiveEntry entry = new TarArchiveEntry("package/" + name);
                entry.setSize(content.length);
                tar.putArchiveEntry(entry);
                tar.write(content);
                tar.closeArchiveEntry();
            }
        }
        return tgz;
    }

    private byte[] readResource(String classpath) throws IOException {
        try (InputStream in = getClass().getClassLoader().getResourceAsStream(classpath)) {
            assertThat(in).as(classpath).isNotNull();
            return in.readAllBytes();
        }
    }

    private String copyResource(String classpath, Path dest) throws IOException {
        Files.write(dest, readResource(classpath));
        return dest.toString();
    }

    private static Optional<Path> findOutput(Path dir, String suffix) throws IOException {
        try (var files = Files.walk(dir)) {
            return files.filter(p -> p.toString().endsWith(suffix)).findFirst();
        }
    }
}
