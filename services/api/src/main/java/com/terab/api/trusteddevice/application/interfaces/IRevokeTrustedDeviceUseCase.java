package com.terab.api.trusteddevice.application.interfaces;

import java.util.UUID;
import com.terab.api.common.usecase.UseCase;

public interface IRevokeTrustedDeviceUseCase extends UseCase {
  void execute(UUID deviceId, UUID userId);
}
