# Superpowers Archive INDEX

> **Last updated:** 2026-05-25
> **목적:** superpowers 플러그인 시기(2026-03-31 ~ 2026-05-20)에 누적된 plan/spec 82개의 주제별 색인.
> **현행 워크플로우:** 신규 작업은 `.claude/prds/`, `.claude/plans/` 사용. 자세한 흐름은 `.claude/plans/README.md` 참조.

이 디렉토리의 모든 문서는 **historical reference** 입니다. 본문 내 상대경로는 깨진 상태일 수 있으며, 의도적으로 수정하지 않습니다 (수정 비용 > 가치).

---

## 1. Auth — 인증/2FA/사용자

> 자체 로그인, RBAC, Push 2FA, 신뢰기기, 백업코드, 초대 가입, 디바이스 관리, 2FA fallback 전략, auth 도메인 분해

**관련 코드:** `services/api/src/auth/`, `services/api/src/twofa/`, `services/api/src/device/`, `services/api/src/trusted-device/`, `services/api/src/invitation/`, `services/api/src/security/`

### Plans
- 2026-04-01 — [auth-phase1](plans/2026-04-01-auth-phase1.md)
- 2026-04-19 — [push-2fa](plans/2026-04-19-push-2fa.md)
- 2026-04-26 — [mq-device-2fa](plans/2026-04-26-mq-device-2fa.md)
- 2026-04-28 — [invite-based-signup](plans/2026-04-28-invite-based-signup.md)
- 2026-05-20 — [auth-2fa-fallback-strategies-phase-0](plans/2026-05-20-auth-2fa-fallback-strategies-phase-0.md)
- 2026-05-20 — [auth-2fa-fallback-strategies-phase-1](plans/2026-05-20-auth-2fa-fallback-strategies-phase-1.md)
- 2026-05-20 — [auth-2fa-fallback-strategies-phase-2](plans/2026-05-20-auth-2fa-fallback-strategies-phase-2.md)
- 2026-05-20 — [auth-2fa-fallback-strategies-phase-3](plans/2026-05-20-auth-2fa-fallback-strategies-phase-3.md)
- 2026-05-20 — [auth-user-responsibility-split](plans/2026-05-20-auth-user-responsibility-split.md)

### Specs
- 2026-03-31 — [auth-design](specs/2026-03-31-auth-design.md)
- 2026-04-19 — [push-2fa-design](specs/2026-04-19-push-2fa-design.md)
- 2026-04-26 — [mq-device-2fa-design](specs/2026-04-26-mq-device-2fa-design.md)
- 2026-04-28 — [invite-based-signup-design](specs/2026-04-28-invite-based-signup-design.md)
- 2026-05-19 — [auth-2fa-fallback-strategies-design](specs/2026-05-19-auth-2fa-fallback-strategies-design.md)
- 2026-05-19 — [auth-domain-decomposition-design](specs/2026-05-19-auth-domain-decomposition-design.md)
- 2026-05-19 — [auth-login-401-bug-design](specs/2026-05-19-auth-login-401-bug-design.md)
- 2026-05-19 — [backup-code-regenerate-design](specs/2026-05-19-backup-code-regenerate-design.md)
- 2026-05-19 — [trust-token-ux-design](specs/2026-05-19-trust-token-ux-design.md)
- 2026-05-19 — [trusted-device-2fa-bypass-verification-design](specs/2026-05-19-trusted-device-2fa-bypass-verification-design.md)
- 2026-05-20 — [auth-user-responsibility-split-design](specs/2026-05-20-auth-user-responsibility-split-design.md)

---

## 2. Infra — 인프라/배포/도메인

> NAS 도메인 연결, 무중단 배포, Docker Secret, Makefile/Docker Stack 동기화

**관련 코드:** `docker-stack.yml`, `Makefile`, `services/nginx/`, `secrets/`

### Plans
- 2026-04-02 — [nas-domain-connection](plans/2026-04-02-nas-domain-connection.md)
- 2026-04-02 — [zero-downtime-deployment](plans/2026-04-02-zero-downtime-deployment.md)
- 2026-04-07 — [docker-secrets](plans/2026-04-07-docker-secrets.md)
- 2026-04-07 — [makefile-docker-stack-sync](plans/2026-04-07-makefile-docker-stack-sync.md)

### Specs
- 2026-04-02 — [nas-domain-connection-design](specs/2026-04-02-nas-domain-connection-design.md)
- 2026-04-02 — [zero-downtime-deployment-design](specs/2026-04-02-zero-downtime-deployment-design.md)
- 2026-04-07 — [docker-secrets-design](specs/2026-04-07-docker-secrets-design.md)
- 2026-04-07 — [makefile-docker-stack-sync-design](specs/2026-04-07-makefile-docker-stack-sync-design.md)

