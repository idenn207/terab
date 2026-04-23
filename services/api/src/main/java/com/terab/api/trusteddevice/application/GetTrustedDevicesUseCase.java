package com.terab.api.trusteddevice.application;

import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.trusteddevice.application.interfaces.IGetTrustedDevicesUseCase;
import com.terab.api.trusteddevice.dto.TrustedDeviceResponse;
import com.terab.api.trusteddevice.service.TrustedDeviceService;
import com.terab.api.user.domain.User;
import com.terab.api.user.service.UserService;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class GetTrustedDevicesUseCase implements IGetTrustedDevicesUseCase {

  private final UserService userService;
  private final TrustedDeviceService trustedDeviceService;

  @Transactional(readOnly = true)
  @Override
  public List<TrustedDeviceResponse> execute(UUID userId) {
    User user = userService.findById(userId);
    return trustedDeviceService.findByUser(user).stream()
      .map(d -> new TrustedDeviceResponse(d.getId(), d.getUserAgent(), d.getExpiresAt()))
      .toList();
  }
}
