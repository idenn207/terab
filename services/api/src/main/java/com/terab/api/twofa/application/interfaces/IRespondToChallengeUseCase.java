package com.terab.api.twofa.application.interfaces;

import java.util.UUID;
import com.terab.api.common.usecase.UseCase;
import com.terab.api.twofa.dto.RespondRequest;

public interface IRespondToChallengeUseCase extends UseCase {
  void execute(UUID challengeId, RespondRequest request, UUID respondingUserId);
}
