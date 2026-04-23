package com.terab.api.twofa.repository;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import com.terab.api.twofa.domain.TwoFaChallenge;

public interface TwoFaChallengeRepository extends JpaRepository<TwoFaChallenge, UUID> {}
