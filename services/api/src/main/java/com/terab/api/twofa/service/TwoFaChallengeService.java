package com.terab.api.twofa.service;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.common.exception.ApiException;
import com.terab.api.common.exception.ErrorCode;
import com.terab.api.twofa.domain.TwoFaChallenge;
import com.terab.api.twofa.repository.TwoFaChallengeRepository;
import com.terab.api.user.domain.User;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TwoFaChallengeService {
  
  private static final int CHALLENGE_EXPIRY_SECONDS = 60;
  private final TwoFaChallengeRepository repository;

  @Transactional
  public TwoFaChallenge create(User user) {
    List<String> optionsList = generateOptions();
    String correctNum = optionsList.get(new SecureRandom().nextInt(3));

    TwoFaChallenge challenge = new TwoFaChallenge();
    challenge.setUser(user);
    challenge.setOptions(String.join(",", optionsList));
    challenge.setCorrectNum(correctNum);
    challenge.setStatus("PENDING");
    challenge.setExpiresAt(OffsetDateTime.now().plusSeconds(CHALLENGE_EXPIRY_SECONDS));
    return repository.save(challenge);
  }

  @Transactional(readOnly = true)
  public TwoFaChallenge findById(UUID id) {
    return repository.findById(id)
      .orElseThrow(() -> new ApiException(ErrorCode.TWO_FA_CHALLENGE_NOT_FOUND));
  }

  @Transactional
  public void approve(TwoFaChallenge challenge) {
    challenge.setStatus("APPROVED");
    challenge.setRespondedAt(OffsetDateTime.now());
    repository.save(challenge);
  }

  @Transactional
  public void deny(TwoFaChallenge challenge) {
    challenge.setStatus("DENIED");
    challenge.setRespondedAt(OffsetDateTime.now());
    repository.save(challenge);
  }

  @Transactional
  public void markExpired(TwoFaChallenge challenge) {
    challenge.setStatus("EXPIRED");
    repository.save(challenge);
  }

  private List<String> generateOptions() {
    Set<Integer> set = new LinkedHashSet<>();
    SecureRandom rng = new SecureRandom();
    while(set.size() < 3) {
      set.add(10 + rng.nextInt(90));
    }
    return set.stream().map(String::valueOf).collect(Collectors.toList());
  }
}
