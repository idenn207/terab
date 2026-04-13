package com.terab.api.auth.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.terab.api.auth.dto.LoginRequest;
import com.terab.api.auth.dto.LoginResponse;
import com.terab.api.auth.dto.UserResponse;
import com.terab.api.auth.service.AuthService;
import com.terab.api.common.exception.ApiException;
import com.terab.api.common.exception.ErrorCode;
import com.terab.api.security.CustomUserDetails;
import com.terab.api.user.domain.User;
import com.terab.api.user.repository.UserRepository;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
  
  private final AuthService authService;
  private final UserRepository userRepository;

  @PostMapping("/login")
  public ResponseEntity<LoginResponse> login(
    @RequestBody @Valid LoginRequest request,
    HttpServletResponse response
  ) {
    return ResponseEntity.ok(authService.login(request, response));
  }

  @PostMapping("/refresh")
  public ResponseEntity<LoginResponse> refresh(
    @CookieValue(name = "refreshToken", required = false) String refreshToken,
    HttpServletResponse response
  ) {
    if(refreshToken == null) {
      throw new ApiException(ErrorCode.REFRESH_TOKEN_INVALID);
    }
    
    return ResponseEntity.ok(authService.refresh(refreshToken, response));
  }

  @PostMapping("/logout")
    public ResponseEntity<Void> logout(
      @AuthenticationPrincipal CustomUserDetails userDetails,
      @CookieValue(name = "refreshToken", required = false) String refreshToken,
      HttpServletResponse response
    ) {
    authService.logout(userDetails.getUserId(), refreshToken, response);
    return ResponseEntity.noContent().build();
  }
  

  @GetMapping("/me")
  public ResponseEntity<UserResponse> me(
    @AuthenticationPrincipal CustomUserDetails userDetails
  ) {
    User user = userRepository.findById(userDetails.getUserId())
      .orElseThrow(() -> new ApiException(ErrorCode.INVALID_CREDENTIALS));
    return ResponseEntity.ok(new UserResponse(user.getId(), user.getUsername(), user.getNickname()));
  }
}
