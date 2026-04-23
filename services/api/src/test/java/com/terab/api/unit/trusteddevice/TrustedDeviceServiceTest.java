package com.terab.api.unit.trusteddevice;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import com.terab.api.trusteddevice.domain.TrustedDevice;
import com.terab.api.trusteddevice.repository.TrustedDeviceRepository;
import com.terab.api.trusteddevice.service.TrustedDeviceService;
import com.terab.api.user.domain.User;

@ExtendWith(MockitoExtension.class)
class TrustedDeviceServiceTest {
  
  @Mock TrustedDeviceRepository repository;
  @InjectMocks TrustedDeviceService trustedDeviceService;

  private User mockUser(UUID id) {
    User user = new User();
    user.setId(id);
    user.setUsername("testuser");
    user.setNickname("테스트");
    user.setRoles(new HashSet<>());
    return user;
  }

  @Nested
  @DisplayName("verify")
  class DescribeVerify {

    @Test
    @DisplayName("유효한 토큰과 사용자가 일치하면 true를 반환한다")
    void should_return_true_when_valid_token_and_user_match() {
      // given
      UUID userId = UUID.randomUUID();
      User user = mockUser(userId);
      String rawToken = "test-raw-token";

      TrustedDevice device = new TrustedDevice();
      device.setUser(user);
      device.setExpiresAt(OffsetDateTime.now().plusDays(10));

      // hashToken은 private이므로 실제 서비스를 통해 해시된 값을 사용
      // 여기서는 register 후 verify가 true를 반환하는 통합 흐름을 테스트
      given(repository.findByTokenHash(any())).willReturn(Optional.of(device));

      // when
      boolean result = trustedDeviceService.verify(rawToken, user);

      // then
      assertThat(result).isTrue();
    }

    @Test
    @DisplayName("토큰이 존재하지 않으면 false를 반환한다")
    void should_return_false_when_token_not_found() {
      // given
      User user = mockUser(UUID.randomUUID());
      given(repository.findByTokenHash(any())).willReturn(Optional.empty());

      // when
      boolean result = trustedDeviceService.verify("unknown-token", user);

      // then
      assertThat(result).isFalse();
    }

    @Test
    @DisplayName("기기가 만료된 경우 false를 반환한다")
    void should_return_false_when_device_expired() {
      // given
      UUID userId = UUID.randomUUID();
      User user = mockUser(userId);
      TrustedDevice device = new TrustedDevice();
      device.setUser(user);
      device.setExpiresAt(OffsetDateTime.now().minusDays(1)); // 만료
      
      given(repository.findByTokenHash(any())).willReturn(Optional.of(device));

      // when
      boolean result = trustedDeviceService.verify("any-token", user);

      // then
      assertThat(result).isFalse();
    }
  }
}
