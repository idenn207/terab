package com.terab.api.auth.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
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
}