---

## 3. Env — 환경설정

> application.properties (Spring 시기), env 파일 관리 v1/v2

**관련 코드:** `*.env.example`, `services/api/src/config/`

### Plans
- 2026-04-11 — [application-properties-config](plans/2026-04-11-application-properties-config.md) — *(Spring Boot 시기, 후속 NestJS 전환으로 무효화)*
- 2026-04-11 — [env-management](plans/2026-04-11-env-management.md)
- 2026-04-17 — [env-management-v2](plans/2026-04-17-env-management-v2.md)

### Specs
- 2026-04-11 — [application-properties-config-design](specs/2026-04-11-application-properties-config-design.md)
- 2026-04-11 — [env-management-design](specs/2026-04-11-env-management-design.md)
- 2026-04-17 — [env-management-v2-design](specs/2026-04-17-env-management-v2-design.md)

---

## 4. Docs — README / CLAUDE.md

> 프로젝트 루트 및 각 서비스 CLAUDE.md 정의, README 정비

**관련 코드:** `README.md`, `CLAUDE.md`, `services/*/CLAUDE.md`

### Plans
- 2026-04-13 — [readme](plans/2026-04-13-readme.md)
- 2026-04-14 — [api-claude-md](plans/2026-04-14-api-claude-md.md)
- 2026-04-14 — [claude-md](plans/2026-04-14-claude-md.md)
- 2026-04-15 — [web-claude-md](plans/2026-04-15-web-claude-md.md)
- 2026-04-18 — [notification-claude-md](plans/2026-04-18-notification-claude-md.md)
- 2026-05-05 — [api-claude-md](plans/2026-05-05-api-claude-md.md)

### Specs
- 2026-04-13 — [readme-design](specs/2026-04-13-readme-design.md)
- 2026-04-14 — [api-claude-md-design](specs/2026-04-14-api-claude-md-design.md)
- 2026-04-14 — [claude-md-design](specs/2026-04-14-claude-md-design.md)
- 2026-04-15 — [web-claude-md-design](specs/2026-04-15-web-claude-md-design.md)
- 2026-04-18 — [notification-claude-md-design](specs/2026-04-18-notification-claude-md-design.md)
- 2026-05-05 — [api-claude-md-design](specs/2026-05-05-api-claude-md-design.md)

---

## 5. API Base — API 기반 시스템

> REST API 가이드(Spring → NestJS 전환), DDD/Layer 계층 정의, NestJS 기반 시스템 도입, API layer contract

**관련 코드:** `services/api/src/common/`, `services/api/src/core/`

### Plans
- 2026-04-09 — [spring-boot-rest-api-guide](plans/2026-04-09-spring-boot-rest-api-guide.md) — *(Spring 시기 가이드, 후속 NestJS 전환)*
- 2026-04-16 — [ddd-architecture-refactoring](plans/2026-04-16-ddd-architecture-refactoring.md)
- 2026-04-24 — [nestjs-api-base-system](plans/2026-04-24-nestjs-api-base-system.md)
- 2026-05-07 — [api-layer-contract](plans/2026-05-07-api-layer-contract.md)

### Specs
- 2026-04-09 — [spring-boot-rest-api-guide-design](specs/2026-04-09-spring-boot-rest-api-guide-design.md)
- 2026-04-16 — [ddd-architecture-design](specs/2026-04-16-ddd-architecture-design.md)
- 2026-04-24 — [nestjs-api-base-system-design](specs/2026-04-24-nestjs-api-base-system-design.md)
- 2026-05-07 — [api-layer-contract-design](specs/2026-05-07-api-layer-contract-design.md)

---

## 6. ts-rest 마이그레이션

> ts-rest + TanStack Query 도입(04-29) → ts-rest 제거 + Swagger/hey-api 전환(05-16) 전체 history

**관련 코드:** `services/api/` 전 도메인 controller, `services/web/src/api/`

