---
name: ts-rest-removal-swagger-migration
description: ts-rest 계약 기반 API 클라이언트를 Swagger + hey-api 코드젠 + TanStack Query 조합으로 전환
status: accepted
date: 2026-05-16
---

# ADR-0001: ts-rest 제거 → Swagger + hey-api + TanStack Query

## Status

accepted (PR #37, 커밋 0e67cb8 머지 — 2026-05-16)

## Context

`services/api` 는 NestJS 11 기반 REST API 를, `services/web` 은 React 19 + TypeScript 기반 클라이언트를 운영한다. 초기에는 양쪽 타입 안전성과 계약 검증을 위해 [ts-rest](https://ts-rest.com/) 를 도입했다 (PR #32, 커밋 41d4d29 — `refactor: ts-rest + TanStack Query 마이그레이션`).

ts-rest 운영 후 다음 한계가 누적됐다:

1. **단일 contract.ts 비대화**: 모든 엔드포인트 정의가 한 파일에 모여 도메인 분리·코드 리뷰가 어려워졌다. 도메인별 분할도 가능하나, ts-rest 는 분할된 contract 의 export·재조립 비용을 강제한다
2. **Swagger UI 부재**: ts-rest 자체는 OpenAPI 문서를 생성하지 않는다. 수동으로 `@nestjs/swagger` 와 병행 운영 시 두 곳에서 같은 메타를 중복 작성해야 했고, 두 정의가 drift 했다
3. **OpenAPI 생태계 진입 차단**: hey-api, openapi-generator, Postman/Insomnia 등 표준 OpenAPI 도구가 모두 ts-rest contract 를 직접 소비하지 못한다 — API 탐색·테스트·계약 문서화에서 도구 선택지가 좁아졌다
4. **NestJS swagger plugin 미활용**: NestJS 의 `@nestjs/swagger` plugin 은 class-validator 데코레이터를 OpenAPI 스키마로 자동 합성한다. ts-rest 의 zod schema 와는 이 합성이 동작하지 않아, DTO 메타를 zod + class-validator 양쪽에 적는 패턴이 누적됐다
5. **양측 동기화 부담**: services/api 의 ts-rest router 와 services/web 의 ts-rest client 가 동일 contract 를 import 하면서, 한쪽 변경이 반드시 다른 쪽 빌드를 깨뜨려 PR scope 가 커졌다

다른 선택지 검토:

- **GraphQL 도입**: 범위가 너무 크고 NestJS 의 REST + Swagger 생태계가 이미 충분
- **gRPC + grpc-web**: 브라우저·모바일 양면 운영 부담
- **현 상태 유지 + 도메인별 contract 분할**: 비대화는 완화되나 (2)(3)(4) 미해결

## Decision

**API 측 (services/api)**:

- NestJS `@nestjs/swagger` + class-validator + class-transformer 조합 채택
- 글로벌 `ValidationPipe` 가 request DTO 검증, swagger plugin (`nest-cli.json` 의 `"plugins": ["@nestjs/swagger"]`) 이 class-validator 메타를 OpenAPI 스키마로 자동 합성
- dev 환경에서 `/json` 경로로 OpenAPI 문서 노출 (`SwaggerModule.setup('swagger', app, doc, { jsonDocumentUrl: '/json' })`)
- 에러 응답은 `@ApiError('KEY1', 'KEY2')` 커스텀 데코레이터 + `ErrorCode` enum 으로 일관화 — 직접 `@ApiResponse({ status: 4xx })` 작성 금지
- DTO 컨벤션은 [services/api/CLAUDE.md §"Swagger / DTO 컨벤션"](../../services/api/CLAUDE.md) 에 강제 패턴으로 명문화 (메서드 데코레이터 순서, HttpCode 명시, validator 부착 의무 등)

**Web 측 (services/web)**:

- [`@hey-api/openapi-ts`](https://heyapi.dev/) 로 API 의 `/json` 을 소비하여 `services/web/src/shared/api/generated/` 에 코드젠
- 플러그인 조합: `@hey-api/client-axios` + `@hey-api/typescript` + `@hey-api/sdk` + `@tanstack/react-query`
- axios 단일 인스턴스(`shared/api/axiosInstance.ts`) + request interceptor 에서 `isPublicPath(url)` 기반 Authorization 헤더 분기 부착, 401 시 refresh queue 로 토큰 갱신 후 원 요청 재시도
- TanStack Query 가 서버 상태 캐시 담당, Zustand 는 클라이언트 세션(`accessToken`) 만 보유 — 서버 데이터의 Zustand 복제 금지
- 슬라이스 컨벤션: `api/` 세그먼트 항상 생성, GET → `query.ts`, mutation → `mutation.ts`. model 은 `../api/...` 만 import, codegen 함수 직접 import 금지
- 폼 검증은 react-hook-form `register()` 내장 옵션. zodResolver 금지 (Zod 의존성 제거)

## Consequences

### Positive

- **Swagger UI 자동 생성** — dev 환경에서 `/swagger` 경로로 API 탐색·테스트 가능
- **OpenAPI 표준 진입** — hey-api 외 다른 codegen 도구로의 교체 비용이 0 (Postman import, openapi-generator 등 임의 도구 사용 가능)
- **swagger plugin 의 자동 메타 합성** — class-validator 의 `@IsUUID()`, `@IsEnum()`, `@MinLength()` 등이 OpenAPI 의 `format: uuid`, `enum: [...]`, `minLength` 로 자동 변환. `@ApiProperty(...)` 의 중복 작성이 사라짐
- **services/web 의 일관 SDK** — 모든 엔드포인트가 hey-api 생성 함수 (`xxxMutation`, `xxxOptions`) 로 통일
- **services/api ↔ services/web 분리** — generated 디렉토리가 명시적 경계가 되어, API 변경이 즉시 빌드 깨짐으로 전파되지 않고 codegen 시점에 확인 가능

### Negative

- **codegen 수동 실행** — `npm --prefix services/web run openapi:codegen` 을 개발자가 명시적으로 호출해야 함. 자동화하려면 API dev 서버 watch + web codegen watch 의 이중 파이프라인 필요
- **generated 디렉토리 git tracked** — codegen 산출물이 PR diff 에 포함되어 변경 라인 수 증가. 단, 리뷰어가 codegen diff 와 사용처 diff 를 같은 PR 에서 검증 가능하다는 장점도 있음
- **codegen 호출 전제: API dev 서버 가동** — web codegen 시 `/json` 을 fetch 하므로 API 가 켜져 있어야 함. 오프라인 codegen 불가
- **타입 안전성 확인 시점 지연** — ts-rest 는 import 시점에 contract 타입이 즉시 검증됐으나, hey-api 는 codegen 사이클을 거쳐야 타입이 갱신됨

### Mitigations

- 강제 컨벤션을 [services/api/CLAUDE.md](../../services/api/CLAUDE.md) §"Swagger / DTO 컨벤션" 과 [services/web/CLAUDE.md](../../services/web/CLAUDE.md) §"API 레이어 / TanStack Query × Zustand 컨벤션" 에 명문화 — 금지 패턴 표 포함
- codegen 워크플로우 5단계를 services/web/CLAUDE.md 에 정형화: (1) API 변경 (2) dev 서버 reload (3) codegen 실행 (4) generated diff + 사용처 갱신 (5) 동시 commit
- 향후 codegen 자동화는 별도 작업으로 분리 (현재는 수동이 단순·예측 가능성 측면에서 우위)

## References

- **구현 PR**: [#37](https://github.com/<owner>/<repo>/pull/37) — `refactor: ts-rest 제거 → Swagger / hey-api / TanStack Query 전환` (커밋 0e67cb8)
- **선행 결정 (ts-rest 도입)**: [#32](https://github.com/<owner>/<repo>/pull/32) — `refactor: ts-rest + TanStack Query 마이그레이션` (커밋 41d4d29)
- **설계 문서 (스냅샷)**: [docs/archive/superpowers/specs/2026-05-16-ts-rest-removal-swagger-migration-design.md](../archive/superpowers/specs/2026-05-16-ts-rest-removal-swagger-migration-design.md) — 서버 컨벤션 §6.A, 클라이언트 컨벤션 §6.B
- **API 컨벤션**: [services/api/CLAUDE.md §"Swagger / DTO 컨벤션"](../../services/api/CLAUDE.md)
- **Web 컨벤션**: [services/web/CLAUDE.md §"API 레이어 / TanStack Query × Zustand 컨벤션"](../../services/web/CLAUDE.md)
- **codegen 설정**: [services/web/openapi-ts.config.ts](../../services/web/openapi-ts.config.ts)
- **axios 인스턴스**: [services/web/src/shared/api/axiosInstance.ts](../../services/web/src/shared/api/axiosInstance.ts)
