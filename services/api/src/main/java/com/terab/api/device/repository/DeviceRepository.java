package com.terab.api.device.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.terab.api.device.domain.Device;

public interface DeviceRepository extends JpaRepository<Device, UUID> {

  Optional<Device> findByPushToken(String pushToken);

  List<Device> findByUserId(UUID userId);

}
