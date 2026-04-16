package com.terab.api.device.application.interfaces;

import java.util.UUID;
import com.terab.api.common.usecase.UseCase;
import com.terab.api.device.dto.PushTokenRequest;
import com.terab.api.device.dto.PushTokenResponse;

public interface IRegisterPushTokenUseCase extends UseCase {
  PushTokenResponse execute(UUID userId, PushTokenRequest request);
}
