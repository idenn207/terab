# 안티패턴 가이드

> Spring Boot REST API 개발에서 절대 사용하면 안 되는 패턴 29가지.
> 위험도: 🔴 데이터 손실 | 🟠 보안 취약점 | 🟡 성능 저하 | 🔵 유지보수 문제

## 전체 목록

| # | 패턴 | 카테고리 | 위험도 | 파일 |
|---|------|----------|--------|------|
| AP-01 | Controller에서 `@Transactional` 사용 | Controller | 🔵 | [01-controller.md](./01-controller.md) |
| AP-02 | Controller에서 비즈니스 로직 직접 구현 | Controller | 🔵 | [01-controller.md](./01-controller.md) |
| AP-03 | `@RequestBody`에 Entity 직접 바인딩 | Controller | 🟠 | [01-controller.md](./01-controller.md) |
| AP-04 | 응답에 Entity 직접 반환 | Controller | 🟠 | [01-controller.md](./01-controller.md) |
| AP-05 | `@PathVariable`로 내부 순차 DB ID 노출 | Controller | 🟠 | [01-controller.md](./01-controller.md) |
| AP-06 | `@Transactional` self-invocation | Service | 🔵 | [02-service.md](./02-service.md) |
| AP-07 | `@Transactional(readOnly=true)` 미사용 | Service | 🟡 | [02-service.md](./02-service.md) |
| AP-08 | Service에서 `HttpServletRequest` 직접 참조 | Service | 🔵 | [02-service.md](./02-service.md) |
| AP-09 | CheckedException `rollbackFor` 미설정 | Service | 🔴 | [02-service.md](./02-service.md) |
| AP-10 | `@Entity`에 Lombok `@Data` 사용 | JPA | 🔵 | [03-jpa-repository.md](./03-jpa-repository.md) |
| AP-11 | `@ManyToMany` 중간 엔티티 없이 사용 | JPA | 🔵 | [03-jpa-repository.md](./03-jpa-repository.md) |
| AP-12 | N+1 쿼리 (Lazy 로딩 + 반복 접근) | JPA | 🟡 | [03-jpa-repository.md](./03-jpa-repository.md) |
| AP-13 | 영속성 컨텍스트 밖 Lazy 로딩 | JPA | 🔵 | [03-jpa-repository.md](./03-jpa-repository.md) |
| AP-14 | `Optional.get()` 직접 호출 | JPA | 🔵 | [03-jpa-repository.md](./03-jpa-repository.md) |
| AP-15 | 양방향 연관관계에서 `@ToString` 사용 | JPA | 🔵 | [03-jpa-repository.md](./03-jpa-repository.md) |
| AP-16 | `@Column(nullable=false)` 미설정 | JPA | 🔴 | [03-jpa-repository.md](./03-jpa-repository.md) |
| AP-17 | `ddl-auto=update` 운영 사용 | DB | 🔴 | [04-db-migration.md](./04-db-migration.md) |
| AP-18 | `ddl-auto=create`/`create-drop` 운영 사용 | DB | 🔴 | [04-db-migration.md](./04-db-migration.md) |
| AP-19 | Flyway 없이 DB 직접 수정 | DB | 🔴 | [04-db-migration.md](./04-db-migration.md) |
| AP-20 | 실행된 Flyway 파일 수정 | DB | 🔴 | [04-db-migration.md](./04-db-migration.md) |
| AP-21 | 마이그레이션에서 스키마 변경 + 데이터 변환 혼합 | DB | 🔴 | [04-db-migration.md](./04-db-migration.md) |
| AP-22 | 빈 catch 블록 (예외 삼킴) | 예외 | 🔵 | [05-exception-handling.md](./05-exception-handling.md) |
| AP-23 | `Exception` 전체 catch | 예외 | 🔵 | [05-exception-handling.md](./05-exception-handling.md) |
| AP-24 | HTTP 200에 에러 응답 반환 | 예외 | 🔵 | [05-exception-handling.md](./05-exception-handling.md) |
| AP-25 | `@RestControllerAdvice` 없이 예외 분산 처리 | 예외 | 🔵 | [05-exception-handling.md](./05-exception-handling.md) |
| AP-26 | 응답에 민감 필드 포함 (password 등) | 보안 | 🟠 | [06-security.md](./06-security.md) |
| AP-27 | JPQL에 문자열 직접 연결 | 보안 | 🟠 | [06-security.md](./06-security.md) |
| AP-28 | 권한 검증을 프론트엔드에만 의존 | 보안 | 🟠 | [06-security.md](./06-security.md) |
| AP-29 | JWT Secret 코드 하드코딩 | 보안 | 🟠 | [06-security.md](./06-security.md) |
