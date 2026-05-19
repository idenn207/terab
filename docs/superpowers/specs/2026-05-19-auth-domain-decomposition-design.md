# auth/ 도메인 분해 — 책임 분리 및 폴더 재구조화

작성일: 2026-05-19
대상: services/api 전체
유형: architecture refactoring

## 1. 배경

현재 `src/auth/`는 빠른 초기 개발을 위해 다음 책임이 모두 뭉쳐 있다.

| 책임 | 위치 |
|---|---|
| 인증 진입점 (register/login/refresh/logout/me/backup-login) | `AuthController` |
| 사용자 도메인 (users 테이블 CRUD·조회) | `AuthRepository.findUser*`, `insertUser` |
| 역할·권한 (roles·user_roles·permissions·role_permissions) | `AuthRepository.findRoleByName`, `insertUserRole` + `rbac.seed.ts` |
| 세션 (refresh_tokens) | `AuthRepository.find/insert/revokeRefreshToken*` |
| Backup Code (backup_codes) | `AuthRepository.find/insert/markBackupCode*` |
| Owner 계정 부트스트랩 | `AuthService.initOwnerAccount` |

반면 도메인 단위로 깔끔히 분리된 것들(2FA·신뢰기기·디바이스·초대)은 별도 모듈로 빠져 있다. 따라서 본 spec은 `auth/`에 뭉친 비-인증 책임을 도메인별로 분해하고, `auth/`는 "인증 진입점 + 토큰 발급/검증"만 남긴다.

## 2. 목표 구조

```
src/
  auth/              # 인증 진입점만 — register/login/refresh/logout/me/backup-login
    auth.controller.ts
    auth.service.ts
    auth.module.ts
    strategies/
    dto/
  user/              # 사용자 도메인 — users 테이블
    user.controller.ts (선택, /users/me 같은 사용자 관리용)
    user.service.ts
    user.repository.ts
    user.module.ts
  role/              # 역할·권한 도메인 — roles·user_roles·permissions·role_permissions
    role.service.ts
    role.repository.ts
    role.module.ts
  session/           # refresh_token 세션 도메인
    session.service.ts
    session.repository.ts
    session.module.ts
  backup-code/       # backup_codes 도메인
    backup-code.service.ts
    backup-code.repository.ts
    backup-code.module.ts
  twofa/             # 기존 그대로
  trusted-device/    # 기존 그대로
  device/            # 기존 그대로
  invitation/        # 기존 그대로
  security/          # 기존 그대로 — TokenService
```

### 책임 분배

| 도메인 | 책임 | 노출 service 메서드 (예시) |
|---|---|---|
| `auth` | login/register/refresh/logout 흐름 오케스트레이션, 패스워드 검증, owner bootstrap | `login`, `register`, `refresh`, `logout`, `completeTwoFa`, `loginWithBackupCode`, `getCurrentUser` |
| `user` | users 테이블 CRUD·조회 | `findById`, `findByUsername`, `create`, `existsByUsername` |
| `role` | role·permission CRUD, user의 권한 집계 | `findByName`, `assignUserRole`, `getPermissionsByUserId` |
| `session` | refresh token 발급·회전·폐기 | `issueRefreshToken`, `rotateRefreshToken`, `revokeByHash`, `revokeAllByUserId` |
| `backup-code` | 백업 코드 발급·소비·재발급 | `generateForUser`, `consume`, `regenerateForUser` |

### `AuthService` 의존 구조

```
AuthService
 ├─ UserService            (사용자 조회·생성)
 ├─ RoleService            (역할 부여·권한 집계)
 ├─ SessionService         (refresh token 발급·회전·폐기)
 ├─ BackupCodeService      (register 시 발급, login 시 소비)
 ├─ TwoFaService           (기존)
 ├─ TrustedDeviceService   (기존)
 ├─ DeviceService          (기존)
 ├─ InvitationService      (기존)
 └─ TokenService           (기존, access token 발급)
```

`AuthService`는 더 이상 DB에 직접 접근하지 않는다. `AuthRepository`는 제거된다.

## 3. 마이그레이션 단계 (Phase별)

본 작업은 한 번에 처리하기엔 영향 범위가 너무 넓다. 다음과 같이 Phase별 PR로 쪼갠다. **각 Phase는 독립적으로 머지 가능해야** 하며, 각 Phase 종료 시점에 모든 테스트가 통과해야 한다.

### Phase A — `session/` 분리

- `session/session.module.ts`, `session.service.ts`, `session.repository.ts` 신설
- `AuthRepository`의 refresh_token 관련 메서드 → `SessionRepository`로 이동
- `AuthService`에 `SessionService`를 inject, refresh token 관련 호출을 위임
- 회귀: refresh 흐름 e2e 통과

### Phase B — `backup-code/` 분리

- `backup-code/backup-code.module.ts` 등 신설
- `AuthRepository`의 backup_code 관련 메서드 → `BackupCodeRepository`로 이동
- `AuthService.generateBackupCodes`, `verifyAndConsumeBackupCode` → `BackupCodeService`로 이동
- register/login-with-backup 시 `BackupCodeService` 호출
- **본 Phase는 누락 4(backup code regenerate spec)와 자연스럽게 합쳐질 수 있음** — regenerate 구현 시 BackupCodeService에서 바로 노출
- 회귀: register / login-with-backup e2e 통과

