package com.terab.api.auth.application;

import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.auth.application.interfaces.IGetCurrentUserUseCase;
import com.terab.api.auth.dto.UserResponse;
import com.terab.api.user.domain.User;
import com.terab.api.user.service.UserService;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class GetCurrentUserUseCase implements IGetCurrentUserUseCase {

  private final UserService userService;

  @Transactional(readOnly = true)
  @Override
  public UserResponse execute(UUID userId) {
    User user = userService.findById(userId);
    return new UserResponse(user.getId(), user.getUsername(), user.getNickname());
  }
}
