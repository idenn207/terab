package com.terab.api.trusteddevice.domain;

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
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "trusted_devices")
@Getter
@Setter
@NoArgsConstructor
public class TrustedDevice {
  
  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id", nullable = false)
  private User user;

  
  @Column(nullable = false, length = 64)
  private String tokenHash;
  
  @Column(length = 500)
  private String userAgent;
  
  @Column(nullable = false)
  private OffsetDateTime expiresAt;
  
  @Column(nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @PrePersist
  protected void onCreate() {
    this.createdAt = OffsetDateTime.now();
  }

  public boolean isValid() {
    return OffsetDateTime.now().isBefore(expiresAt);
  }
}
