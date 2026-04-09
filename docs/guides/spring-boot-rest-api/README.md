# Spring Boot REST API 가이드

> terab 프로젝트(Java 21 + Spring Boot 3.x) 기반 개인 개발 참고용 치트시트

## 레이어별 가이드

| # | 파일 | 주요 내용 |
|---|------|-----------|
| 01 | [Controller Layer](./01-controller-layer.md) | 요청 매핑, 바인딩, 응답 제어, 예외 처리 |
| 02 | [Service Layer](./02-service-layer.md) | 트랜잭션, Propagation, Isolation, AOP 원리 |
| 03 | [JPA / Repository Layer](./03-jpa-repository-layer.md) | 엔티티, 연관관계, Lombok + JPA 패턴 |
| 04 | [Security / Auth](./04-security-auth.md) | JWT 필터, RBAC, 권한 검증 어노테이션 |
| 05 | [DB Migration](./05-db-migration.md) | Flyway, ddl-auto 옵션, 마이그레이션 원칙 |

## Quick Reference

- [카테고리별 어노테이션 전체 색인](./06-quick-reference.md)

## 안티패턴 가이드

- [안티패턴 목차 및 전체 목록 (29개)](./anti-patterns/README.md)

---

## 프로젝트 컨벤션 (terab 기준)

| 항목 | 컨벤션 |
|------|--------|
| PK 타입 | `UUID` — `@GeneratedValue(strategy = GenerationType.UUID)` |
| Lombok 패턴 | `@Getter` + `@Builder` + `@NoArgsConstructor(access = PROTECTED)` + `@AllArgsConstructor` |
| DTO 패턴 | `XxxRequest` / `XxxResponse` 분리 (Entity 직접 노출 금지) |
| 예외 패턴 | `ApiException(ErrorCode)` → `GlobalExceptionHandler` (`@RestControllerAdvice`) |
| 권한 형식 | `리소스:액션` (예: `file:read`, `user:manage`, `system:config`) |
| 패키지 구조 | `{domain}/controller`, `{domain}/service`, `{domain}/repository`, `{domain}/domain`, `{domain}/dto` |
| 기본 URL prefix | `/api/{domain}` (예: `/api/auth`, `/api/files`, `/api/users`) |
