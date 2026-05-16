# ts-rest 제거 마이그레이션 — Plan 인덱스

> **Spec:** [`docs/superpowers/specs/2026-05-16-ts-rest-removal-swagger-migration-design.md`](../specs/2026-05-16-ts-rest-removal-swagger-migration-design.md)
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. 각 Phase plan을 순서대로 진행한다.

**작업 브랜치:** `refactor/ts-rest-removal`
**전략:** 단일 브랜치 + 단일 PR (운영 배포 1회), Phase별 commit
**예상 일정:** 2~3주 (단독 작업)

---

## Phase 순서 및 plan 파일

| Phase | 파일 | 도메인/주제 | 예상 commit |
|---|---|---|---|
| 0 | [`2026-05-16-ts-rest-removal-phase0-infra.md`](./2026-05-16-ts-rest-removal-phase0-infra.md) | 인프라 (swagger plugin, ValidationPipe, codegen wiring, axios 통합) | `chore: Phase 0 — class-validator/swagger 인프라 + hey-api codegen 설정` |
| 1 | [`2026-05-16-ts-rest-removal-phase1-invitation.md`](./2026-05-16-ts-rest-removal-phase1-invitation.md) | invitation 도메인 (패턴 정착) | `refactor: Phase 1 — invitation 도메인을 표준 NestJS로 전환` |
| 2 | [`2026-05-16-ts-rest-removal-phase2-folder.md`](./2026-05-16-ts-rest-removal-phase2-folder.md) | folder 도메인 | `refactor: Phase 2 — folder 도메인 전환` |
| 3 | [`2026-05-16-ts-rest-removal-phase3-trusted-device.md`](./2026-05-16-ts-rest-removal-phase3-trusted-device.md) | trusted-device 도메인 | `refactor: Phase 3 — trusted-device 도메인 전환` |
| 4 | [`2026-05-16-ts-rest-removal-phase4-device.md`](./2026-05-16-ts-rest-removal-phase4-device.md) | device 도메인 | `refactor: Phase 4 — device 도메인 전환` |
| 5 | [`2026-05-16-ts-rest-removal-phase5-twofa.md`](./2026-05-16-ts-rest-removal-phase5-twofa.md) | twofa 도메인 | `refactor: Phase 5 — twofa 도메인 전환` |
| 6 | [`2026-05-16-ts-rest-removal-phase6-auth.md`](./2026-05-16-ts-rest-removal-phase6-auth.md) | auth 도메인 (discriminated union 포함) | `refactor: Phase 6 — auth 도메인 전환 (oneOf+discriminator 포함)` |
| 7 | [`2026-05-16-ts-rest-removal-phase7-file.md`](./2026-05-16-ts-rest-removal-phase7-file.md) | file 도메인 (file + upload + download) | `refactor: Phase 7 — file 도메인 전환 (multipart/presigned 포함)` |
| 8 | [`2026-05-16-ts-rest-removal-phase8-trash.md`](./2026-05-16-ts-rest-removal-phase8-trash.md) | trash 도메인 | `refactor: Phase 8 — trash 도메인 전환` |
| N+1 | [`2026-05-16-ts-rest-removal-phase9-cleanup.md`](./2026-05-16-ts-rest-removal-phase9-cleanup.md) | packages/contracts 삭제 + Dockerfile/CI/Makefile 정리 + CLAUDE.md 박제 | `chore: Phase 9 — packages/contracts 제거 + 인프라/문서 정리` |

---

## Phase 간 의존성

```
Phase 0 (인프라) ─ 모든 Phase의 전제
   ↓
Phase 1 (invitation) ─ 패턴 정착, Phase 2~8의 참조 원본
   ↓
Phase 2 (folder) ─ Phase 7 (file)의 선행
   ↓
Phase 3 (trusted-device) ─ Phase 4 (device) 의존 없음 (병렬 가능)
   ↓
Phase 4 (device)
   ↓
Phase 5 (twofa) ─ auth 진입 전 쿠키/리프레시 패턴 검증
   ↓
Phase 6 (auth) ─ discriminated union 패턴 첫 적용, Phase 6 진입 전 dummy 검증
   ↓
Phase 7 (file) ─ multipart, presigned URL — 가장 복잡
   ↓
Phase 8 (trash) ─ file 의존
   ↓
Phase 9 (cleanup) ─ 모든 도메인 전환 후 packages/contracts·인프라·CLAUDE.md 정리
```

