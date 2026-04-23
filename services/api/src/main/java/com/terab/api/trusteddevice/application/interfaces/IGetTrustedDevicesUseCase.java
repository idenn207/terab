package com.terab.api.trusteddevice.application.interfaces;

import java.util.List;
import java.util.UUID;
import com.terab.api.common.usecase.UseCase;
import com.terab.api.trusteddevice.dto.TrustedDeviceResponse;

public interface IGetTrustedDevicesUseCase extends UseCase {
  List<TrustedDeviceResponse> execute(UUID userId);
}
