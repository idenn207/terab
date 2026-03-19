package com.nasdrive.api.slice;

// ┌──────────────────────────────────────────────────────────────┐
// │ Slice Test Template (@WebMvcTest)                            │
// │ 복사 후 컨트롤러, 서비스, 엔드포인트를 수정하여 사용         │
// │ 사용 후 이 주석 블록을 삭제하세요                            │
// └──────────────────────────────────────────────────────────────┘

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static com.nasdrive.api.support.SecurityTestSupport.authenticatedUser;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// @WebMvcTest(YourController.class)
@ActiveProfiles("test")
class _SliceTestTemplate {

    @Autowired
    MockMvc mockMvc;

    // @MockBean
    // YourService yourService;

    @Nested
    @DisplayName("GET /api/your-endpoint")
    class GetEndpoint {

        @Test
        void should_return_401_without_auth() throws Exception {
            mockMvc.perform(get("/api/your-endpoint"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        void should_return_200_with_auth() throws Exception {
            // given
            // given(yourService.findAll(anyLong())).willReturn(List.of());

            // when & then
            mockMvc.perform(get("/api/your-endpoint")
                            .with(authenticatedUser("user@test.com")))
                    .andExpect(status().isOk());
        }
    }

    @Nested
    @DisplayName("POST /api/your-endpoint")
    class PostEndpoint {

        @Test
        void should_return_400_when_invalid_request() throws Exception {
            String invalidBody = "{}";

            mockMvc.perform(post("/api/your-endpoint")
                            .with(authenticatedUser("user@test.com"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(invalidBody))
                    .andExpect(status().isBadRequest());
        }
    }
}
