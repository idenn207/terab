package com.terab.api.auth.application;

import java.util.List;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.auth.application.interfaces.ILoginUseCase;
import com.terab.api.auth.dto.AuthResult;
import com.terab.api.auth.dto.LoginRequest;
import com.terab.api.auth.dto.LoginResponse;
import com.terab.api.auth.dto.UserResponse;
import com.terab.api.auth.service.AuthService;
import com.terab.api.device.domain.Device;
import com.terab.api.device.service.DeviceService;
import com.terab.api.trusteddevice.service.TrustedDeviceService;
import com.terab.api.twofa.application.interfaces.ICreateChallengeUseCase;
import com.terab.api.twofa.dto.CreateChallengeResponse;
import com.terab.api.user.domain.User;
import com.terab.api.user.service.UserService;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class LoginUseCase implements ILoginUseCase {

  private final UserService userService;
  private final AuthService authService;
  private final DeviceService deviceService;
  private final TrustedDeviceService trustedDeviceService;
  private final ICreateChallengeUseCase createChallengeUseCase;

  @Transactional
  @Override
  public AuthResult execute(LoginRequest request, String trustToken) {
    User user = userService.findByUsername(request.username());
    authService.validateCredentials(user, request.password());

    // 등록된 Push 기기가 없고 platform이 mobile(android, ios)면 2FA 없이 즉시 로그인
    // TODO: 추후 모바일 기기일 경우 지문인식 추가, 새로운 기기에서 요청시 이미 로그인된 스마트폰으로 '로그인 시도' 알림 추가
    List<Device> devices = deviceService.findByUserId(user.getId());
    boolean hasPushDevice = devices.stream().anyMatch(d -> d.getPushToken() != null);
    if (!hasPushDevice) {
      return issueTokens(user);
    }

    // 신뢰기기 쿠키 검증 — 유효하면 2FA 스킵
    if (trustToken != null && trustedDeviceService.verify(trustToken, user)) {
      return issueTokens(user);
    }

    // Push 2FA 챌린지 생성 및 FCM Push 발송
    CreateChallengeResponse challenge = createChallengeUseCase.execute(user);
    return AuthResult.withoutToken(
      LoginResponse.twoFactorRequired(challenge.challengeId(), challenge.options(), challenge.expiresAt())
    );
  }

  private AuthResult issueTokens(User user) {
    String accessToken = authService.generateAccessToken(user);
    String rawRefreshToken = authService.issueRefreshToken(user);

    return AuthResult.withToken(
      LoginResponse.authenticated(accessToken, new UserResponse(user.getId(), user.getUsername(), user.getNickname())),
      rawRefreshToken,
      authService.getRefreshTokenExpMs()
    );
  }
}
