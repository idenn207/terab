-- V3__devices.sql
-- Push Token 등록을 위한 devices 테이블
-- Device 관리 UI (D-10a)는 Phase 3에서 구현
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200),
  push_token VARCHAR(500),
  platform VARCHAR(10) NOT NULL,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_devices_user_id ON devices(user_id);

CREATE INDEX idx_devices_push_token ON devices(push_token);