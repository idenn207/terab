package com.terab.api.auth.repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.terab.api.auth.domain.RefreshToken;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {
  @Query("""
      SELECT rt FROM RefreshToken rt JOIN FETCH rt.user u
      WHERE u.id = :userId
        AND rt.revokedAt IS NULL
        AND rt.expiresAt > CURRENT_TIMESTAMP
      """)
  List<RefreshToken> findValidByUserId(@Param("userId") UUID userId);

  @Modifying
  @Query("""
      UPDATE RefreshToken rt
      SET rt.revokedAt = :revokedAt
      WHERE rt.user.id = :userId AND rt.revokedAt IS NULL
      """)
  void revokeAllByUserId(@Param("userId") UUID userId, @Param("revokedAt") OffsetDateTime revokedAt);
}
