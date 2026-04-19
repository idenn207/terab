package com.terab.api.twofa.controller;

import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.terab.api.security.CustomUserDetails;
import com.terab.api.twofa.application.interfaces.IGetChallengeStatusUseCase;
import com.terab.api.twofa.application.interfaces.IResendChallengeUseCase;
import com.terab.api.twofa.application.interfaces.IRespondToChallengeUseCase;
import com.terab.api.twofa.dto.ChallengeStatusResponse;
import com.terab.api.twofa.dto.CreateChallengeResponse;
import com.terab.api.twofa.dto.RespondRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;


@RestController
@RequestMapping("/api/auth/2fa")
@RequiredArgsConstructor
public class TwoFaController {
  
  private final IGetChallengeStatusUseCase getChallengeStatusUseCase;
  private final IRespondToChallengeUseCase respondToChallengeUseCase;
  private final IResendChallengeUseCase resendChallengeUseCase;

  @GetMapping("/challenge/{id}/status")
  public ResponseEntity<ChallengeStatusResponse> getStatus(@PathVariable UUID id) {
    return ResponseEntity.ok(getChallengeStatusUseCase.execute(id));
  }

  @PostMapping("/challenge/{id}/respond")
  public ResponseEntity<ChallengeStatusResponse> respond(
    @PathVariable UUID id,
    @RequestBody @Valid RespondRequest request,
    @AuthenticationPrincipal CustomUserDetails userDetails
  ) {
    respondToChallengeUseCase.execute(id, request, userDetails.getUserId());
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/challenge/{id}/resend")
  public ResponseEntity<CreateChallengeResponse> resend(@PathVariable UUID id) {
    return ResponseEntity.ok(resendChallengeUseCase.execute(id));
  }
}
