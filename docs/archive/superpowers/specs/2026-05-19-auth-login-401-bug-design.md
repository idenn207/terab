# Auth 로그인 직후 401 버그 — 진단 및 수정

작성일: 2026-05-19
대상: services/api (auth 도메인)
유형: bug fix (root cause 미확정 — 진단 단계 포함)

## 1. 배경

Postman 기반 수동 테스트에서 다음 흐름이 재현됨.

1. `POST /api/auth/login` 호출 → response body에 `accessToken` (T1) 정상 수령
2. `Authorization: Bearer T1` 헤더로 `@CurrentUser` 필요 라우트(예: `GET /api/auth/me`) 호출 → **401**
3. `POST /api/auth/refresh` (httpOnly cookie) 호출 → 새 `accessToken` (T2) 수령
4. `Authorization: Bearer T2`로 같은 라우트 재호출 → **200**

T1과 T2는 모두 `AuthService.issueTokenPair`에서 `TokenService.generateAccessToken`을 거쳐 발급된다. 코드 정적 분석상 두 토큰의 발급 경로·secret·payload 생성 로직은 동일하다. 따라서 정적 분석으로는 root cause를 단정할 수 없으며, 런타임 진단이 필요하다.

## 2. 정적 분석으로 부정된 후보

| 후보 | 결론 |
|---|---|
| Web의 `isPublicPath`가 `/auth/me`까지 public으로 잡아 Bearer 미부착 | 부정 — `public-paths.gen.ts`는 `/auth/me` 미포함. 또한 사용자는 Postman 사용으로 web 무관 |
| hey-api SDK가 별도 axios 인스턴스 사용 | 부정 — `runtime-config.ts`가 shared `axiosInstance`를 주입 (web 한정 후보) |
| hey-api mutationFn이 응답을 unwrap 안 함 | 부정 — `mutationFn`은 `{ data }`를 unwrap해 반환 (web 한정 후보) |
| `JWT_ACCESS_EXPIRY_MS`가 비정상적으로 짧음 | 부정 — `api.env.example` 기본값 900000ms (15분). 단, 사용자 로컬 `.env`의 실제 값은 진단 단계에서 재확인 |
| `JwtModule.register` secret과 `JwtStrategy.secretOrKey` 불일치 | 부정 — 둘 다 `configService.getOrThrow('JWT_SECRET')` |
| login response DTO 직렬화 시 `accessToken` 누락 | 부정 — 컨트롤러가 plain object를 반환. `ClassSerializerInterceptor`는 class 인스턴스에만 작용 |
| `findUserWithPermissionsByUsername` vs `findUserWithPermissionsById` 결과 shape 차이 | 부정 — 두 메서드 모두 `aggregateUser`로 동일 shape (`UserWithPermissions`) 반환 |

## 3. 진단 절차

systematic-debugging skill을 따른다. 가설을 사전 단정하지 않고 증거를 먼저 수집한다.

### 3.1 환경 준비

- `make infra` (DB·Redis·MinIO 기동)
- `make api` (API 서버 기동, watch 모드)
- 로컬 `.env`의 다음 값을 캡처해 spec 노트에 기록한다 (실제 값 vs example):
  - `JWT_SECRET` 길이 (값 자체는 기록 금지)
  - `JWT_ACCESS_EXPIRY_MS`
  - `JWT_REFRESH_EXPIRY_MS`
  - 시스템 시각과 컨테이너 시각 차이 (`date` vs `docker exec ... date`)

### 3.2 1차 재현 — 토큰 자체 비교

각 단계의 요청·응답을 그대로 기록한다.

1. `POST /api/auth/login` (2FA 미설정 사용자) → `accessToken` T1 수령
2. `GET /api/auth/me` with `Authorization: Bearer T1` → **401 예상**. 401 body·status·headers 기록
3. T1을 base64 디코드하여 payload(`sub`, `username`, `permissions`, `iat`, `exp`) 기록
4. `POST /api/auth/refresh` (cookie 기반) → `accessToken` T2 수령
5. `GET /api/auth/me` with `Authorization: Bearer T2` → **200 예상**. 200 body 기록
6. T2 디코드 → T1과 payload diff

### 3.3 2차 — payload diff가 없을 때의 분기

T1·T2 payload가 동일하다면(예상 시나리오) passport-jwt가 T1을 거절하는 사유를 직접 확인한다.

- `JwtStrategy.validate` 진입 지점과 `JwtAuthGuard.canActivate`에 임시 디버그 로그를 삽입
  - validate 미진입 시: passport-jwt extract/verify 단계에서 실패. AuthGuard의 `handleRequest(err, user, info)` override를 일시 추가해 `info.message`를 로깅
  - validate 진입 시: payload 내용을 로깅하고 반환 직전의 `AuthUser` 객체 확인
- 캡처된 사유에 따라 분기:
  - JWT 서명 불일치 → `JWT_SECRET` 런타임 값 충돌(예: 멀티 컨테이너에서 secret 재생성) 의심
  - JWT expired → 발급 시각과 검증 시각의 시계 차 의심
  - JWT malformed → 응답 직렬화 단계에서 토큰이 변형되었는지 확인 (e.g. trailing 공백, 헤더 split 등)
  - Other → 진단 결과에 따라 별도 가설 수립

