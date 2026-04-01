-- V2__auth_phase1_schema.sql
-- 기존 V1 스키마(bigserial 기반) 제거 후 UUID 기반 신규 스키마 적용
DROP TABLE IF EXISTS file_nodes;

DROP TABLE IF EXISTS users;

-- 사용자 테이블
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) NOT NULL UNIQUE,
  nickname VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_username ON users(username);

CREATE INDEX idx_users_nickname ON users(nickname);

CREATE INDEX idx_users_created_at ON users(created_at);

-- RBAC
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  UNIQUE(resource, action)
);

CREATE TABLE role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- 인증
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  device_id UUID,
  -- 모바일 인증 이전까지 NULL
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- RBAC 시드 데이터
INSERT INTO
  permissions (resource, action)
VALUES
  ('file', 'read'),
  ('file', 'write'),
  ('file', 'delete'),
  ('share', 'create'),
  ('share', 'manage'),
  ('user', 'read'),
  ('user', 'invite'),
  ('user', 'manage'),
  ('user', 'role'),
  ('storage', 'read'),
  ('storage', 'manage'),
  ('system', 'monitor'),
  ('system', 'config'),
  ('audit', 'read');

INSERT INTO
  roles (name, is_system)
VALUES
  ('OWNER', true),
  ('ADMIN', true),
  ('USER', true);

-- USER 역할 권한
INSERT INTO
  role_permissions (role_id, permission_id)
SELECT
  r.id,
  p.id
FROM
  roles r,
  permissions p
WHERE
  r.name = 'USER'
  AND (p.resource || ':' || p.action) IN (
    'file:read',
    'file:write',
    'file:delete',
    'share:create',
    'storage:read'
  );

-- ADMIN 역할 권한
INSERT INTO
  role_permissions (role_id, permission_id)
SELECT
  r.id,
  p.id
FROM
  roles r,
  permissions p
WHERE
  r.name = 'ADMIN'
  AND (p.resource || ':' || p.action) IN (
    'file:read',
    'file:write',
    'file:delete',
    'share:create',
    'storage:read',
    'share:manage',
    'user:read',
    'user:invite',
    'user:manage',
    'storage:manage',
    'system:monitor',
    'audit:read'
  );

-- OWNER 역할 권한 (전체)
INSERT INTO
  role_permissions (role_id, permission_id)
SELECT
  r.id,
  p.id
FROM
  roles r,
  permissions p
WHERE
  r.name = 'OWNER';