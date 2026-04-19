package com.terab.api.trusteddevice.application;

import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.trusteddevice.application.interfaces.IRevokeTrustedDeviceUseCase;
import com.terab.api.trusteddevice.service.TrustedDeviceService;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class RevokeTrustedDeviceUseCase implements IRevokeTrustedDeviceUseCase {

  private final TrustedDeviceService trustedDeviceService;

  @Transactional
  @Override
  public void execute(UUID deviceId, UUID userId) {
    trustedDeviceService.revoke(deviceId, userId);
  }
}
