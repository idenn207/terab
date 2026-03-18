-- 사용자 테이블
CREATE TABLE users (
    id          BIGSERIAL PRIMARY KEY,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    name        VARCHAR(100) NOT NULL,
    role        VARCHAR(20)  NOT NULL DEFAULT 'USER',
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- 파일/폴더 테이블 (트리 구조)
CREATE TABLE file_nodes (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id     BIGINT       REFERENCES file_nodes(id) ON DELETE CASCADE,
    name          VARCHAR(512) NOT NULL,
    type          VARCHAR(10)  NOT NULL CHECK (type IN ('FILE', 'FOLDER')),
    -- FILE 전용
    size          BIGINT,
    mime_type     VARCHAR(255),
    storage_key   VARCHAR(1024),   -- MinIO 오브젝트 키
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_file_nodes_user_id   ON file_nodes(user_id);
CREATE INDEX idx_file_nodes_parent_id ON file_nodes(parent_id);
