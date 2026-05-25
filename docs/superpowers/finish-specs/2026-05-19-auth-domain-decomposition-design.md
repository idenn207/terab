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

### Phase 0 — Owner 부트스트랩을 database/seed로 이동

기존 `AuthService.onModuleInit → initOwnerAccount()` 흐름을 **database seed 단계로 이전**한다. seed 구성은 `seedRbac` 순수 함수 패턴 대신 **@Injectable Seeder 클래스 패턴**으로 통일한다.

**산출물**

- `database/seed/rbac.seeder.ts` — `@Injectable RbacSeeder` 클래스, `seed(db: NodePgDatabase<typeof schema>): Promise<void>` 메서드. **생성자 주입 없음** (순환 의존 회피)
- `database/seed/owner.seeder.ts` — `@Injectable OwnerSeeder` 신설
  - 생성자 주입: `ConfigService`, `TokenService` (모두 @Global)
  - 메서드 시그니처: `seed(db: NodePgDatabase<typeof schema>): Promise<void>`
  - 동작: `OWNER_PASSWORD` 부재 시 noop / `OWNER_USERNAME`(default `owner`) 기준 존재 검사 / `tokenService.pepperPassword()` + `bcrypt.hash()` 후 users + user_roles insert / UNIQUE 충돌(`23505`) 무시
- `database/seed/index.ts` — `RbacSeeder`, `OwnerSeeder` re-export
- `database/database.module.ts` — `providers`에 `RbacSeeder`, `OwnerSeeder` 직접 추가 (`SeedModule` 미신설)
- `database/database.service.ts` — 생성자에 `RbacSeeder`, `OwnerSeeder` 주입, `seed()` 메서드에서 `seeder.seed(this.db)` 순차 호출 (`RbacSeeder` → `OwnerSeeder` 순서 보장: owner role이 먼저 존재해야 함)
- `auth.service.ts` — `OnModuleInit` 구현체 + `onModuleInit()` + `initOwnerAccount()` 메서드 제거
- 관련 e2e fixture 정리 (`OWNER_PASSWORD` 환경변수가 인증 흐름 e2e에 영향 주지 않도록 검증)

> **순환 의존 회피 설계 결정**: Seeder가 `DatabaseService`를 생성자 주입하면 `DatabaseService` → `Seeder` → `DatabaseService` 순환이 발생해 NestJS DI 컨테이너가 부트스트랩을 거부한다. 따라서 Seeder는 stateless `@Injectable`로 두고 `db` 핸들을 메서드 파라미터로 받는다. `ConfigService`/`TokenService`는 db에 의존하지 않으므로 안전하게 생성자 주입.

**회귀**

- DB 신규 부팅 시 owner 계정 생성 확인
- 기존 owner가 존재할 때 중복 생성·예외 없이 종료 확인
- 동시 기동 시 UNIQUE 충돌 무시 동작 확인 (기존 로직 보존)

**의도**

- 책임 분리: AuthService는 부트스트랩 책임에서 해방 → Phase C에서 `UserService` 신설 시 owner 책임이 다시 떠오를 일 없음
- seed가 RBAC + Owner를 함께 보장 → 신규 환경 부팅 시 데이터 일관성 강화
- seeder 패턴 통일 (`@Injectable` 클래스) → 추후 다른 seed(예: 기본 폴더, 기본 권한 그룹) 추가 시 동일 패턴 재사용

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
- **Phase 0에서 owner 부트스트랩이 이미 seed로 이전됨** — Phase C에서는 owner 관련 로직 이전 불필요
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
| Phase 0 seed 실행 시점이 module init 시점과 다름 | `DatabaseService.onModuleInit` → `migrate()` → `RbacSeeder.seed()` → `OwnerSeeder.seed()` 순서로 직렬 실행. OWNER role 존재가 보장된 뒤 owner 생성하므로 안전 |
| 기존 `initOwnerAccount`의 UNIQUE(23505) swallow 동작 누락 | `OwnerSeeder.seed()`에서도 동일하게 catch + 23505 swallow 유지 (동시 기동 보호) |
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

