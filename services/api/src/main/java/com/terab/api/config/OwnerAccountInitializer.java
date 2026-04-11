package com.terab.api.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.rbac.repository.RoleRepository;
import com.terab.api.user.domain.User;
import com.terab.api.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Component
@RequiredArgsConstructor
@Slf4j
public class OwnerAccountInitializer implements ApplicationRunner {

  private final UserRepository userRepository;
  private final RoleRepository roleRepository;
  private final PasswordEncoder passwordEncoder;

  @Value("${app.owner.username:owner}")
  private String ownerUsername;

  @Value("${app.owner.password:#{null}}")
  private String ownerPassword;

  @Value("${app.owner.nickname:Owner}")
  private String ownerNickname;

  @Override
  @Transactional
  public void run(ApplicationArguments args) /* throws Exception */ {
    if(ownerPassword == null) {
      log.warn("app.owner.password not set - skipping owner account initialization");
      return;
    }
    if(userRepository.count() > 0) {
      return;
    }

    var ownerRole = roleRepository.findByName("OWNER")
      .orElseThrow(() -> new IllegalStateException(
        "OWNER role not found - V2 migration이 실행됐는지 확인하세요"
      ));

    User owner = new User();
    owner.setUsername(ownerUsername);
    owner.setNickname(ownerNickname);
    owner.setPassword(passwordEncoder.encode(ownerPassword));
    owner.setActive(true);
    owner.getRoles().add(ownerRole);

    userRepository.save(owner);
    log.info("OWNER account created: {}", ownerUsername);
  }
}
