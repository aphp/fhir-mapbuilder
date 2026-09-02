package fr.aphp.mapbuilder.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ch.ahdis.matchbox.engine.MatchboxEngine;
import com.jayway.jsonpath.JsonPath;
import fr.aphp.mapbuilder.model.CompilationError;
import fr.aphp.mapbuilder.model.ParsingError;
import fr.aphp.mapbuilder.model.TransformationError;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import org.hl7.fhir.r4.model.StructureMap;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.io.TempDir;

/**
 * Exercise {@link MatchBoxService} against a real, offline R4 Matchbox engine.
 *
 * <p>The {@code matchbox-engine} jar bundles {@code hl7.fhir.r4.core}, so {@code getEngineR4()}
 * needs no network. One engine is built for the whole class ({@code PER_CLASS}).
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class MatchBoxServiceIntegrationTest {

    private static final String MAP_URL = "http://aphp.fr/fhir/StructureMap/tiny";

    private MatchBoxService service;

    @TempDir
    static Path outDir;

    private String fml;
    private String inputJson;

    @BeforeAll
    void setUp() throws Exception {
        MatchboxEngine engine = new MatchboxEngine.MatchboxEngineBuilder().getEngineR4();
        service = new MatchBoxService(engine);
        fml = copyResource("integration/tiny.map", "tiny.map");
        inputJson = copyResource("integration/input.json", "input.json");
        service.setPaths(outDir.toString());
    }

    private String copyResource(String classpath, String name) throws IOException {
        Path dest = outDir.resolve(name);
        try (InputStream in = getClass().getClassLoader().getResourceAsStream(classpath)) {
            assertThat(in).as(classpath).isNotNull();
            Files.write(dest, in.readAllBytes());
        }
        return dest.toString();
    }

    @Test
    void compile_parsesFmlIntoAStructureMap() throws Exception {
        StructureMap sm = service.compile(fml);

        assertThat(sm).isNotNull();
        assertThat(sm.getUrl()).isEqualTo(MAP_URL);
        try (var files = Files.list(outDir)) {
            assertThat(files.anyMatch(p -> p.toString().endsWith("_params.log")))
                    .isTrue();
        }
    }

    @Test
    void parse_isIdempotent_whenTheMapIsAlreadyRegistered() throws Exception {
        // first parse registers the canonical resource; the second exercises the drop + re-add branch
        assertThat(service.parse(fml)).isNotNull();
        assertThat(service.parse(fml)).isNotNull();
    }

    @Test
    void validate_runsWithoutThrowing_forACompiledMap() throws Exception {
        StructureMap sm = service.compile(fml);
        service.validate(sm);
    }

    @Test
    void transform_appliesTheMapAndWritesTheResult() throws Exception {
        StructureMap sm = service.compile(fml);
        service.transform(sm, inputJson, outDir.toString());

        Path result;
        try (var files = Files.list(outDir)) {
            result = files.filter(p -> p.toString().endsWith("_result.json"))
                    .findFirst()
                    .orElseThrow();
        }
        String out = Files.readString(result);
        assertThat((String) JsonPath.read(out, "$.resourceType")).isEqualTo("Patient");
        assertThat((String) JsonPath.read(out, "$.id")).isEqualTo("pat1");
        assertThat((String) JsonPath.read(out, "$.gender")).isEqualTo("female");
        assertThat((Boolean) JsonPath.read(out, "$.active")).isTrue();
        assertThat((String) JsonPath.read(out, "$.birthDate")).isEqualTo("1985-03-12");
    }

    @Test
    void parse_wrapsIoFailureInParsingError() {
        assertThatThrownBy(() -> service.parse(outDir.resolve("nope.map").toString()))
                .isInstanceOf(ParsingError.class);
    }

    @Test
    void compile_wrapsFailureInCompilationError() {
        assertThatThrownBy(() -> service.compile(outDir.resolve("nope.map").toString()))
                .isInstanceOf(CompilationError.class);
    }

    @Test
    void transform_wrapsMissingDataInTransformationError() throws Exception {
        StructureMap sm = service.compile(fml);
        assertThatThrownBy(
                        () -> service.transform(sm, outDir.resolve("nope.json").toString(), outDir.toString()))
                .isInstanceOf(TransformationError.class);
    }
}