### Phase C — `user/` + `role/` 분리

- `user/`, `role/` 모듈 신설
- `AuthRepository.findUser*`, `insertUser`, `aggregateUser` → `UserRepository` + `RoleRepository`로 분해
  - 권한 집계는 `RoleService.getPermissionsByUserId(userId)`로 노출
  - 사용자 본문 + 권한을 합친 `UserWithPermissions` 합성은 `AuthService` 내부에서 두 service 호출로 조립
- `AuthService.initOwnerAccount` → `UserService.ensureOwner(...)`로 이동
- 회귀: register / login / me e2e 통과

### Phase D — `auth/` 정리 + `AuthRepository` 제거

- A·B·C 종료 후 `AuthRepository`는 빈 상태. 파일·module provider 제거
- `auth.module.ts`의 imports는 `UserModule`, `RoleModule`, `SessionModule`, `BackupCodeModule`, `TwoFaModule`, `TrustedDeviceModule`, `DeviceModule`, `InvitationModule`, `SecurityModule`로 단순화
- `AuthService`는 위 service들의 오케스트레이션만 수행
- 회귀: 전체 auth 흐름 e2e 통과

### Phase E — path alias 정리 (선택)

각 도메인에 path alias가 필요한지(향후 모놀리식 분리 여지) 검토. 도입 시 `@terab/user`, `@terab/role`, `@terab/session`, `@terab/backup-code`. `services/api/CLAUDE.md`의 path alias 정책에 맞춰 결정.

## 4. 위험·완화

| 위험 | 완화 |
|---|---|
| Phase 도중 cross-service tx 깨짐 | `ServiceCore.runInTx()`가 nested 호출에서 동일 tx 참여하도록 이미 설계됨 — `register` 같은 다단 호출은 `AuthService`에서 `runInTx()`로 감싼다 |
| AuthRepository에 묶여있던 owner bootstrap의 `OnModuleInit` 순서 | `UserService.onModuleInit`에 owner bootstrap을 이동, `RoleService` import 후 호출. Module load 순서는 NestJS DI 컨테이너가 보장 |
| 테스트 fixture 위치 변경 | `src/test/fixtures/`에 도메인별 fixture (`user.fixtures.ts`, `role.fixtures.ts`)를 추가하고 기존 `auth.fixtures.ts`는 인증 흐름 전용으로 축소 |
| 다른 도메인(file·folder·trash 등)이 `AuthRepository` 참조 | grep 확인 결과 외부 참조 없음. 내부에서만 사용 |
| Phase별 PR 생성 부담 | 각 Phase는 독립 머지 가능. 단일 PR로 묶지 않음 |

## 5. 비-목표 (Out of Scope)

- 도메인 분해와 무관한 비즈니스 로직 변경
- ErrorCode 키 rename (위치 이동 시에도 키 자체는 보존)
- DB schema 변경 — 본 spec은 **레이어 분해만**. schema는 그대로
- web 측 변경 — 본 spec은 server-only
- Permission 모델 자체 개편(예: 정책 기반 권한) — 별도 spec

## 6. 종속

- 누락 4 (backup code regenerate) — Phase B에 합치는 것이 효율적. 별도로 먼저 진행할 수도 있으나, 그 경우 Phase B에서 위치 이동까지 같이 처리
- 누락 2 (trustToken UX) — 영향 없음. trusted-device 도메인은 그대로
- bug 3 (trust verify 검증) — 영향 없음

## 7. 성공 기준

| 기준 | 측정 |
|---|---|
| `AuthRepository` 파일 부재 | `grep -r "AuthRepository" services/api/src` 결과 0건 |
| 각 신규 모듈이 단독 단위 테스트 통과 | `npm test --prefix services/api` |
| 전체 e2e 통과 | `npm run test:e2e --prefix services/api` |
| 모듈 간 순환 의존 없음 | NestJS DI 컨테이너 부팅 성공 |

## 8. 작업 산출물 체크리스트 (Phase별)

Phase A — session:
- [ ] `session/` 모듈 신설
- [ ] refresh_token 메서드 이동
- [ ] AuthService refresh 흐름 위임
- [ ] e2e 통과

Phase B — backup-code:
- [ ] `backup-code/` 모듈 신설
- [ ] backup_code 메서드 이동
- [ ] (선택) 누락 4 regenerate endpoint 함께 노출
- [ ] e2e 통과

Phase C — user + role:
- [ ] `user/`, `role/` 모듈 신설
- [ ] users/roles/permissions/user_roles/role_permissions 메서드 이동
- [ ] `initOwnerAccount`를 `UserService.ensureOwner`로 이동
- [ ] e2e 통과

Phase D — auth 정리:
- [ ] `AuthRepository` 제거
- [ ] `AuthModule` imports 정리
- [ ] e2e 통과

Phase E — path alias (선택):
- [ ] `@terab/user`, `@terab/role`, `@terab/session`, `@terab/backup-code` alias 추가
- [ ] import 일괄 갱신
