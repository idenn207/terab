# DB Migration

> 스키마 변경은 항상 Flyway를 통해. `ddl-auto`는 운영에서 반드시 `none`.

## 요약 테이블

| 설정/규칙 | 중요도 | 역할 | 적용 위치 | 주의사항 |
|---|---|---|---|---|
| `ddl-auto=none` | ★★★ | 스키마 자동 변경 비활성화 (운영 필수) | application.yml | 운영 환경 기본값 |
| `ddl-auto=validate` | ★★☆ | 엔티티-DB 스키마 일치 검증 | application.yml | Flyway와 함께 사용 |
| `ddl-auto=update` | ★☆☆ | 자동 스키마 변경 (로컬 개발만) | application.yml | 운영 절대 금지 |
| `V{n}__{desc}.sql` | ★★★ | Flyway 마이그레이션 파일 규칙 | 파일명 | 실행 후 절대 수정 금지 |
| `R__{desc}.sql` | ★☆☆ | 반복 실행 마이그레이션 | 파일명 | 멱등성 보장 필수 |
| `baseline-on-migrate` | ★★☆ | 기존 DB에 Flyway 최초 도입 | application.yml | 초기 도입 시 1회만 |

---

## ddl-auto 옵션 상세

| 값 | 동작 | 권장 환경 |
|---|---|---|
| `none` | 아무것도 안 함 | **운영 (필수)** |
| `validate` | 엔티티 ↔ 스키마 불일치 시 앱 시작 실패 | 운영 (Flyway 있을 때) |
| `update` | 엔티티 변경에 맞게 스키마 자동 ALTER | 로컬 개발만 |
| `create` | 앱 시작 시 스키마 DROP 후 CREATE | 테스트 환경만 |
| `create-drop` | 앱 종료 시 스키마 DROP | 테스트 환경만 |

```yaml
# application-prod.yml — 운영 설정
spring:
  jpa:
    hibernate:
      ddl-auto: none  # Flyway가 스키마를 관리
  flyway:
    enabled: true
    locations: classpath:db/migration

# application-local.yml — 로컬 개발
spring:
  jpa:
    hibernate:
      ddl-auto: update  # 빠른 프로토타이핑용
  flyway:
    enabled: false
```

---

## Flyway

### 동작 원리

1. 앱 시작 시 `flyway_schema_history` 테이블에서 실행 이력 조회
2. `db/migration/` 디렉터리의 SQL 파일을 버전 순으로 스캔
3. 미실행 파일을 순서대로 실행하고 이력에 기록
4. 이미 실행된 파일의 내용이 변경되면 **checksum 오류**로 앱 시작 실패

### 파일 네이밍 규칙

```
V{버전}__{설명}.sql
│         │
│         └─ 언더스코어 2개 필수, 공백은 _로 대체
└─ 정수 또는 소수점 버전 (V1, V1.1, V2)

예시:
V1__init_schema.sql
V2__add_permissions_table.sql
V3__add_user_quota_column.sql
V1.1__add_index_to_users_email.sql
```

### 마이그레이션 파일 작성 원칙

```sql
-- V2__add_permissions_table.sql
-- ✅ 원칙 1: 한 파일에 하나의 논리적 변경
CREATE TABLE permissions (
    id          UUID        NOT NULL DEFAULT gen_random_uuid(),
    resource    VARCHAR(50) NOT NULL,
    action      VARCHAR(50) NOT NULL,
    created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id)
);

CREATE INDEX idx_permissions_resource_action ON permissions (resource, action);
```

```sql
-- ❌ 원칙 2 위반: 스키마 변경과 데이터 변환 혼합
ALTER TABLE users ADD COLUMN quota_bytes BIGINT;
UPDATE users SET quota_bytes = 10737418240;  -- 혼합 시 롤백 복잡

-- ✅ 분리
-- V3__add_quota_column.sql: ALTER만
-- V4__set_default_quota.sql: UPDATE만
```

```sql
-- ✅ 원칙 3: 롤백 불가를 염두에 둔 안전한 변경
-- 컬럼 추가: DEFAULT 값 또는 nullable 허용
ALTER TABLE users ADD COLUMN storage_quota_bytes BIGINT DEFAULT 10737418240;

-- ❌ 위험: 기존 데이터가 있는 컬럼에 NOT NULL 즉시 추가
ALTER TABLE users ADD COLUMN new_required_field VARCHAR(100) NOT NULL;
-- 해결: 1) nullable로 추가 → 2) 데이터 채우기 → 3) NOT NULL 추가 (3단계 마이그레이션)
```

### Flyway vs Liquibase

| 항목 | Flyway | Liquibase |
|---|---|---|
| 문법 | SQL / Java | XML / YAML / JSON / SQL |
| 학습 곡선 | 낮음 | 높음 |
| 롤백 | 유료 기능 (Community 불가) | XML 기반 롤백 지원 |
| 적합한 경우 | SQL 직접 작성 선호, 단순한 마이그레이션 | 복잡한 멀티 DB, 롤백 필수 |

> terab 권장: **Flyway** — SQL을 그대로 사용하고, 롤백 대신 Forward Migration 전략으로 운영.

### Flyway 의존성 (build.gradle)

```groovy
dependencies {
    implementation 'org.flywaydb:flyway-core'
    implementation 'org.flywaydb:flyway-database-postgresql'
}
```
