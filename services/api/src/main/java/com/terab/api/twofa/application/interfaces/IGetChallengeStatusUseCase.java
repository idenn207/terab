package com.terab.api.twofa.application.interfaces;

import java.util.UUID;
import com.terab.api.common.usecase.UseCase;
import com.terab.api.twofa.dto.ChallengeStatusResponse;

public interface IGetChallengeStatusUseCase extends UseCase {
  ChallengeStatusResponse execute(UUID challengeId);
}