Phase 0 — owner seed 이전:
- [x] `RbacSeeder` @Injectable 클래스로 리팩토링 (`seedRbac` 함수 제거)
- [x] `OwnerSeeder` @Injectable 클래스 신설 (ConfigService + TokenService 주입)
- [x] `DatabaseModule.providers`에 두 Seeder 등록
- [x] `DatabaseService.seed()`에서 `seeder.seed(this.db)` 순차 호출
- [x] `AuthService`에서 `OnModuleInit` / `initOwnerAccount` 제거
- [x] 신규 DB 부팅 + 재부팅 + 동시 기동 회귀 통과

Phase A — session:
- [x] `session/` 모듈 신설
- [x] refresh_token 메서드 이동
- [x] AuthService refresh 흐름 위임
- [x] e2e 통과

Phase B — backup-code:
- [x] `backup-code/` 모듈 신설
- [x] backup_code 메서드 이동
- [x] (선택) 누락 4 regenerate endpoint 함께 노출
- [x] e2e 통과

Phase C — user + role:
- [x] `user/`, `role/` 모듈 신설
- [x] users/roles/permissions/user_roles/role_permissions 메서드 이동
- [x] ~~`initOwnerAccount`를 `UserService.ensureOwner`로 이동~~ — Phase 0에서 이미 OwnerSeeder로 이전됨
- [x] e2e 통과

Phase D — auth 정리:
- [x] `AuthRepository` 제거
- [x] `AuthModule` imports 정리
- [x] e2e 통과

Phase E — path alias (선택):
- [ ] `@terab/user`, `@terab/role`, `@terab/session`, `@terab/backup-code` alias 추가
- [ ] import 일괄 갱신

> **Phase E는 본 종결에서 제외** — ts-rest 제거 작업이 path alias 정책에 영향 줄 수 있어 별도 spec에서 일괄 검토.

## 9. Resolution (2026-05-19 종결)

본 spec의 Phase 0~D 산출물 모두 처리 완료. Phase E는 의도적 보류.

**구현 요약**
- 신규 모듈 5개: `user/`, `role/`, `session/`, `backup-code/` (+ `database/seed/` 내 `RbacSeeder`/`OwnerSeeder`)
- AuthRepository 완전 제거 — `grep -r "AuthRepository" services/api/src` 0건
- `UserWithPermissions` 타입은 `auth/types/user-with-permissions.type.ts`로 이전, AuthService private 메서드로 합성 (UserService + RoleService 2 query)
- AuthService 책임 축소 — 오케스트레이션 facade로 전환, `OnModuleInit`/owner 부트스트랩/DB 직접 접근 모두 제거

**Phase 0 (spec 외 작업)**
- `AuthService.initOwnerAccount` → `@Injectable OwnerSeeder.seed(db)`로 이전, `DatabaseService.onModuleInit`에서 `RbacSeeder` → `OwnerSeeder` 순차 호출
- 기존 `seedRbac` 순수 함수도 `RbacSeeder` 클래스로 통일 (DI 패턴 일관성)
- 순환 의존 회피: Seeder 생성자는 `ConfigService`/`TokenService`만 주입, `db`는 메서드 파라미터로 전달

**부수 효과 (잠재 버그 발견·수정)**
- Phase A 중 `refresh` 흐름에서 `sessionService.rotate()` 도입 후에도 `issueTokenPair`가 또 토큰을 발급해 한 refresh당 refresh token이 2개 생성되는 잠재 버그 제거 — rotate 결과를 그대로 사용하도록 정정

**테스트 결과**
- 단위 테스트: 57 suites / 357 tests (이전 334 → +23, 신규 모듈 spec 추가분)
- e2e: 10/10 통과
- 타입 체크: 깨끗 (기존 `metadata.ts`/`file.service.spec.ts` 이슈는 본 작업과 무관)

**커밋 이력**
- f30804b — `docs(superpowers): auth 도메인 분해 spec — Phase 0 owner seed 추가 + seeder 패턴 통일`
- 40c1bb3 — `refactor(api): auth 도메인 분해 — session/backup-code/user/role 분리`

**잔여·후속 작업**
- Phase E (path alias) — ts-rest 제거 마이그레이션과 충돌 가능성으로 보류, 별도 spec에서 다룰 것
- e2e fixture 도메인별 분리(`user.fixtures.ts`, `role.fixtures.ts`) — 현재 `auth.fixtures.ts`로 충분히 동작, 신규 fixture 필요 시점에 처리
