package com.terab.api.device.service;

import java.time.OffsetDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.device.domain.Device;
import com.terab.api.device.dto.PushTokenRequest;
import com.terab.api.device.repository.DeviceRepository;
import com.terab.api.user.domain.User;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class DeviceService {
  private final DeviceRepository deviceRepository;

  @Transactional
  public Device saveOrUpdate(User user, PushTokenRequest request) {
    Device device = deviceRepository.findByPushToken(request.pushToken())
      .orElse(new Device());
    device.setUser(user);
    device.setPushToken(request.pushToken());
    device.setPlatform(request.platform());
    device.setLastSeenAt(OffsetDateTime.now());
    if(request.name() != null) {
      device.setName(request.name());
    }
    
    return deviceRepository.save(device);
  }
}
