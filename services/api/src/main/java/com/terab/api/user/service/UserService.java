package com.terab.api.user.service;

import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.common.exception.ApiException;
import com.terab.api.common.exception.ErrorCode;
import com.terab.api.user.domain.User;
import com.terab.api.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class UserService {

  private final UserRepository userRepository;

  @Transactional(readOnly = true)
  public User findByUsername(String username) {
    return userRepository.findByUsername(username)
      .orElseThrow(() -> new ApiException(ErrorCode.INVALID_CREDENTIALS));
  }

  @Transactional(readOnly = true)
  public User findById(UUID userId) {
    return userRepository.findById(userId)
      .orElseThrow(() -> new ApiException(ErrorCode.INVALID_CREDENTIALS));
  }
}
