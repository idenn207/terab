package com.terab.api.unit.backupcode;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import com.terab.api.backupcode.domain.BackupCode;
import com.terab.api.backupcode.repository.BackupCodeRepository;
import com.terab.api.backupcode.service.BackupCodeService;
import com.terab.api.user.domain.User;

@ExtendWith(MockitoExtension.class)
class BackupCodeServiceTest {
  
  @Mock BackupCodeRepository repository;
  @Mock PasswordEncoder passwordEncoder;
  @InjectMocks BackupCodeService backupCodeService;

  @Nested
  @DisplayName("regenerate")
  class DescribeRegenerate {

    @Test
    @DisplayName("regenerate 호출 시 평문 코드 8개를 반환한다")
    void should_return_8_plain_codes_when_regenerate_called() {
      // given
      User user = new User();
      given(passwordEncoder.encode(any())).willReturn("hashed");
      given(repository.save(any())).willAnswer(inv -> inv.getArgument(0));

      // when
      List<String> codes = backupCodeService.regenerate(user);

      // then
      assertThat(codes).hasSize(8);
      then(repository).should().deleteAllByUser(user);
    }

    @Test
    @DisplayName("생성된 코드는 XXXX-XXXX 형식이다")
    void should_generate_codes_in_xxxx_xxxx_format() {
      // given
      User user = new User();
      given(passwordEncoder.encode(any())).willReturn("hashed");
      given(repository.save(any())).willAnswer(inv -> inv.getArgument(0));

      // when
      List<String> codes = backupCodeService.regenerate(user);

      // then
      codes.forEach(code ->
        assertThat(code).matches("[A-Z0-9]{4}-[A-Z0-9]{4}")
      );
    }
  }

  @Nested
  @DisplayName("verifyAndConsume")
  class DescriveVerify {

    @Test
    @DisplayName("코드가 일치하면 true를 반환하고 사용 처리한다")
    void should_return_true_and_mark_used_when_code_matches() {
      // given
      User user = new User();
      BackupCode bc = new BackupCode();
      bc.setCodeHash("stored-hash");
      given(repository.findByUserAndUsedAtIsNull(user)).willReturn(List.of(bc));
      given(passwordEncoder.matches("A3K9-MZ7P", "stored-hash")).willReturn(true);
      given(repository.save(any())).willAnswer(inv -> inv.getArgument(0));

      // when
      boolean result = backupCodeService.verifyAndConsume(user, "A3K9-MZ7P");

      // then
      assertThat(result).isTrue();
      assertThat(bc.getUsedAt()).isNotNull();
    }

    @Test
    @DisplayName("일치하는 코드가 없으면 false를 반환한다")
    void should_return_false_when_no_code_matches() {
      // given
      User user = new User();
      BackupCode bc = new BackupCode();
      bc.setCodeHash("stored-hash");
      given(repository.findByUserAndUsedAtIsNull(user)).willReturn(List.of(bc));
      given(passwordEncoder.matches(any(), any())).willReturn(false);
      
      // when
      boolean result = backupCodeService.verifyAndConsume(user, "WRONG-CODE");
      
      // then
      assertThat(result).isFalse();
    }
  }
}
