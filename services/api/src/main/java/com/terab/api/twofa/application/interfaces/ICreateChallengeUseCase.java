package com.terab.api.twofa.application.interfaces;

import com.terab.api.common.usecase.UseCase;
import com.terab.api.twofa.dto.CreateChallengeResponse;
import com.terab.api.user.domain.User;

public interface ICreateChallengeUseCase extends UseCase {
  CreateChallengeResponse execute(User user);
}
