package com.terab.api.trusteddevice.application.interfaces;

import java.util.UUID;
import com.terab.api.common.usecase.UseCase;
import com.terab.api.trusteddevice.dto.TrustedDeviceResponse;
import jakarta.servlet.http.HttpServletResponse;

public interface IRegisterTrustedDeviceUseCase extends UseCase {
  TrustedDeviceResponse execute(UUID userId, String userAgent, HttpServletResponse response);
}
