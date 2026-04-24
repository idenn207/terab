-- Drizzle 베이스라인: Flyway V2~V4 적용 후 최종 스키마
-- 기존 DB에서도 안전하게 실행되도록 IF NOT EXISTS 사용

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) NOT NULL UNIQUE,
  nickname VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  UNIQUE(resource, action)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  device_id UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200),
  push_token VARCHAR(500),
  platform VARCHAR(10) NOT NULL,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_push_token ON devices(push_token);

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

CREATE INDEX IF NOT EXISTS idx_two_fa_challenges_user_id ON two_fa_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_two_fa_challenges_status ON two_fa_challenges(status);

CREATE TABLE IF NOT EXISTS backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash VARCHAR(60) NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backup_codes_user_id ON backup_codes(user_id);

CREATE TABLE IF NOT EXISTS trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,
  user_agent VARCHAR(500),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_id ON trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_token_hash ON trusted_devices(token_hash);

-- RBAC 시드 데이터 (멱등성: INSERT ... WHERE NOT EXISTS)
INSERT INTO permissions (resource, action)
SELECT * FROM (VALUES
  ('file', 'read'), ('file', 'write'), ('file', 'delete'),
  ('share', 'create'), ('share', 'manage'),
  ('user', 'read'), ('user', 'invite'), ('user', 'manage'), ('user', 'role'),
  ('storage', 'read'), ('storage', 'manage'),
  ('system', 'monitor'), ('system', 'config'),
  ('audit', 'read')
) AS v(resource, action)
WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE resource = v.resource AND action = v.action);

INSERT INTO roles (name, is_system)
SELECT * FROM (VALUES ('OWNER', true), ('ADMIN', true), ('USER', true)) AS v(name, is_system)
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = v.name);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'USER'
  AND (p.resource || ':' || p.action) IN (
    'file:read','file:write','file:delete','share:create','storage:read'
  )
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'ADMIN'
  AND (p.resource || ':' || p.action) IN (
    'file:read','file:write','file:delete','share:create','storage:read',
    'share:manage','user:read','user:invite','user:manage','storage:manage',
    'system:monitor','audit:read'
  )
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'OWNER'
ON CONFLICT DO NOTHING;
