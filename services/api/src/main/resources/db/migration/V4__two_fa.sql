-- V4__two_fa.sql
-- 2FA 챌린지
CREATE TABLE IF NOT EXISTS two_fa_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  options VARCHAR(20) NOT NULL,
  correct_num VARCHAR(2) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);

CREATE INDEX idx_two_fa_challenges_user_id ON two_fa_challenges(user_id);

CREATE INDEX idx_two_fa_challenges_status ON two_fa_challenges(status);

-- 백업 코드
CREATE TABLE IF NOT EXISTS backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash VARCHAR(60) NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_backup_codes_user_id ON backup_codes(user_id);

-- 신뢰된 기기 (30일 2FA 스킵)
CREATE TABLE IF NOT EXISTS trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  user_agent VARCHAR(500),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trusted_devices_user_id ON trusted_devices(user_id);

CREATE INDEX idx_trusted_devices_token_hash ON trusted_devices(token_hash);