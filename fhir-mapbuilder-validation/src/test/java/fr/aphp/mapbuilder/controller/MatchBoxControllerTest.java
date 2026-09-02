package fr.aphp.mapbuilder.controller;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import fr.aphp.mapbuilder.model.ParsingError;
import fr.aphp.mapbuilder.model.TransformationError;
import fr.aphp.mapbuilder.model.ValidationError;
import fr.aphp.mapbuilder.service.MatchBoxService;
import java.io.IOException;
import org.hl7.fhir.r4.model.StructureMap;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Teste les codes HTTP et le mapping d'erreurs des endpoints, pas la logique de
 * {@link MatchBoxService} (mocké).
 */
@WebMvcTest(MatchBoxController.class)
class MatchBoxControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private MatchBoxService matchBoxService;

    // ---- /api/matchbox/validate -------------------------------------------------

    @Test
    void validate_returns200_whenCompileValidateAndTransformSucceed() throws Exception {
        when(matchBoxService.compile(anyString())).thenReturn(new StructureMap());

        mockMvc.perform(get("/api/matchbox/validate")
                        .param("source", "map.fml")
                        .param("data", "data.json")
                        .param("output", "out"))
                .andExpect(status().isOk())
                .andExpect(content().string("Validation and transformation are OK"));
    }

    @Test
    void validate_returns500_whenCompileReturnsNull() throws Exception {
        when(matchBoxService.compile(anyString())).thenReturn(null);

        mockMvc.perform(get("/api/matchbox/validate")
                        .param("source", "map.fml")
                        .param("data", "data.json")
                        .param("output", "out"))
                .andExpect(status().isInternalServerError())
                .andExpect(content().string("StructureMap is null!"));
    }

    @Test
    void validate_returns500_whenValidationFails() throws Exception {
        when(matchBoxService.compile(anyString())).thenReturn(new StructureMap());
        doThrow(new ValidationError("bad map")).when(matchBoxService).validate(any());

        mockMvc.perform(get("/api/matchbox/validate")
                        .param("source", "map.fml")
                        .param("data", "data.json")
                        .param("output", "out"))
                .andExpect(status().isInternalServerError())
                .andExpect(content().string(containsString("Error during validation")));
    }

    @Test
    void validate_returns400_whenRequiredParamMissing() throws Exception {
        mockMvc.perform(get("/api/matchbox/validate").param("source", "map.fml").param("data", "data.json"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void validate_returns500_whenSetPathsThrows() throws Exception {
        doThrow(new IOException("disk full")).when(matchBoxService).setPaths(anyString());

        mockMvc.perform(get("/api/matchbox/validate")
                        .param("source", "map.fml")
                        .param("data", "data.json")
                        .param("output", "out"))
                .andExpect(status().isInternalServerError())
                .andExpect(content().string(containsString("Unexpected error")));
    }

    @Test
    void validate_returns500_whenTransformationFails() throws Exception {
        when(matchBoxService.compile(anyString())).thenReturn(new StructureMap());
        doThrow(new TransformationError("bad transform"))
                .when(matchBoxService)
                .transform(any(), anyString(), anyString());

        mockMvc.perform(get("/api/matchbox/validate")
                        .param("source", "map.fml")
                        .param("data", "data.json")
                        .param("output", "out"))
                .andExpect(status().isInternalServerError())
                .andExpect(content().string(containsString("Error during transformation")));
    }

    @Test
    void validate_returns500_whenTransformRaisesIoError() throws Exception {
        when(matchBoxService.compile(anyString())).thenReturn(new StructureMap());
        doThrow(new IOException("io boom")).when(matchBoxService).transform(any(), anyString(), anyString());

        mockMvc.perform(get("/api/matchbox/validate")
                        .param("source", "map.fml")
                        .param("data", "data.json")
                        .param("output", "out"))
                .andExpect(status().isInternalServerError())
                .andExpect(content().string(containsString("IO Error")));
    }

    // ---- /api/matchbox/parse --------------------------------------------------

    @Test
    void parse_returns200_whenServiceSucceeds() throws Exception {
        mockMvc.perform(get("/api/matchbox/parse").param("source", "map.fml"))
                .andExpect(status().isOk())
                .andExpect(content().string("structureMap is parsed!"));
    }

    @Test
    void parse_returns500_whenServiceThrows() throws Exception {
        when(matchBoxService.parse(anyString())).thenThrow(new ParsingError("boom", new RuntimeException()));

        mockMvc.perform(get("/api/matchbox/parse").param("source", "map.fml"))
                .andExpect(status().isInternalServerError())
                .andExpect(content().string(containsString("Unexpected error")));
    }

    @Test
    void parse_returns400_whenSourceMissing() throws Exception {
        mockMvc.perform(get("/api/matchbox/parse")).andExpect(status().isBadRequest());
    }

    // ---- /api/matchbox/resetAndLoadEngine -----------------------------------------

    @Test
    void resetAndLoadEngine_returns200WithResult() throws Exception {
        when(matchBoxService.resetAndLoadEngine(anyList())).thenReturn(true);

        mockMvc.perform(get("/api/matchbox/resetAndLoadEngine").param("path", "ig.tgz"))
                .andExpect(status().isOk())
                .andExpect(content().string("true"));
    }

    @Test
    void resetAndLoadEngine_returns400_whenPathMissing() throws Exception {
        mockMvc.perform(get("/api/matchbox/resetAndLoadEngine")).andExpect(status().isBadRequest());
    }
}
