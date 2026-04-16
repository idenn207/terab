package com.terab.api.device.application;

import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.device.application.interfaces.IRegisterPushTokenUseCase;
import com.terab.api.device.domain.Device;
import com.terab.api.device.dto.PushTokenRequest;
import com.terab.api.device.dto.PushTokenResponse;
import com.terab.api.device.service.DeviceService;
import com.terab.api.user.domain.User;
import com.terab.api.user.service.UserService;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class RegisterPushTokenUseCase implements IRegisterPushTokenUseCase {

  private final UserService userService;
  private final DeviceService deviceService;

  @Transactional
  @Override
  public PushTokenResponse execute(UUID userId, PushTokenRequest request) {
    User user = userService.findById(userId);
    Device device = deviceService.saveOrUpdate(user, request);
    return new PushTokenResponse(device.getId());
  }
}
