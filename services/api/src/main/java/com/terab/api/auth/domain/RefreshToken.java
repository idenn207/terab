package com.terab.api.auth.domain;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.terab.api.user.domain.User;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "refresh_tokens")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RefreshToken {
  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id", nullable = false)
  private User user;

  @Column(nullable = false)
  private String tokenHash;

  // TODO: 디바이스 관리 개발시 같이 개발 진행
  private UUID deviceId;

  @Column(nullable = false)
  private OffsetDateTime expiresAt;

  private OffsetDateTime revokedAt;

  public boolean isVaild() {
    return revokedAt == null && OffsetDateTime.now().isBefore(expiresAt);
  }
}
