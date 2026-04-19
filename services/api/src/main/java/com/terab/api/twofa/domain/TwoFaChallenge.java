package com.terab.api.twofa.domain;

import java.time.OffsetDateTime;
import java.util.List;
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
@Table(name = "two_fa_challenges")
@Getter
@Setter
@NoArgsConstructor
public class TwoFaChallenge {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;
  
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id", nullable = false)
  private User user;
  
  @Column(nullable = false, length = 20)
  private String options;
  
  @Column(nullable = false, length =20)
  private String correctNum;
  
  @Column(nullable = false, length = 10)
  private String status;
  
  @Column(nullable = false, updatable = false)
  private OffsetDateTime expiresAt;
  
  @Column(nullable = false)
  private OffsetDateTime createdAt;
  
  private OffsetDateTime respondedAt;

  @PrePersist
  protected void onCreate() {
    this.createdAt = OffsetDateTime.now();
  }

  public boolean isPending() {
    return "PENDING".equals(status);
  }

  public List<String> getOptionsList() {
    return List.of(options.split(","));
  }
}
