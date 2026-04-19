package com.terab.api.trusteddevice.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.terab.api.trusteddevice.domain.TrustedDevice;
import com.terab.api.user.domain.User;

public interface TrustedDeviceRepository extends JpaRepository<TrustedDevice, UUID> {
  Optional<TrustedDevice> findByTokenHash(String tokenHash);
  List<TrustedDevice> findByUser(User user);
}
