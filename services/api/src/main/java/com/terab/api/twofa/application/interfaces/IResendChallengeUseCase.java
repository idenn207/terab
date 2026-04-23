package com.terab.api.twofa.application.interfaces;

import java.util.UUID;
import com.terab.api.common.usecase.UseCase;
import com.terab.api.twofa.dto.CreateChallengeResponse;

public interface IResendChallengeUseCase extends UseCase {
  CreateChallengeResponse execute(UUID oldChallengeId);
}
