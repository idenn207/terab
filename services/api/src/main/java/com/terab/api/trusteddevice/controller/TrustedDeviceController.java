package com.terab.api.trusteddevice.controller;

import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.terab.api.security.CustomUserDetails;
import com.terab.api.trusteddevice.application.interfaces.IGetTrustedDevicesUseCase;
import com.terab.api.trusteddevice.application.interfaces.IRegisterTrustedDeviceUseCase;
import com.terab.api.trusteddevice.application.interfaces.IRevokeTrustedDeviceUseCase;
import com.terab.api.trusteddevice.dto.TrustedDeviceResponse;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;


@RestController
@RequestMapping("/api/auth/trusted-devices")
@RequiredArgsConstructor
public class TrustedDeviceController {
  
  private final IRegisterTrustedDeviceUseCase registerUseCase;
  private final IGetTrustedDevicesUseCase getUseCase;
  private final IRevokeTrustedDeviceUseCase revokeUseCase;

  @PostMapping
  public ResponseEntity<TrustedDeviceResponse> register(
    @AuthenticationPrincipal CustomUserDetails userDetails,
    @RequestHeader(value = "User-Agent", required = false) String userAgent,
    HttpServletResponse response
  ) {
    return ResponseEntity.status(HttpStatus.CREATED)
      .body(registerUseCase.execute(userDetails.getUserId(), userAgent, response));
  }
  
  @GetMapping
  public ResponseEntity<List<TrustedDeviceResponse>> list(@AuthenticationPrincipal CustomUserDetails userDetails) {
    return ResponseEntity.ok(getUseCase.execute(userDetails.getUserId()));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> revoke(
    @PathVariable UUID id,
    @AuthenticationPrincipal CustomUserDetails userDetails
  ) {
    revokeUseCase.execute(id, userDetails.getUserId());
    return ResponseEntity.noContent().build();
  }
}