### 3.4 기록 양식

진단 결과는 PR 또는 follow-up 메모에 다음 형식으로 첨부한다.

```
[T1 payload]
sub: ...
iat: ...
exp: ...
permissions: [...]

[T2 payload]
sub: ...
iat: ...
exp: ...
permissions: [...]

[/me with T1 — 401]
status: 401
body: { code, message }
passport info: <info.message from handleRequest>

[/me with T2 — 200]
status: 200
body: { ... }

[root cause]
...
```

## 4. 수정 방침

진단으로 확정된 root cause에 한해 **최소 변경**으로 수정한다.

- 진단 단계에서 추가한 임시 디버그 로그·`handleRequest` override는 모두 제거
- 수정 범위가 auth 외 도메인으로 확장되면 별도 spec으로 승격 후 본 spec 종결
- spec 5(폴더 재구조화)의 결정에 의존하는 변경은 본 spec에 포함하지 않는다

## 5. 회귀 방지 테스트

`services/api/test/`에 e2e 케이스를 추가한다. 단위 테스트만으로는 본 버그를 잡을 수 없다(passport-jwt + Guard + Strategy + Module 와이어링 전체가 함께 동작해야 재현됨).

| 케이스 | 시나리오 |
|---|---|
| `login → /auth/me` | 2FA 미설정 사용자 로그인 후 즉시 `/auth/me` 호출이 200을 반환 |
| `register → /auth/me` | 회원가입 직후 받은 accessToken으로 `/auth/me` 200 |
| `login → refresh → /auth/me` | 본 버그의 직접 재현 케이스. 둘 다 200 |

테스트 작성 컨벤션은 `services/api/.claude/rules/testing.md`의 `describe > it` 구조 및 fixture 규칙을 따른다. e2e용 fixture가 없다면 `src/test/fixtures/` 아래에 신규 도메인 fixture 파일을 추가한다.

## 6. 스코프 외

본 spec은 bug 1만 다룬다. 아래 4건은 각각 별도 spec으로 분리한다.

- bug 3 — 신뢰기기로 로그인 시 2FA가 여전히 발생하는지 검증·수정
- 누락 2 — trustToken UX 고도화(첫 2FA 통과 직후 자동 신뢰기기 등록 등) 정책 결정 및 구현
- 누락 4 — backup code 재발급 controller 추가
- 재구조화 5 — `auth/` 분해(`user/`, `role/`, `session/`, `backup-code/` 등)

## 7. 작업 산출물 체크리스트

- [x] 진단 노트(§3.4 형식) — §8 Resolution 참조
- [x] root cause를 반영한 코드 수정 — **불필요** (코드 결함 없음)
- [x] 임시 디버그 로그 제거 확인 — 디버그 로그 삽입 단계 진입 전 종결
- [ ] e2e 회귀 테스트 3건 추가 — **Skip** (버그가 존재하지 않으므로 동일 시나리오 재현형 e2e는 과포장)
- [x] 기존 단위 테스트 통과 — 기존 통과 상태 유지(코드 무변경)
- [x] e2e 테스트 통과 — 기존 통과 상태 유지(코드 무변경)

## 8. Resolution

**결론: 재현 불가 — 환경 이슈로 종결.**

진단 §3.1·§3.2를 실제 환경에서 실행한 결과:

```
[T1 (login 응답) payload]
sub: 8d337f8f-667b-4070-b3b1-1c956e120818
username: owner
permissions: [file:write, user:read, system:monitor, storage:read, file:delete,
              system:config, file:read, share:manage, user:invite, audit:read,
              storage:manage, user:manage, user:role, share:create]
iat: 1779161089
exp: 1779161989   # Δ = 900s = 15분, 정상

[/auth/me with Bearer T1]
HTTP 200
body: { id, username: "owner", nickname: "Owner" }

[추가 검증: /trusted-device, /devices, /trash with Bearer T1]
모두 HTTP 200
```

owner 계정으로는 어느 라우트에서도 401이 발생하지 않았다. 사용자가 직접 재차 검증한 결과 **Postman 측에서 Bearer 토큰이 저장되지 않은 환경적 사고**가 원인으로 확인되었고, API 자체는 정상 동작한다.

### 후속 조치

- 추가 코드 수정 없음
- 회귀 테스트 추가 없음 — 동일 시나리오의 e2e는 "코드 결함 없는 상태"를 재확인할 뿐이라 비용 대비 가치 부족. 만약 향후 인증 e2e 커버리지를 일괄 보강할 필요가 생기면 별도 spec으로 처리

### 메모

systematic-debugging Phase 1("재현 먼저, 가설 다음")이 본 spec의 가치를 입증한 케이스다. 정적 분석으로 후보가 모두 부정되었을 때 추측으로 코드를 건드리지 않고 진단 절차로 넘긴 결과, 존재하지 않는 버그를 "수정"하는 일을 피했다.
