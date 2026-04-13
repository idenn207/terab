package com.terab.api.security;

import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class TokenHasher {

  private final byte[] pepperBytes;

  public TokenHasher(@Value("${app.security.password-pepper}") String pepper) {
    this.pepperBytes = pepper.getBytes(StandardCharsets.UTF_8);
  }

  /**
   * 패스워드에 pepper 를 적용해 HMAC-SHA256 hex 를 반환합니다.
   * 반환값(64자)을 BCryptPasswordEncoder 에 전달합니다.
   */
  public String pepperPassword(String rawPassword) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(pepperBytes, "HmacSHA256"));
      byte[] result = mac.doFinal(rawPassword.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(result);
    } catch (NoSuchAlgorithmException | InvalidKeyException e) {
      throw new IllegalStateException("HmacSHA256 unavailable", e);
    }
  }

  /**
   * Refresh Token 을 SHA-256 hex 로 해시합니다.
   */
  public String hashRefreshToken(String rawToken) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(hash);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 unavailable", e);
    }
  }

  public boolean verifyRefreshToken(String rawToken, String storedHash) {
    byte[] expected = hashRefreshToken(rawToken).getBytes(StandardCharsets.UTF_8);
    byte[] actual   = storedHash.getBytes(StandardCharsets.UTF_8);
    return MessageDigest.isEqual(expected, actual);
  }
}
