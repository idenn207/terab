package com.terab.api.support;

import java.util.List;
import java.util.UUID;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import com.terab.api.security.CustomUserDetails;

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

  public static RequestPostProcessor authenticatedUser(UUID userId) {
    CustomUserDetails details = new CustomUserDetails(
      userId,
      "testuser",
      // TODO: 권한 목록 list 또는 DB 조회 방식으로 변경 필요
      List.of("file:read", "file:write", "file:delete", "share:create", "storage:read"));
    return SecurityMockMvcRequestPostProcessors.user(details);
  }

  public static RequestPostProcessor authenticatedAdmin(UUID userId) {
    CustomUserDetails details = new CustomUserDetails(
      userId,
      "testuser",
      // TODO: 권한 목록 list 또는 DB 조회 방식으로 변경 필요
      List.of(
        "file:read", "file:write", "file:delete",
        "share:create", "storage:read", "share:manage",
        "user:read", "user:invite", "user:manage",
        "storage:manage", "system:monitor", "audit:read"
      )
    );
    return SecurityMockMvcRequestPostProcessors.user(details);
  }

  private SecurityTestSupport() {}
}
