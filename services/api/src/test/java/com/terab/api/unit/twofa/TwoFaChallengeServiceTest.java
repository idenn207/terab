package com.terab.api.unit.twofa;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import com.terab.api.twofa.domain.TwoFaChallenge;
import com.terab.api.twofa.repository.TwoFaChallengeRepository;
import com.terab.api.twofa.service.TwoFaChallengeService;
import com.terab.api.user.domain.User;

@ExtendWith(MockitoExtension.class)
class TwoFaChallengeServiceTest {
  
  @Mock
  TwoFaChallengeRepository repository;

  @InjectMocks
  TwoFaChallengeService twoFaChallengeService;

  @Nested
  @DisplayName("create")
  class DescribeCreate {

    @Test
    void should_create_challenge_with_three_options_when_user_given() {
      // given
      User user = new User();
      user.setId(UUID.randomUUID());
      given(repository.save(any())).willAnswer(inv -> inv.getArgument(0));

      // when
      TwoFaChallenge result = twoFaChallengeService.create(user);

      // then
      assertThat(result.getOptionsList()).hasSize(3);
      assertThat(result.getCorrectNum()).isIn(result.getOptionsList());
      assertThat(result.getStatus()).isEqualTo("PENDING");
      assertThat(result.getExpiresAt()).isAfter(OffsetDateTime.now());
    }

    @Test
    void should_generate_two_digit_numbers_between_10_and_99() {
      // given
      User user = new User();
      user.setId(UUID.randomUUID());;
      given(repository.save(any())).willAnswer(inv -> inv.getArgument(0));

      // when
      TwoFaChallenge result = twoFaChallengeService.create(user);

      // then
      for (String opt : result.getOptionsList()) {
        int num = Integer.parseInt(opt);
        assertThat(num).isBetween(10, 99);
      }
    }
  }

  @Nested
  @DisplayName("approve / deny / markExpired")
  class DescriveStatusChange {

    @Test
    void should_set_status_approved_when_approve_called() {
      // given
      TwoFaChallenge challenge = new TwoFaChallenge();
      challenge.setStatus("PENDING");
      given(repository.save(any())).willAnswer(inv -> inv.getArgument(0));

      // when
      twoFaChallengeService.approve(challenge);

      // then
      assertThat(challenge.getStatus()).isEqualTo("APPROVED");
      assertThat(challenge.getRespondedAt()).isNotNull();
    }

    @Test
    void should_set_status_denied_when_deny_called() {
      // given
      TwoFaChallenge challenge = new TwoFaChallenge();
      challenge.setStatus("PENDING");
      given(repository.save(any())).willAnswer(inv -> inv.getArgument(0));

      // when
      twoFaChallengeService.deny(challenge);

      // then
      assertThat(challenge.getStatus()).isEqualTo("DENIED");
      assertThat(challenge.getRespondedAt()).isNotNull();
    }

    @Test
    void should_set_status_denied_when_expired_called() {
      // given
      TwoFaChallenge challenge = new TwoFaChallenge();
      challenge.setStatus("PENDING");
      given(repository.save(any())).willAnswer(inv -> inv.getArgument(0));

      // when
      twoFaChallengeService.markExpired(challenge);

      // then
      assertThat(challenge.getStatus()).isEqualTo("EXPIRED");
    }
  }
}
