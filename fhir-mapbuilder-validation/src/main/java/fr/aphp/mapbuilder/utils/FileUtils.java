package fr.aphp.mapbuilder.utils;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

public class FileUtils {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(FileUtils.class);

    // method that create folder if he doesn't exist or just send back the path (initial dev : method add folder name to
    // path)
    public static String createOrRetrieveFolderPath(String path) throws IOException {
        Path folderPath = Path.of(path);
        if (Files.notExists(folderPath)) Files.createDirectories(folderPath);

        return folderPath.toString();
    }

    // generate a datetime with format yyyy_MM_dd_HH_mm_ss to add it on filename
    public static String generateDateTimeFormatForPath() {
        LocalDateTime now = LocalDateTime.now();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy_MM_dd_HH_mm_ss");
        return now.format(formatter);
    }

    // method that wrote a file, append parameter give opportunity to not erase file given in parameter
    public static void writeFile(final String pathToFile, final String stringToWrite, final boolean append)
            throws IOException {
        final Path filePath = Paths.get(pathToFile);

        if (!append) {
            if (Files.exists(filePath)) Files.delete(filePath);

            Files.writeString(filePath, stringToWrite);
        } else {
            Files.writeString(filePath, stringToWrite, StandardOpenOption.APPEND);
        }
        log.info("File created and content written.");
    }

    public static String serializeListObject(final List<?> list) {
        // Use Gson to serialize the list
        final Gson gson = new GsonBuilder().disableHtmlEscaping().create();
        return gson.toJson(list);
    }
}