### Plans
- 2026-04-29 — [ts-rest-tanstack-query-migration](plans/2026-04-29-ts-rest-tanstack-query-migration.md) — *(05-16에 제거됨)*
- 2026-05-16 — [ts-rest-removal-README](plans/2026-05-16-ts-rest-removal-README.md)
- 2026-05-16 — [ts-rest-removal-phase0-infra](plans/2026-05-16-ts-rest-removal-phase0-infra.md)
- 2026-05-16 — [ts-rest-removal-phase1-invitation](plans/2026-05-16-ts-rest-removal-phase1-invitation.md)
- 2026-05-16 — [ts-rest-removal-phase2-folder](plans/2026-05-16-ts-rest-removal-phase2-folder.md)
- 2026-05-16 — [ts-rest-removal-phase3-trusted-device](plans/2026-05-16-ts-rest-removal-phase3-trusted-device.md)
- 2026-05-16 — [ts-rest-removal-phase4-device](plans/2026-05-16-ts-rest-removal-phase4-device.md)
- 2026-05-16 — [ts-rest-removal-phase5-twofa](plans/2026-05-16-ts-rest-removal-phase5-twofa.md)
- 2026-05-16 — [ts-rest-removal-phase6-auth](plans/2026-05-16-ts-rest-removal-phase6-auth.md)
- 2026-05-16 — [ts-rest-removal-phase7-file](plans/2026-05-16-ts-rest-removal-phase7-file.md)
- 2026-05-16 — [ts-rest-removal-phase8-trash](plans/2026-05-16-ts-rest-removal-phase8-trash.md)
- 2026-05-16 — [ts-rest-removal-phase9-cleanup](plans/2026-05-16-ts-rest-removal-phase9-cleanup.md)

### Specs
- 2026-04-29 — [ts-rest-tanstack-query-migration-design](specs/2026-04-29-ts-rest-tanstack-query-migration-design.md)
- 2026-05-16 — [ts-rest-removal-swagger-migration-design](specs/2026-05-16-ts-rest-removal-swagger-migration-design.md)

---

## 7. File — 파일 관리/스토리지

> Phase 4 파일 관리(CRUD, 트리), MinIO presigned upload

**관련 코드:** `services/api/src/file/`, `services/api/src/folder/`, `services/api/src/minio/`, `services/api/src/trash/`

### Plans
- 2026-05-06 — [phase4-file-management](plans/2026-05-06-phase4-file-management.md)
- 2026-05-13 — [presigned-upload](plans/2026-05-13-presigned-upload.md)

### Specs
- 2026-05-06 — [phase4-file-management-design](specs/2026-05-06-phase4-file-management-design.md)
- 2026-05-13 — [presigned-upload-design](specs/2026-05-13-presigned-upload-design.md)

---

## 8. Logging — 로깅/관측성

> nestjs-pino API logger, service trace logging(@AutoTrace), API core + logging 일관성(@LogReplay)

**관련 코드:** `services/api/src/core/`, `services/api/src/common/logger/`

### Plans
- 2026-05-07 — [api-logger](plans/2026-05-07-api-logger.md)
- 2026-05-13 — [service-trace-logging](plans/2026-05-13-service-trace-logging.md)
- 2026-05-14 — [api-core-and-logging-consistency](plans/2026-05-14-api-core-and-logging-consistency.md)

### Specs
- 2026-05-07 — [api-logger-design](specs/2026-05-07-api-logger-design.md)
- 2026-05-13 — [service-trace-logging-design](specs/2026-05-13-service-trace-logging-design.md)
- 2026-05-14 — [api-core-and-logging-consistency-design](specs/2026-05-14-api-core-and-logging-consistency-design.md)

---

## 9. Notification — MQ/알림

> Notification 마이크로서비스(MQ + FCM/APNs) 설계

**관련 코드:** `services/mq/`

### Plans
- 2026-04-14 — [notification-ms](plans/2026-04-14-notification-ms.md)

### Specs
- 2026-04-14 — [notification-ms-design](specs/2026-04-14-notification-ms-design.md)

---

## 10. Mobile — 모바일

> Capacitor 기반 하이브리드 앱 (Android WebView)

**관련 코드:** `services/web/` (Capacitor 빌드 대상)

### Plans
- 2026-04-18 — [mobile-capacitor](plans/2026-04-18-mobile-capacitor.md)

### Specs
- 2026-04-18 — [mobile-capacitor-design](specs/2026-04-18-mobile-capacitor-design.md)

---

## 통계

| 카테고리 | Plans | Specs | 소계 |
|---|---|---|---|
| Auth | 9 | 11 | 20 |
| Infra | 4 | 4 | 8 |
| Env | 3 | 3 | 6 |
| Docs | 6 | 6 | 12 |
| API Base | 4 | 4 | 8 |
| ts-rest | 12 | 2 | 14 |
| File | 2 | 2 | 4 |
| Logging | 3 | 3 | 6 |
| Notification | 1 | 1 | 2 |
| Mobile | 1 | 1 | 2 |
| **합계** | **45** | **37** | **82** |

## 갱신 정책

- 6개월 주기 INDEX 재검토 (다음: 2026-11-25)
- 신규 archive 추가 시 해당 카테고리 절에 1줄 추가
- 본문 수정 금지 — historical reference 유지
