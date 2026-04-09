# 안티패턴 — DB Migration

[← 목차로 돌아가기](./README.md)

---

## AP-17: `ddl-auto=update` 운영 사용

**위험도:** 🔴 데이터 손실 가능

**왜 문제인가:**
`update`는 엔티티에 없는 컬럼을 자동으로 삭제하지 않는다(추가만 함).
하지만 컬럼 이름 변경, 타입 변경 시 기존 컬럼을 삭제하고 새 컬럼을 추가하는 방식으로 동작해
데이터가 손실될 수 있다. 또한 동시 배포(롤링 업데이트) 시 구버전과 신버전 간 스키마 충돌이 발생한다.

```yaml
# ❌ 운영 환경
spring:
  jpa:
    hibernate:
      ddl-auto: update

# ✅ 운영 환경
spring:
  jpa:
    hibernate:
      ddl-auto: none  # 스키마는 Flyway가 관리
  flyway:
    enabled: true
```

---

## AP-18: `ddl-auto=create` / `create-drop` 운영 사용

**위험도:** 🔴 데이터 전체 삭제

**왜 문제인가:**
- `create`: 앱 시작 시 기존 테이블을 DROP하고 다시 CREATE → **모든 데이터 삭제**
- `create-drop`: 앱 종료 시 테이블 DROP → 재시작 시 데이터 없음

```yaml
# ❌ 절대 금지 (운영)
spring:
  jpa:
    hibernate:
      ddl-auto: create        # 시작 시 전체 데이터 삭제
      # 또는
      ddl-auto: create-drop   # 종료 시 전체 데이터 삭제
```

> 테스트 환경에서만 사용. `@SpringBootTest`와 H2 인메모리 DB 조합에서 허용.

---

## AP-19: Flyway 없이 DB 직접 수정

**위험도:** 🔴 환경 불일치

**왜 문제인가:**
DBeaver, psql 등으로 운영 DB를 직접 수정하면:
1. 개발/스테이징/운영 환경 간 스키마가 달라짐
2. 변경 이력이 없어 롤백 불가
3. 팀원 로컬 환경 재현 불가 → "내 로컬에서는 됩니다" 문제 발생

```sql
-- ❌ DBeaver/psql로 직접:
ALTER TABLE users ADD COLUMN last_login TIMESTAMP;

-- ✅ Flyway 마이그레이션 파일로:
-- V5__add_last_login_to_users.sql
ALTER TABLE users ADD COLUMN last_login TIMESTAMP;
-- → git에 기록, 모든 환경에 자동 적용
```

---

## AP-20: 실행된 Flyway 파일 수정

**위험도:** 🔴 앱 시작 실패

**왜 문제인가:**
Flyway는 실행된 파일의 checksum을 `flyway_schema_history` 테이블에 저장한다.
파일을 수정하면 저장된 checksum과 불일치 → 앱 시작 시 예외 발생.

```
ERROR: Validate failed:
Migration checksum mismatch for migration version 2
-> Applied to database : 1234567890
-> Resolved locally    : 9876543210
```

```sql
-- ❌ 실행된 파일 수정
-- V2__add_permissions_table.sql 을 편집

-- ✅ 새 마이그레이션 파일로 수정
-- V3__fix_permissions_table.sql
ALTER TABLE permissions ADD COLUMN description VARCHAR(200);
```

---

## AP-21: 마이그레이션에서 스키마 변경 + 데이터 변환 혼합

**위험도:** 🔴 부분 실패 시 복구 불가

**왜 문제인가:**
하나의 파일에서 DDL과 DML을 함께 실행하면 중간 실패 시 어디까지 반영됐는지 파악이 어렵다.
PostgreSQL은 DDL도 트랜잭션이 지원되지만, 대용량 데이터 업데이트 + DDL 혼합은 Lock 경합과 타임아웃을 유발한다.

```sql
-- ❌ V4__quota_feature.sql — DDL + DML 혼합
ALTER TABLE users ADD COLUMN quota_bytes BIGINT;
UPDATE users SET quota_bytes = 10737418240 WHERE quota_bytes IS NULL;
ALTER TABLE users ALTER COLUMN quota_bytes SET NOT NULL;

-- ✅ 분리
-- V4__add_quota_column.sql
ALTER TABLE users ADD COLUMN quota_bytes BIGINT;

-- V5__set_default_quota.sql
UPDATE users SET quota_bytes = 10737418240 WHERE quota_bytes IS NULL;

-- V6__quota_column_not_null.sql
ALTER TABLE users ALTER COLUMN quota_bytes SET NOT NULL;
```
