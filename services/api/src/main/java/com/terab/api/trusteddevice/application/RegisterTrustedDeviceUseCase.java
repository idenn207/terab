package com.terab.api.trusteddevice.application;

import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.trusteddevice.application.interfaces.IRegisterTrustedDeviceUseCase;
import com.terab.api.trusteddevice.domain.TrustedDevice;
import com.terab.api.trusteddevice.dto.TrustedDeviceResponse;
import com.terab.api.trusteddevice.service.TrustedDeviceService;
import com.terab.api.user.domain.User;
import com.terab.api.user.service.UserService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class RegisterTrustedDeviceUseCase implements IRegisterTrustedDeviceUseCase {

  private final UserService userService;
  private final TrustedDeviceService trustedDeviceService;

  @Transactional
  @Override
  public TrustedDeviceResponse execute(UUID userId, String userAgent, HttpServletResponse response) {
    User user = userService.findById(userId);
    String rawToken = UUID.randomUUID().toString();
    TrustedDevice device = trustedDeviceService.register(user, rawToken, userAgent);
    trustedDeviceService.setTrustCookie(response, rawToken);
    return new TrustedDeviceResponse(device.getId(), device.getUserAgent(), device.getExpiresAt());
  }
}
