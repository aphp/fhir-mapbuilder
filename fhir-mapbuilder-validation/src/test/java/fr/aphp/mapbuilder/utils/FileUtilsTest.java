package fr.aphp.mapbuilder.utils;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class FileUtilsTest {

    @Test
    void createOrRetrieveFolderPath_createsMissingDirectory(@TempDir Path tmp) throws IOException {
        Path target = tmp.resolve("nested/output");

        String returned = FileUtils.createOrRetrieveFolderPath(target.toString());

        assertThat(returned).isEqualTo(target.toString());
        assertThat(Files.isDirectory(target)).isTrue();
    }

    @Test
    void createOrRetrieveFolderPath_isNoOpForExistingDirectory(@TempDir Path tmp) throws IOException {
        String returned = FileUtils.createOrRetrieveFolderPath(tmp.toString());

        assertThat(returned).isEqualTo(tmp.toString());
        assertThat(Files.isDirectory(tmp)).isTrue();
    }

    @Test
    void generateDateTimeFormatForPath_matchesExpectedPattern() {
        assertThat(FileUtils.generateDateTimeFormatForPath()).matches("\\d{4}_\\d{2}_\\d{2}_\\d{2}_\\d{2}_\\d{2}");
    }

    @Test
    void writeFile_withoutAppend_writesContent(@TempDir Path tmp) throws IOException {
        Path file = tmp.resolve("result.json");

        FileUtils.writeFile(file.toString(), "hello", false);

        assertThat(Files.readString(file)).isEqualTo("hello");
    }

    @Test
    void writeFile_withoutAppend_overwritesExistingContent(@TempDir Path tmp) throws IOException {
        Path file = tmp.resolve("result.json");
        Files.writeString(file, "old content");

        FileUtils.writeFile(file.toString(), "new", false);

        assertThat(Files.readString(file)).isEqualTo("new");
    }

    @Test
    void writeFile_withAppend_appendsToExistingContent(@TempDir Path tmp) throws IOException {
        Path file = tmp.resolve("params.log");
        Files.writeString(file, "first");

        FileUtils.writeFile(file.toString(), "-second", true);

        assertThat(Files.readString(file)).isEqualTo("first-second");
    }

    @Test
    void serializeListObject_producesJsonArrayWithoutHtmlEscaping() {
        String json = FileUtils.serializeListObject(List.of("a<b>", "c&d"));

        assertThat(json).isEqualTo("[\"a<b>\",\"c&d\"]");
    }
}
