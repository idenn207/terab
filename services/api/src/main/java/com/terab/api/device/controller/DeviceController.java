package com.terab.api.device.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.terab.api.device.application.interfaces.IRegisterPushTokenUseCase;
import com.terab.api.device.dto.PushTokenRequest;
import com.terab.api.device.dto.PushTokenResponse;
import com.terab.api.security.CustomUserDetails;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/auth/devices")
@RequiredArgsConstructor
public class DeviceController {
  
  private final IRegisterPushTokenUseCase registerPushTokenUseCase;

  @PostMapping("/push-token")
  public ResponseEntity<PushTokenResponse> registerPushToken(
    @RequestBody @Valid PushTokenRequest request,
    @AuthenticationPrincipal CustomUserDetails userDetails
  ) {
    return ResponseEntity.ok(registerPushTokenUseCase.execute(userDetails.getUserId(), request));
  }
}