**병렬 가능 구간**: Phase 3 ↔ Phase 4 (둘 다 인증 곁가지, 서로 의존 없음). 단, 단일 브랜치이므로 같은 PR 안에서 commit 순서로만 의미 있음.

**순서 변경 금지**: Phase 0은 반드시 첫 번째. Phase 6 (auth)은 다른 도메인 전환 후 (인증 안정성 보호). Phase 9는 반드시 마지막.

---

## 모든 Phase 공통 패턴 (spec 섹션 6 박제 대상)

각 Phase plan에서 반복해서 참조하는 핵심 규칙:

### Swagger 작성 (NestJS)
- 메서드 데코레이터 순서 고정: `@Public/@RequirePermission` → `@Throttle` → HTTP 메서드 → `@HttpCode` → `@ApiOperation` → `@ApiExtraModels` → `@ApiResponse` → `@ApiError`
- POST 200/204, DELETE 204는 `@HttpCode` 명시 필수
- DTO는 `src/{domain}/dto/` 또는 `src/common/dto/`, 클래스명 `XxxDto`
- `@ApiError(...keys: ErrorCodeKey[])` 헬퍼만 사용 (직접 `@ApiResponse({ status: 4xx })` 금지)
- discriminated union은 `@ApiExtraModels + oneOf + discriminator.mapping` 3종 세트
- swagger plugin이 자동 처리하는 단순 필드는 `@ApiProperty()` 직접 부착 금지

### TanStack Query × Zustand (Web)
- `features/{slice}/api/` 항상 생성 (정책 유무 무관)
- model은 항상 `../api/...` 경유 (codegen 함수 직접 import 금지, 타입은 OK)
- 호출: mutation은 `{ data } = useMutation({ ...xxxMutation() })` + `mutate({ body }, { onSuccess: ({ data }) => ... })`
- Zustand 액션은 `useUserStore.getState().action()` 형태로 호출 (콜백 안)
- 도메인 공통 invalidation은 `api/mutation.ts` wrapper에서 처리
- queryKey 수동 작성 금지 (hey-api 자동 생성 키 사용)
- import는 `@shared/api` 통일 (`@/shared/api/generated/...` 직접 경로 금지)

### 도메인 Phase 진행 시 체크리스트 (spec 섹션 4.4와 동일)
모든 Phase 1~8 plan의 마지막에 동일 체크리스트 적용:

```
[API]
☐ src/{domain}/dto/ 디렉토리 생성
☐ Body/Query/Response DTO 작성
☐ Controller 변환
☐ controller spec 갱신
☐ service 시그니처 DTO 타입으로 교체
☐ contract import 제거

[Web]
☐ make api → npm run openapi:codegen → generated diff 검토
☐ features/{slice}/api/{query,mutation}.ts 갱신
☐ features/{slice}/model/useXxx.ts 갱신
☐ MSW handler import 경로 갱신

[공통]
☐ make build-api && make build-web 통과
☐ 도메인 e2e 흐름 수동 검증
☐ 도메인 단위 한글 conventional commit
```

---

## master 머지 전 최종 검증

Phase 9 종료 후, master 머지 전:

1. `make build-api && make build-web && make build-mq` 모두 통과
2. `cd services/api && npm test` 통과
3. `cd services/web && npm test` 통과
4. dev 환경 e2e 흐름 전체 수동 검증 (로그인 → 폴더/파일 생성 → 업로드 → 다운로드 → 삭제 → 휴지통 복원 → 2FA → 신뢰기기 등록 → 초대장 발급/사용 등)
5. PR description에 Phase별 commit hash 매핑 + 변경 요약 + 위험 요소·완화책 명시
6. master로 PR 1회 (자동 배포 1회)

---

## 실행 방식

각 Phase plan은 독립 실행 가능. 권장:

- **subagent-driven-development**: Phase별로 fresh subagent 세션을 dispatch. 메인 세션은 Phase 종료 시점 review만. Phase 2~8 같은 반복 패턴 도메인에 특히 효율적.
- **executing-plans**: 한 세션에서 plan을 순차 실행. 검증 포인트(Phase 종료 시점)마다 review.

선택은 Phase 0 시작 시점에 결정.
