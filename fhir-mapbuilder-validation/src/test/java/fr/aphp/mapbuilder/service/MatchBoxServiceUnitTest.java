package fr.aphp.mapbuilder.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

import ch.ahdis.matchbox.engine.MatchboxEngine;
import fr.aphp.mapbuilder.model.ValidationError;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.hl7.fhir.exceptions.FHIRException;
import org.hl7.fhir.r4.model.StructureMap;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Branch and edge coverage for {@link MatchBoxService} that the real-engine
 * {@link MatchBoxServiceIntegrationTest} does not reach: null guards, the
 * {@code validate} failure path, and the IG-loading helpers.
 */
@ExtendWith(MockitoExtension.class)
class MatchBoxServiceUnitTest {

    @Mock
    MatchboxEngine engine;

    MatchBoxService service;

    @BeforeEach
    void init() {
        service = new MatchBoxService(engine);
    }

    @Test
    void setPaths_returnsEarly_whenOutputPathIsNull() {
        assertThatCode(() -> service.setPaths(null)).doesNotThrowAnyException();
    }

    @Test
    void parse_returnsNull_whenSourceIsNull() throws Exception {
        assertThat(service.parse(null)).isNull();
    }

    @Test
    void compile_returnsNull_whenParseYieldsNull() throws Exception {
        // source == null -> parse() returns null -> compile() sees a null StructureMap
        assertThat(service.compile(null)).isNull();
    }

    @Test
    void validate_wrapsEngineFailureInValidationError() throws Exception {
        when(engine.getValidator(any())).thenThrow(new FHIRException("boom"));

        assertThatThrownBy(() -> service.validate(new StructureMap())).isInstanceOf(ValidationError.class);
    }

    @Test
    void getIgs_extractsValuesThatFollowDashIg() {
        List<String> igs = MatchBoxService.getIgs(new String[] {"-ig", "a.tgz", "x", "-ig", "b.tgz"});

        assertThat(igs).containsExactly("a.tgz", "b.tgz");
    }

    @Test
    void getIgs_ignoresATrailingDashIgWithNoValue() {
        assertThat(MatchBoxService.getIgs(new String[] {"-ig"})).isEmpty();
    }

    @Test
    void includePackages_returnsFalse_whenNoIgArgsAreGiven() {
        // no "-ig" -> empty IG list -> loadCustomGuides logs and returns false
        assertThatCode(() -> service.includePackages(new String[] {})).doesNotThrowAnyException();
    }

    @Test
    void loadCustomGuides_returnsFalse_forNullOrEmptyPaths() {
        assertThat(service.loadCustomGuides(null)).isFalse();
        assertThat(service.loadCustomGuides(List.of())).isFalse();
    }

    @Test
    void loadCustomGuides_returnsFalse_whenAPathCannotBeRead(@TempDir Path tmp) {
        assertThat(service.loadCustomGuides(List.of(tmp.resolve("missing.tgz").toString())))
                .isFalse();
    }

    @Test
    void loadCustomGuides_returnsTrue_whenTheEngineAcceptsThePackage(@TempDir Path tmp) throws Exception {
        Path pkg = Files.write(tmp.resolve("ig.tgz"), new byte[] {1, 2, 3});
        doNothing().when(engine).loadPackage(any());

        assertThat(service.loadCustomGuides(List.of(pkg.toString()))).isTrue();
    }

    @Test
    void loadCustomGuides_returnsFalse_whenTheEngineRejectsEveryPackage(@TempDir Path tmp) throws Exception {
        Path pkg = Files.write(tmp.resolve("ig.tgz"), new byte[] {1, 2, 3});
        doThrow(new RuntimeException("bad package")).when(engine).loadPackage(any());

        assertThat(service.loadCustomGuides(List.of(pkg.toString()))).isFalse();
    }
}
