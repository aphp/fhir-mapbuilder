package ch.ahdis.matchbox.engine.packages;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import ch.ahdis.matchbox.engine.MatchboxEngine;
import java.io.InputStream;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Properties;
import org.hl7.fhir.utilities.npm.NpmPackage.PackageResourceInformation;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * The shadowed {@link LazyTerminologyLoader} (#276) is the one that runs, it accepts Windows
 * filenames on every OS, and it goes away with matchbox-engine 5.
 */
class LazyTerminologyLoaderShadowTest {

    @ParameterizedTest
    @CsvSource({
        // Linux and macOS: NpmPackage joins with '/'
        "'@package/ConceptMap-x.json', 'ConceptMap-x.json'",
        // Windows: NpmPackage joins with File.separator. The matchbox 4.1.21 class returns null here.
        "'@package\\ConceptMap-x.json', 'ConceptMap-x.json'",
    })
    void getPackageFolderFilename_acceptsBothSeparators(String filename, String expected) {
        assertThat(LazyTerminologyLoader.getPackageFolderFilename(resource(filename)))
                .isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource({
        "'@package/other/ValueSet-x.json'",
        "'@package\\other\\ValueSet-x.json'",
        "'@other/ValueSet-x.json'",
        "'@other\\ValueSet-x.json'",
    })
    void getPackageFolderFilename_stillRejectsOtherFolders(String filename) {
        assertThat(LazyTerminologyLoader.getPackageFolderFilename(resource(filename)))
                .isNull();
    }

    @Test
    void getPackageFolderFilename_acceptsANullFilename() {
        assertThat(LazyTerminologyLoader.getPackageFolderFilename(resource(null)))
                .isNull();
    }

    @Test
    void theShadowIsLoadedInsteadOfTheMatchboxClass() throws Exception {
        Path loadedFrom = Paths.get(LazyTerminologyLoader.class
                .getProtectionDomain()
                .getCodeSource()
                .getLocation()
                .toURI());
        Path matchboxJar = Paths.get(MatchboxEngine.class
                .getProtectionDomain()
                .getCodeSource()
                .getLocation()
                .toURI());

        assertThat(loadedFrom).isNotEqualTo(matchboxJar);
    }

    /** The shadow copies matchbox-engine 4.1.21: delete it with the matchbox 5 migration (#248). */
    @Test
    void matchboxEngineIsStill41x_otherwiseDeleteTheShadow() throws Exception {
        Properties pom = new Properties();
        try (InputStream in = MatchboxEngine.class.getResourceAsStream(
                "/META-INF/maven/health.matchbox/matchbox-engine/pom.properties")) {
            assertThat(in).as("pom.properties of matchbox-engine").isNotNull();
            pom.load(in);
        }

        assertThat(pom.getProperty("version"))
                .as("matchbox-engine moved past 4.1.x: delete the shadowed LazyTerminologyLoader (#276)"
                        + " and this test, the fix is upstream from 5.0.0-rc4")
                .startsWith("4.1.");
    }

    private static PackageResourceInformation resource(String filename) {
        PackageResourceInformation pri = mock(PackageResourceInformation.class);
        when(pri.getFilename()).thenReturn(filename);
        return pri;
    }
}
