package com.terab.api.support;

import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * @WebMvcTest 컨트롤러 테스트에서 인증된 요청을 쉽게 생성하기 위한 유틸리티.
 *
 * 사용법:
 * <pre>
 * import static com.terab.api.support.SecurityTestSupport.authenticatedUser;
 *
 * mockMvc.perform(get("/api/files").with(authenticatedUser("user@test.com")))
 *        .andExpect(status().isOk());
 * </pre>
 */
public final class SecurityTestSupport {

    public static RequestPostProcessor authenticatedUser(String email) {
        return SecurityMockMvcRequestPostProcessors.user(email).roles("USER");
    }

    public static RequestPostProcessor authenticatedAdmin(String email) {
        return SecurityMockMvcRequestPostProcessors.user(email).roles("ADMIN");
    }

    private SecurityTestSupport() {
    }
}
