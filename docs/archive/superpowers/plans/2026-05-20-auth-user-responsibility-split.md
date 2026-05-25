# Auth/User 책임 분리 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/auth/`의 과적된 책임을 분리한다 — AuthService를 자격증명·토큰·쿠키 primitive로 재정의하고, controller-facing 흐름(register/login/refresh/logout/me)을 UserController로 이관한다.

**Architecture:** AuthService(controller 없음, role/session sub-module 흡수, res 객체로 cookie 일괄 관리) ← UserService(흐름 entry point + 사용자 lifecycle) ← UserController(root 경로). TwoFa는 `getStatus`에서 userId만 반환하여 leaf로 정렬, backup-code regenerate 엔드포인트는 twofa 모듈로 흡수.

**Tech Stack:** NestJS 11, Drizzle ORM, Jest, class-validator, @terab/security (TokenService), @terab/db (ServiceCore/RepositoryCore), bcryptjs, express Response

**Reference:** [Design Doc](../specs/2026-05-20-auth-user-responsibility-split-design.md)

---

## Phase 1 — role/session 모듈을 src/auth/ 하위로 이동

### Task 1.1: src/role/ → src/auth/role/ 이동

**Files:**
- Move: `services/api/src/role/role.module.ts` → `services/api/src/auth/role/role.module.ts`
- Move: `services/api/src/role/role.service.ts` → `services/api/src/auth/role/role.service.ts`
- Move: `services/api/src/role/role.service.spec.ts` → `services/api/src/auth/role/role.service.spec.ts`
- Move: `services/api/src/role/role.repository.ts` → `services/api/src/auth/role/role.repository.ts`
- Move: `services/api/src/role/role.repository.spec.ts` → `services/api/src/auth/role/role.repository.spec.ts`
- Modify: `services/api/src/auth/auth.module.ts`
- Modify: `services/api/src/auth/auth.service.ts`
- Modify: `services/api/src/app.module.ts`

- [ ] **Step 1: 파일 이동 (5개)**

```bash
mkdir -p services/api/src/auth/role
git mv services/api/src/role/role.module.ts services/api/src/auth/role/role.module.ts
git mv services/api/src/role/role.service.ts services/api/src/auth/role/role.service.ts
git mv services/api/src/role/role.service.spec.ts services/api/src/auth/role/role.service.spec.ts
git mv services/api/src/role/role.repository.ts services/api/src/auth/role/role.repository.ts
git mv services/api/src/role/role.repository.spec.ts services/api/src/auth/role/role.repository.spec.ts
rmdir services/api/src/role
```

- [ ] **Step 2: `services/api/src/auth/auth.module.ts`의 RoleModule import 경로 변경**

```ts
// 변경 전
import { RoleModule } from '../role/role.module';
// 변경 후
import { RoleModule } from './role/role.module';
```

- [ ] **Step 3: `services/api/src/auth/auth.service.ts`의 RoleService import 경로 변경**

```ts
// 변경 전
import { RoleService } from '../role/role.service';
// 변경 후
import { RoleService } from './role/role.service';
```

- [ ] **Step 4: `services/api/src/app.module.ts`에서 RoleModule 등록 제거**

```ts
// 제거할 import
import { RoleModule } from './role/role.module';

// imports 배열에서 RoleModule 제거 (AuthModule이 흡수)
```

- [ ] **Step 5: 빌드 + 테스트**

```bash
cd services/api && npm run build && npm test -- --testPathPattern="role|auth"
```

Expected: 빌드 성공, role/auth 관련 테스트 모두 PASS

- [ ] **Step 6: Commit**

```bash
git add services/api/src/auth/role services/api/src/auth/auth.module.ts services/api/src/auth/auth.service.ts services/api/src/app.module.ts
git commit -m "refactor(api): RoleModule을 src/auth/role/ 하위로 이동"
```

---

### Task 1.2: src/session/ → src/auth/session/ 이동

**Files:**
- Move: `services/api/src/session/session.module.ts` → `services/api/src/auth/session/session.module.ts`
- Move: `services/api/src/session/session.service.ts` → `services/api/src/auth/session/session.service.ts`
- Move: `services/api/src/session/session.service.spec.ts` → `services/api/src/auth/session/session.service.spec.ts`
- Move: `services/api/src/session/session.repository.ts` → `services/api/src/auth/session/session.repository.ts`
- Move: `services/api/src/session/session.repository.spec.ts` → `services/api/src/auth/session/session.repository.spec.ts`
- Modify: `services/api/src/auth/auth.module.ts`
- Modify: `services/api/src/auth/auth.service.ts`
- Modify: `services/api/src/app.module.ts`

- [ ] **Step 1: 파일 이동**

```bash
mkdir -p services/api/src/auth/session
git mv services/api/src/session/session.module.ts services/api/src/auth/session/session.module.ts
git mv services/api/src/session/session.service.ts services/api/src/auth/session/session.service.ts
git mv services/api/src/session/session.service.spec.ts services/api/src/auth/session/session.service.spec.ts
git mv services/api/src/session/session.repository.ts services/api/src/auth/session/session.repository.ts
git mv services/api/src/session/session.repository.spec.ts services/api/src/auth/session/session.repository.spec.ts
rmdir services/api/src/session
```

- [ ] **Step 2: `services/api/src/auth/auth.module.ts`의 SessionModule import 경로 변경**

```ts
// 변경 전
import { SessionModule } from '../session/session.module';
// 변경 후
import { SessionModule } from './session/session.module';
```

- [ ] **Step 3: `services/api/src/auth/auth.service.ts`의 SessionService import 경로 변경**

```ts
// 변경 전
import { SessionService } from '../session/session.service';
// 변경 후
import { SessionService } from './session/session.service';
```

- [ ] **Step 4: `services/api/src/app.module.ts`에서 SessionModule 등록 제거**

```ts
// 제거할 import
import { SessionModule } from './session/session.module';

// imports 배열에서 SessionModule 제거
```

- [ ] **Step 5: 빌드 + 테스트**

```bash
cd services/api && npm run build && npm test
```

Expected: 전체 테스트 PASS, 빌드 성공.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/auth/session services/api/src/auth/auth.module.ts services/api/src/auth/auth.service.ts services/api/src/app.module.ts
git commit -m "refactor(api): SessionModule을 src/auth/session/ 하위로 이동"
```

---

### Task 1.3: AuthModule re-export 설정

> 향후 외부 모듈이 RoleService를 직접 사용할 수 있도록 길을 열어둔다.

**Files:**
- Modify: `services/api/src/auth/auth.module.ts`

- [ ] **Step 1: `services/api/src/auth/auth.module.ts`의 exports에 sub-module re-export 추가**

```ts
@Module({
  imports: [
    PassportModule,
    BullModule.registerQueue({ name: PUSH_CHALLENGE_QUEUE }),
    DeviceModule,
    TwoFaModule,
    TrustedDeviceModule,
    InvitationModule,
    UserModule,
    RoleModule,        // 이미 import 됨
    SessionModule,     // 이미 import 됨
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [RoleModule, SessionModule],  // 신규 — AuthService 추가는 phase 7
})
export class AuthModule {}
```

- [ ] **Step 2: 빌드 + 테스트**

```bash
cd services/api && npm run build && npm test
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add services/api/src/auth/auth.module.ts
git commit -m "refactor(api): AuthModule이 RoleModule/SessionModule을 re-export"
```

---

## Phase 2 — 새 AuthService API 구현

> 옛 AuthService를 점진적으로 대체한다. 신규 메서드를 추가하고 spec을 새로 쓰되, 옛 메서드는 Phase 7에서 제거한다.

### Task 2.1: AuthService.hashPassword 메서드 추가

**Files:**
- Modify: `services/api/src/auth/auth.service.ts`
- Modify: `services/api/src/auth/auth.service.spec.ts`

- [ ] **Step 1: spec에 신규 describe + 실패 케이스 작성**

`services/api/src/auth/auth.service.spec.ts`에 아래 describe 추가:

```ts
describe('hashPassword', () => {
  it('peppered password를 bcrypt 해시로 반환한다', async () => {
    mockTokenService.pepperPassword.mockReturnValue('peppered');

    const result = await service.hashPassword('rawPw123');

    expect(mockTokenService.pepperPassword).toHaveBeenCalledWith('rawPw123');
    expect(result).toMatch(/^\$2[aby]\$/); // bcrypt prefix
  });
});
```

- [ ] **Step 2: 테스트 실행, 실패 확인**

```bash
cd services/api && npm test -- auth.service.spec.ts -t "hashPassword"
```

Expected: FAIL (`service.hashPassword is not a function`)

- [ ] **Step 3: `services/api/src/auth/auth.service.ts`에 메서드 추가**

```ts
async hashPassword(raw: string): Promise<string> {
  const peppered = this.tokenService.pepperPassword(raw);
  return bcrypt.hash(peppered, this.BCRYPT_ROUNDS);
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd services/api && npm test -- auth.service.spec.ts -t "hashPassword"
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/api/src/auth/auth.service.ts services/api/src/auth/auth.service.spec.ts
git commit -m "feat(api): AuthService.hashPassword 추가"
```

---

### Task 2.2: AuthService.validateCredentials 메서드 추가 (신규 시그니처)

**Files:**
- Modify: `services/api/src/auth/auth.service.ts`
- Modify: `services/api/src/auth/auth.service.spec.ts`

> 옛 `private validateCredentials(user: UserWithPermissions, raw)`와 충돌하지 않도록 새 메서드는 임시로 `validateUserCredentials`라는 이름으로 만들지 않고, **옛 메서드를 직접 public화**하면서 인자 타입을 좁힌다. 옛 메서드 호출처(register/login/loginWithBackupCode/regenerateBackupCodes)는 `UserWithPermissions`를 넘기지만 `password|active`만 사용하므로 호환됨.

- [ ] **Step 1: spec에 신규 describe 작성**

`services/api/src/auth/auth.service.spec.ts`에 추가:

```ts
describe('validateCredentials', () => {
  it('비밀번호가 일치하지 않으면 INVALID_CREDENTIALS 예외를 던진다', async () => {
    mockTokenService.pepperPassword.mockReturnValue('peppered');
    const user = { password: await bcrypt.hash('peppered-other', 10), active: true };

    await expect(service.validateCredentials(user, 'wrong')).rejects.toMatchObject({
      errorCode: 'INVALID_CREDENTIALS',
    });
  });

  it('비활성 사용자면 ACCOUNT_DISABLED 예외를 던진다', async () => {
    mockTokenService.pepperPassword.mockReturnValue('peppered');
    const user = { password: await bcrypt.hash('peppered', 10), active: false };

    await expect(service.validateCredentials(user, 'pw')).rejects.toMatchObject({
      errorCode: 'ACCOUNT_DISABLED',
    });
  });

  it('정상 자격증명이면 예외 없이 반환한다', async () => {
    mockTokenService.pepperPassword.mockReturnValue('peppered');
    const user = { password: await bcrypt.hash('peppered', 10), active: true };

    await expect(service.validateCredentials(user, 'pw')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd services/api && npm test -- auth.service.spec.ts -t "validateCredentials"
```

Expected: FAIL (`validateCredentials` is private)

- [ ] **Step 3: `services/api/src/auth/auth.service.ts`에서 private → public 전환 + 인자 타입 축소**

```ts
// 변경 전
private async validateCredentials(user: UserWithPermissions, rawPassword: string): Promise<void> {

// 변경 후
async validateCredentials(
  user: Pick<Users$Select, 'password' | 'active'>,
  rawPassword: string,
): Promise<void> {
  const pepperedPassword = this.tokenService.pepperPassword(rawPassword);
  const valid = await bcrypt.compare(pepperedPassword, user.password);
  if (!valid) throw new ApiException('INVALID_CREDENTIALS');
  if (!user.active) throw new ApiException('ACCOUNT_DISABLED');
}
```

`Users$Select` import 추가:
```ts
import type { Users$Select } from '@terab/db';
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd services/api && npm test -- auth.service.spec.ts
```

Expected: PASS (기존 테스트도 영향 없음 — UserWithPermissions는 password/active를 포함)

- [ ] **Step 5: Commit**

```bash
git add services/api/src/auth/auth.service.ts services/api/src/auth/auth.service.spec.ts
git commit -m "refactor(api): AuthService.validateCredentials를 public + Users\$Select 인자로 좁힘"
```

---

### Task 2.3: AuthService.assignDefaultRole 메서드 추가

**Files:**
- Modify: `services/api/src/auth/auth.service.ts`
- Modify: `services/api/src/auth/auth.service.spec.ts`

- [ ] **Step 1: spec 작성**

```ts
describe('assignDefaultRole', () => {
  it('USER 역할이 없으면 ROLE_NOT_FOUND 예외를 던진다', async () => {
    mockRoleService.findByName.mockResolvedValue(null);

    await expect(service.assignDefaultRole('user-1')).rejects.toMatchObject({
      errorCode: 'ROLE_NOT_FOUND',
    });
  });

  it('USER 역할을 사용자에게 할당한다', async () => {
    mockRoleService.findByName.mockResolvedValue({ id: 'role-1' });
    mockRoleService.assignUserRole.mockResolvedValue(undefined);

    await service.assignDefaultRole('user-1');

    expect(mockRoleService.findByName).toHaveBeenCalledWith('USER');
    expect(mockRoleService.assignUserRole).toHaveBeenCalledWith('user-1', 'role-1');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd services/api && npm test -- auth.service.spec.ts -t "assignDefaultRole"
```

Expected: FAIL

- [ ] **Step 3: 메서드 구현**

```ts
async assignDefaultRole(userId: string): Promise<void> {
  const role = await this.roleService.findByName('USER');
  if (!role) throw new ApiException('ROLE_NOT_FOUND');
  await this.roleService.assignUserRole(userId, role.id);
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd services/api && npm test -- auth.service.spec.ts -t "assignDefaultRole"
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/api/src/auth/auth.service.ts services/api/src/auth/auth.service.spec.ts
git commit -m "feat(api): AuthService.assignDefaultRole 추가"
```

---

### Task 2.4: AuthService.generateAccessToken 신규 시그니처

**Files:**
- Modify: `services/api/src/auth/auth.service.ts`
- Modify: `services/api/src/auth/auth.service.spec.ts`

> 옛 코드는 `tokenService.generateAccessToken(id, username, permissions)`을 인라인 호출했다. 신규 메서드는 `Users$Select`만 받고 내부에서 permissions 조회 후 토큰 사인.

- [ ] **Step 1: spec 작성**

```ts
describe('generateAccessToken', () => {
  it('user에 대한 permissions를 조회하여 access token을 발급한다', async () => {
    const user = { id: 'u1', username: 'alice', nickname: 'A', password: 'x', active: true } as any;
    mockRoleService.getPermissionsByUserId.mockResolvedValue(['file:read']);
    mockTokenService.generateAccessToken.mockReturnValue('JWT');

    const token = await service.generateAccessToken(user);

    expect(mockRoleService.getPermissionsByUserId).toHaveBeenCalledWith('u1');
    expect(mockTokenService.generateAccessToken).toHaveBeenCalledWith('u1', 'alice', ['file:read']);
    expect(token).toBe('JWT');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd services/api && npm test -- auth.service.spec.ts -t "generateAccessToken"
```

Expected: FAIL

- [ ] **Step 3: 메서드 구현**

```ts
async generateAccessToken(user: Users$Select): Promise<string> {
  const permissions = await this.roleService.getPermissionsByUserId(user.id);
  return this.tokenService.generateAccessToken(user.id, user.username, permissions);
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd services/api && npm test -- auth.service.spec.ts -t "generateAccessToken"
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/api/src/auth/auth.service.ts services/api/src/auth/auth.service.spec.ts
git commit -m "feat(api): AuthService.generateAccessToken — Users\$Select 인자로 권한 자동 조회"
```

---

### Task 2.5: AuthService cookie 헬퍼 (setRefresh/clearRefresh/setTrust/clearTrust)

**Files:**
- Modify: `services/api/src/auth/auth.service.ts`
- Modify: `services/api/src/auth/auth.service.spec.ts`

- [ ] **Step 1: spec 작성**

```ts
describe('cookie helpers', () => {
  let res: { cookie: jest.Mock; clearCookie: jest.Mock };

  beforeEach(() => {
    res = { cookie: jest.fn(), clearCookie: jest.fn() };
  });

  it('setTrustCookie는 trustToken 쿠키를 설정한다', () => {
    service.setTrustCookie(res as any, 'raw-tt', 30 * 24 * 60 * 60 * 1000);

    expect(res.cookie).toHaveBeenCalledWith('trustToken', 'raw-tt', expect.objectContaining({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    }));
  });

  it('clearTrustCookie는 trustToken 쿠키를 제거한다', () => {
    service.clearTrustCookie(res as any);

    expect(res.clearCookie).toHaveBeenCalledWith('trustToken', expect.objectContaining({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
    }));
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd services/api && npm test -- auth.service.spec.ts -t "cookie helpers"
```

Expected: FAIL

- [ ] **Step 3: 메서드 구현**

`services/api/src/auth/auth.service.ts`에 클래스 상수 + 메서드 추가:

```ts
import type { Response } from 'express';

// 클래스 상수 추가
private readonly REFRESH_TOKEN_COOKIE = 'refreshToken';
private readonly TRUST_TOKEN_COOKIE = 'trustToken';
private readonly COOKIE_PATH = '/';

// 메서드 추가
setTrustCookie(res: Response, rawToken: string, maxAgeMs: number): void {
  res.cookie(this.TRUST_TOKEN_COOKIE, rawToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: maxAgeMs,
    path: this.COOKIE_PATH,
  });
}

clearTrustCookie(res: Response): void {
  res.clearCookie(this.TRUST_TOKEN_COOKIE, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: this.COOKIE_PATH,
  });
}

private setRefreshCookie(res: Response, rawToken: string, maxAgeMs: number): void {
  res.cookie(this.REFRESH_TOKEN_COOKIE, rawToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: maxAgeMs,
    path: this.COOKIE_PATH,
  });
}

private clearRefreshCookie(res: Response): void {
  res.clearCookie(this.REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: this.COOKIE_PATH,
  });
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd services/api && npm test -- auth.service.spec.ts -t "cookie helpers"
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/api/src/auth/auth.service.ts services/api/src/auth/auth.service.spec.ts
git commit -m "feat(api): AuthService cookie 헬퍼 (setTrust/clearTrust/setRefresh/clearRefresh)"
```

---

### Task 2.6: AuthService.issueTokenPair 신규 시그니처 (res 인자 + cookie write)

**Files:**
- Modify: `services/api/src/auth/auth.service.ts`
- Modify: `services/api/src/auth/auth.service.spec.ts`

> 옛 `private issueTokenPair(user: UserWithPermissions): Promise<AuthTokens>`를 대체. 새 시그니처는 `(user: Users$Select, res: Response)`를 받고 RT 쿠키까지 setRefreshCookie로 처리.

- [ ] **Step 1: spec 작성**

```ts
describe('issueTokenPair', () => {
  it('accessToken을 발급하고 refresh token을 쿠키로 설정한다', async () => {
    const user = { id: 'u1', username: 'alice', nickname: 'A', password: 'x', active: true } as any;
    const res = { cookie: jest.fn() } as any;
    mockRoleService.getPermissionsByUserId.mockResolvedValue(['file:read']);
    mockTokenService.generateAccessToken.mockReturnValue('JWT');
    mockSessionService.issueForUser.mockResolvedValue({
      rawRefreshToken: 'raw-rt',
      refreshTokenExpMs: 7 * 24 * 60 * 60 * 1000,
    });

    const result = await service.issueTokenPair(user, res);

    expect(result.accessToken).toBe('JWT');
    expect(mockSessionService.issueForUser).toHaveBeenCalledWith('u1');
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'raw-rt', expect.objectContaining({
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    }));
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd services/api && npm test -- auth.service.spec.ts -t "issueTokenPair"
```

Expected: FAIL (private method signature mismatch)

- [ ] **Step 3: 옛 private 메서드를 public 신규 시그니처로 교체**

`services/api/src/auth/auth.service.ts`:

```ts
// 변경 전
private async issueTokenPair(user: UserWithPermissions): Promise<AuthTokens> {
  const accessToken = this.tokenService.generateAccessToken(user.id, user.username, user.permissions);
  const { rawRefreshToken, refreshTokenExpMs } = await this.sessionService.issueForUser(user.id);
  return { accessToken, rawRefreshToken, refreshTokenExpMs };
}

// 변경 후
async issueTokenPair(user: Users$Select, res: Response): Promise<{ accessToken: string }> {
  const accessToken = await this.generateAccessToken(user);
  const { rawRefreshToken, refreshTokenExpMs } = await this.sessionService.issueForUser(user.id);
  this.setRefreshCookie(res, rawRefreshToken, refreshTokenExpMs);
  return { accessToken };
}
```

- [ ] **Step 4: 옛 호출처(register/login/loginWithBackupCode/completeTwoFa) 임시 대응**

옛 메서드 내부에서 `issueTokenPair`를 호출하던 부분은 Phase 7에서 메서드 자체를 삭제할 예정. 일단 임시로 _옛 내부 헬퍼_를 인라인화하여 옛 메서드들이 새 시그니처와 충돌하지 않도록 한다:

`services/api/src/auth/auth.service.ts` — register/login/loginWithBackupCode/completeTwoFa 내부의 `await this.issueTokenPair(user)` 호출을 아래로 치환:

```ts
// 변경 전
const tokens = await this.issueTokenPair(userWithPermissions);

// 변경 후 (임시 인라인)
const accessToken = this.tokenService.generateAccessToken(userWithPermissions.id, userWithPermissions.username, userWithPermissions.permissions);
const { rawRefreshToken, refreshTokenExpMs } = await this.sessionService.issueForUser(userWithPermissions.id);
const tokens = { accessToken, rawRefreshToken, refreshTokenExpMs };
```

(register/login/loginWithBackupCode/completeTwoFa 4곳 모두 동일 패턴으로 치환)

- [ ] **Step 5: 테스트 + 빌드 통과 확인**

```bash
cd services/api && npm run build && npm test
```

Expected: PASS (모든 옛 흐름이 인라인된 토큰 발급 로직으로 동작)

- [ ] **Step 6: Commit**

```bash
git add services/api/src/auth/auth.service.ts services/api/src/auth/auth.service.spec.ts
git commit -m "refactor(api): AuthService.issueTokenPair 신규 시그니처 (res + cookie 일괄 처리)"
```

---

### Task 2.7: AuthService.rotateRefreshToken 메서드 추가

**Files:**
- Modify: `services/api/src/auth/auth.service.ts`
- Modify: `services/api/src/auth/auth.service.spec.ts`

- [ ] **Step 1: spec 작성**

```ts
describe('rotateRefreshToken', () => {
  it('rawRt가 undefined면 REFRESH_TOKEN_INVALID 예외를 던진다', async () => {
    const res = { cookie: jest.fn() } as any;
    await expect(service.rotateRefreshToken(undefined, res)).rejects.toMatchObject({
      errorCode: 'REFRESH_TOKEN_INVALID',
    });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('session 회전 후 새 RT를 쿠키로 설정하고 userId를 반환한다', async () => {
    const res = { cookie: jest.fn() } as any;
    mockSessionService.rotate.mockResolvedValue({
      userId: 'u1',
      rawRefreshToken: 'new-rt',
      refreshTokenExpMs: 7 * 24 * 60 * 60 * 1000,
    });

    const result = await service.rotateRefreshToken('old-rt', res);

    expect(result).toEqual({ userId: 'u1' });
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'new-rt', expect.objectContaining({
      maxAge: 7 * 24 * 60 * 60 * 1000,
    }));
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd services/api && npm test -- auth.service.spec.ts -t "rotateRefreshToken"
```

Expected: FAIL

- [ ] **Step 3: 메서드 구현**

```ts
async rotateRefreshToken(rawRt: string | undefined, res: Response): Promise<{ userId: string }> {
  if (!rawRt) throw new ApiException('REFRESH_TOKEN_INVALID');
  const rotated = await this.sessionService.rotate(rawRt);
  this.setRefreshCookie(res, rotated.rawRefreshToken, rotated.refreshTokenExpMs);
  return { userId: rotated.userId };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd services/api && npm test -- auth.service.spec.ts -t "rotateRefreshToken"
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/api/src/auth/auth.service.ts services/api/src/auth/auth.service.spec.ts
git commit -m "feat(api): AuthService.rotateRefreshToken 추가"
```

---

### Task 2.8: AuthService.revokeRefreshToken 메서드 추가

**Files:**
- Modify: `services/api/src/auth/auth.service.ts`
- Modify: `services/api/src/auth/auth.service.spec.ts`

- [ ] **Step 1: spec 작성**

```ts
describe('revokeRefreshToken', () => {
  it('rawRt가 undefined여도 refresh 쿠키는 clear한다', async () => {
    const res = { clearCookie: jest.fn() } as any;

    await service.revokeRefreshToken(undefined, res);

    expect(mockSessionService.revokeByRawToken).not.toHaveBeenCalled();
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', expect.any(Object));
  });

  it('rawRt가 있으면 session revoke + 쿠키 clear', async () => {
    const res = { clearCookie: jest.fn() } as any;
    mockSessionService.revokeByRawToken.mockResolvedValue(undefined);

    await service.revokeRefreshToken('rt', res);

    expect(mockSessionService.revokeByRawToken).toHaveBeenCalledWith('rt');
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', expect.any(Object));
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd services/api && npm test -- auth.service.spec.ts -t "revokeRefreshToken"
```

Expected: FAIL

- [ ] **Step 3: 메서드 구현**

```ts
async revokeRefreshToken(rawRt: string | undefined, res: Response): Promise<void> {
  if (rawRt) {
    await this.sessionService.revokeByRawToken(rawRt);
  }
  this.clearRefreshCookie(res);
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd services/api && npm test -- auth.service.spec.ts -t "revokeRefreshToken"
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/api/src/auth/auth.service.ts services/api/src/auth/auth.service.spec.ts
git commit -m "feat(api): AuthService.revokeRefreshToken 추가"
```

---

## Phase 3 — UserService 확장 + UserController 신설

### Task 3.1: DTO를 src/auth/dto/ → src/user/dto/ 이관

**Files:**
- Move: `services/api/src/auth/dto/register-body.dto.ts` → `services/api/src/user/dto/register-body.dto.ts`
- Move: `services/api/src/auth/dto/register-response.dto.ts` → `services/api/src/user/dto/register-response.dto.ts`
- Move: `services/api/src/auth/dto/login-body.dto.ts` → `services/api/src/user/dto/login-body.dto.ts`
- Move: `services/api/src/auth/dto/login-response.dto.ts` → `services/api/src/user/dto/login-response.dto.ts`
- Move: `services/api/src/auth/dto/backup-login-body.dto.ts` → `services/api/src/user/dto/backup-login-body.dto.ts`
- Create: `services/api/src/user/dto/index.ts`
- Modify: `services/api/src/auth/dto/index.ts`
- Modify: `services/api/src/auth/auth.controller.ts` (import 경로 갱신)
- Modify: `services/api/src/auth/auth.service.ts` (import 경로 갱신)

- [ ] **Step 1: DTO 파일 5개 이동**

```bash
mkdir -p services/api/src/user/dto
git mv services/api/src/auth/dto/register-body.dto.ts services/api/src/user/dto/register-body.dto.ts
git mv services/api/src/auth/dto/register-response.dto.ts services/api/src/user/dto/register-response.dto.ts
git mv services/api/src/auth/dto/login-body.dto.ts services/api/src/user/dto/login-body.dto.ts
git mv services/api/src/auth/dto/login-response.dto.ts services/api/src/user/dto/login-response.dto.ts
git mv services/api/src/auth/dto/backup-login-body.dto.ts services/api/src/user/dto/backup-login-body.dto.ts
```

- [ ] **Step 2: `services/api/src/user/dto/index.ts` 생성**

```ts
export * from './backup-login-body.dto';
export * from './login-body.dto';
export * from './login-response.dto';
export * from './register-body.dto';
export * from './register-response.dto';
```

- [ ] **Step 3: `services/api/src/auth/dto/index.ts`에서 이동된 DTO export 제거**

```ts
// 변경 후 (backup-code-regenerate 2개만 남김)
export * from './backup-code-regenerate-body.dto';
export * from './backup-code-regenerate-response.dto';
```

- [ ] **Step 4: `services/api/src/auth/auth.controller.ts`와 `services/api/src/auth/auth.service.ts`의 import 경로 수정**

옛 `from './dto'`를 두 그룹으로 분리:
- `RegisterBodyDto`, `LoginBodyDto`, `BackupLoginBodyDto`, `RegisterResponseDto`, `LoginResponse`, `AuthenticatedResponseDto`, `TwoFaRequiredResponseDto` → `from '../user/dto'`
- `BackupCodeRegenerateBodyDto`, `BackupCodeRegenerateResponseDto` → `from './dto'` 유지

- [ ] **Step 5: `services/api/src/twofa/challenge.controller.ts`의 import 경로 수정**

```ts
// 변경 전
import { AuthenticatedResponseDto, type LoginResponse } from '../auth/dto';

// 변경 후
import { AuthenticatedResponseDto, type LoginResponse } from '../user/dto';
```

- [ ] **Step 6: 빌드 + 테스트**

```bash
cd services/api && npm run build && npm test
```

Expected: 전체 PASS, 빌드 성공.

- [ ] **Step 7: Commit**

```bash
git add services/api/src/user/dto services/api/src/auth/dto services/api/src/auth/auth.controller.ts services/api/src/auth/auth.service.ts services/api/src/twofa/challenge.controller.ts
git commit -m "refactor(api): login/register DTO를 src/user/dto/로 이관"
```

---

### Task 3.2: UserService에 findUserWithPermissions* 임시 추가 (Phase 7에서 제거)

> 옛 AuthService와 신규 UserService 흐름을 같이 빌드하기 위해 임시 헬퍼를 추가한다. AuthService의 옛 findUserWithPermissions를 UserService로 위임할 수 있게 한다.

**Files:**
- Modify: `services/api/src/user/user.service.ts`
- Modify: `services/api/src/user/user.service.spec.ts`

- [ ] **Step 1: 이 task는 의도적으로 skip — UserService.register/login 등이 추가되면서 직접 findById/findByUsername만 사용하면 충분하다. 옛 AuthService의 findUserWithPermissions는 옛 메서드와 함께 Phase 7에서 통째로 제거된다.**

해당 사항 없음. 다음 task로 진행.

---

### Task 3.3: UserService.register 메서드 추가

**Files:**
- Modify: `services/api/src/user/user.service.ts`
- Modify: `services/api/src/user/user.service.spec.ts`
- Modify: `services/api/src/user/user.module.ts`

- [ ] **Step 1: UserModule imports에 의존 모듈 추가**

```ts
@Module({
  imports: [
    BullModule.registerQueue({ name: PUSH_CHALLENGE_QUEUE }),
    forwardRef(() => AuthModule),
    forwardRef(() => TwoFaModule),
    DeviceModule,
    TrustedDeviceModule,
    InvitationModule,
  ],
  providers: [UserService, UserRepository],
  exports: [UserService],
})
export class UserModule {}
```

`forwardRef` import 추가:
```ts
import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TwoFaModule } from '../twofa/twofa.module';
import { DeviceModule } from '../device/device.module';
import { TrustedDeviceModule } from '../trusted-device/trusted-device.module';
import { InvitationModule } from '../invitation/invitation.module';
import { BullModule } from '@nestjs/bullmq';
import { PUSH_CHALLENGE_QUEUE } from '../twofa/push-challenge.publisher';
```

- [ ] **Step 2: spec 작성 (실패 케이스 우선)**

`services/api/src/user/user.service.spec.ts`에 추가:

```ts
describe('register', () => {
  it('초대 토큰이 유효하지 않으면 InvitationService에서 예외를 던진다', async () => {
    mockInvitationService.validateOrThrow.mockRejectedValue(new ApiException('INVITATION_NOT_FOUND'));
    const res = { cookie: jest.fn() } as any;

    await expect(service.register({ token: 'bad', username: 'a', nickname: 'A', password: 'p' }, res))
      .rejects.toMatchObject({ errorCode: 'INVITATION_NOT_FOUND' });
  });

  it('username 중복 시 USERNAME_TAKEN 예외를 던진다', async () => {
    mockInvitationService.validateOrThrow.mockResolvedValue(undefined);
    mockAuthService.hashPassword.mockResolvedValue('hashed');
    mockUserRepository.insert.mockRejectedValue({ code: '23505' });
    const res = { cookie: jest.fn() } as any;

    await expect(service.register({ token: 't', username: 'dup', nickname: 'D', password: 'p' }, res))
      .rejects.toMatchObject({ errorCode: 'USERNAME_TAKEN' });
  });

  it('insert 후 user가 조회되지 않으면 REGISTRATION_FAILED 예외를 던진다', async () => {
    mockInvitationService.validateOrThrow.mockResolvedValue(undefined);
    mockAuthService.hashPassword.mockResolvedValue('hashed');
    mockUserRepository.insert.mockResolvedValue({ id: 'u1' });
    mockAuthService.assignDefaultRole.mockResolvedValue(undefined);
    mockBackupCodeService.generateForUser.mockResolvedValue(['c1']);
    mockInvitationService.consume.mockResolvedValue(undefined);
    mockUserRepository.findById.mockResolvedValue(null);
    const res = { cookie: jest.fn() } as any;

    await expect(service.register({ token: 't', username: 'a', nickname: 'A', password: 'p' }, res))
      .rejects.toMatchObject({ errorCode: 'REGISTRATION_FAILED' });
  });

  it('정상 흐름 — accessToken + user + backupCodes 반환', async () => {
    mockInvitationService.validateOrThrow.mockResolvedValue(undefined);
    mockAuthService.hashPassword.mockResolvedValue('hashed');
    mockUserRepository.insert.mockResolvedValue({ id: 'u1' });
    mockAuthService.assignDefaultRole.mockResolvedValue(undefined);
    mockBackupCodeService.generateForUser.mockResolvedValue(['code-1', 'code-2']);
    mockInvitationService.consume.mockResolvedValue(undefined);
    mockUserRepository.findById.mockResolvedValue({
      id: 'u1', username: 'alice', nickname: 'A', password: 'hashed', active: true,
    });
    mockAuthService.issueTokenPair.mockResolvedValue({ accessToken: 'JWT' });
    const res = { cookie: jest.fn() } as any;

    const result = await service.register(
      { token: 't', username: 'alice', nickname: 'A', password: 'p' }, res,
    );

    expect(result).toEqual({
      accessToken: 'JWT',
      user: { id: 'u1', username: 'alice', nickname: 'A' },
      backupCodes: ['code-1', 'code-2'],
    });
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

```bash
cd services/api && npm test -- user.service.spec.ts -t "register"
```

Expected: FAIL

- [ ] **Step 4: `services/api/src/user/user.service.ts` 구현**

생성자 + 의존성 추가:

```ts
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { DatabaseService, ServiceCore, TransactionContext, Users$Insert, Users$Select } from '@terab/db';
import { LogReplay } from '@terab/logger';
import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { BackupCodeService } from '../twofa/backup-code.service';
import { InvitationService } from '../invitation/invitation.service';
import { UserRepository } from './user.repository';
import type { RegisterBodyDto, RegisterResponseDto } from './dto';

@Injectable()
export class UserService extends ServiceCore {
  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly userRepository: UserRepository,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
    private readonly backupCodeService: BackupCodeService,
    private readonly invitationService: InvitationService,
  ) {
    super(database, txContext);
  }

  // 기존 findById/findByUsername/create 유지

  @LogReplay()
  async register(body: RegisterBodyDto, res: Response): Promise<RegisterResponseDto> {
    let rawCodes!: string[];
    const { id } = await this.runInTx(async () => {
      await this.invitationService.validateOrThrow(body.token);
      const hashedPassword = await this.authService.hashPassword(body.password);
      const inserted = await this.userRepository
        .insert({ username: body.username, nickname: body.nickname, password: hashedPassword })
        .catch((err: { code?: string }) => {
          if (err.code === '23505') throw new ApiException('USERNAME_TAKEN');
          throw err;
        });
      await this.authService.assignDefaultRole(inserted.id);
      rawCodes = await this.backupCodeService.generateForUser(inserted.id);
      await this.invitationService.consume(body.token, inserted.id);
      return inserted;
    });

    const user = await this.userRepository.findById(id);
    if (!user) throw new ApiException('REGISTRATION_FAILED');

    const { accessToken } = await this.authService.issueTokenPair(user, res);
    return {
      accessToken,
      user: { id: user.id, username: user.username, nickname: user.nickname },
      backupCodes: rawCodes,
    };
  }
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd services/api && npm test -- user.service.spec.ts -t "register"
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add services/api/src/user/user.service.ts services/api/src/user/user.service.spec.ts services/api/src/user/user.module.ts
git commit -m "feat(api): UserService.register — Phase 3.3"
```

---

### Task 3.4: UserService.login 메서드 추가

**Files:**
- Modify: `services/api/src/user/user.service.ts`
- Modify: `services/api/src/user/user.service.spec.ts`
- Modify: `services/api/src/user/user.module.ts`

- [ ] **Step 1: UserService에 추가 의존성 주입**

```ts
constructor(
  database: DatabaseService,
  txContext: TransactionContext,
  private readonly userRepository: UserRepository,
  @Inject(forwardRef(() => AuthService))
  private readonly authService: AuthService,
  @Inject(forwardRef(() => TwoFaService))
  private readonly twoFaService: TwoFaService,
  private readonly deviceService: DeviceService,
  private readonly trustedDeviceService: TrustedDeviceService,
  private readonly backupCodeService: BackupCodeService,
  private readonly invitationService: InvitationService,
  private readonly pushChallengePublisher: PushChallengePublisher,
) { super(database, txContext); }
```

import 추가:
```ts
import { TwoFaService } from '../twofa/twofa.service';
import { DeviceService } from '../device/device.service';
import { TrustedDeviceService } from '../trusted-device/trusted-device.service';
import { PushChallengePublisher } from '../twofa/push-challenge.publisher';
import type { LoginBodyDto, LoginResponse } from './dto';
```

- [ ] **Step 2: spec 작성**

```ts
describe('login', () => {
  it('username 없으면 INVALID_CREDENTIALS 예외를 던진다', async () => {
    mockUserRepository.findByUsername.mockResolvedValue(null);
    const res = { cookie: jest.fn() } as any;

    await expect(service.login({ username: 'ghost', password: 'p' }, undefined, undefined, res))
      .rejects.toMatchObject({ errorCode: 'INVALID_CREDENTIALS' });
  });

  it('trustToken 검증 통과 시 AUTHENTICATED + 토큰 발급', async () => {
    const user = { id: 'u1', username: 'a', nickname: 'A', password: 'h', active: true };
    mockUserRepository.findByUsername.mockResolvedValue(user);
    mockAuthService.validateCredentials.mockResolvedValue(undefined);
    mockTrustedDeviceService.verify.mockResolvedValue(true);
    mockAuthService.issueTokenPair.mockResolvedValue({ accessToken: 'JWT' });
    const res = { cookie: jest.fn() } as any;

    const result = await service.login({ username: 'a', password: 'p' }, 'tt', 'ua', res);

    expect(result).toEqual({
      status: 'AUTHENTICATED',
      accessToken: 'JWT',
      user: { id: 'u1', username: 'a', nickname: 'A' },
    });
  });

  it('push token이 없으면 2FA 없이 AUTHENTICATED', async () => {
    const user = { id: 'u1', username: 'a', nickname: 'A', password: 'h', active: true };
    mockUserRepository.findByUsername.mockResolvedValue(user);
    mockAuthService.validateCredentials.mockResolvedValue(undefined);
    mockTrustedDeviceService.verify.mockResolvedValue(false);
    mockDeviceService.findPushTokensByUserId.mockResolvedValue([]);
    mockAuthService.issueTokenPair.mockResolvedValue({ accessToken: 'JWT' });
    const res = { cookie: jest.fn() } as any;

    const result = await service.login({ username: 'a', password: 'p' }, undefined, undefined, res);

    expect(result.status).toBe('AUTHENTICATED');
  });

  it('push token 존재 시 2FA_REQUIRED 챌린지 발급 + publish', async () => {
    const user = { id: 'u1', username: 'a', nickname: 'A', password: 'h', active: true };
    mockUserRepository.findByUsername.mockResolvedValue(user);
    mockAuthService.validateCredentials.mockResolvedValue(undefined);
    mockTrustedDeviceService.verify.mockResolvedValue(false);
    mockDeviceService.findPushTokensByUserId.mockResolvedValue(['pt-1']);
    const exp = new Date(Date.now() + 60000);
    mockTwoFaService.createChallenge.mockResolvedValue({
      id: 'ch-1', userId: 'u1', options: '1,2,3', correctNum: '2', expiresAt: exp, status: 'PENDING', respondedAt: null,
    });
    const res = { cookie: jest.fn() } as any;

    const result = await service.login({ username: 'a', password: 'p' }, undefined, undefined, res);

    expect(result).toMatchObject({
      status: '2FA_REQUIRED',
      challengeId: 'ch-1',
      options: ['1', '2', '3'],
      expiresAt: exp,
    });
    expect(mockPushChallengePublisher.publish).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

```bash
cd services/api && npm test -- user.service.spec.ts -t "login"
```

Expected: FAIL

- [ ] **Step 4: UserService.login 구현**

```ts
@LogReplay({ captureResult: true })
async login(
  body: LoginBodyDto,
  trustToken: string | undefined,
  _userAgent: string | undefined,
  res: Response,
): Promise<LoginResponse> {
  const user = await this.userRepository.findByUsername(body.username);
  if (!user) throw new ApiException('INVALID_CREDENTIALS');
  await this.authService.validateCredentials(user, body.password);

  if (trustToken && (await this.trustedDeviceService.verify(trustToken, user.id))) {
    const { accessToken } = await this.authService.issueTokenPair(user, res);
    return {
      status: 'AUTHENTICATED',
      accessToken,
      user: { id: user.id, username: user.username, nickname: user.nickname },
    };
  }

  const pushTokens = await this.deviceService.findPushTokensByUserId(user.id);
  if (pushTokens.length === 0) {
    const { accessToken } = await this.authService.issueTokenPair(user, res);
    return {
      status: 'AUTHENTICATED',
      accessToken,
      user: { id: user.id, username: user.username, nickname: user.nickname },
    };
  }

  const challenge = await this.twoFaService.createChallenge(user.id);
  await Promise.all(
    pushTokens.map((pushToken) =>
      this.pushChallengePublisher.publish({
        userId: user.id,
        pushToken,
        challengeId: challenge.id,
        options: challenge.options,
        expiresAt: challenge.expiresAt.toISOString(),
      }),
    ),
  );

  return {
    status: '2FA_REQUIRED',
    challengeId: challenge.id,
    options: challenge.options.split(','),
    expiresAt: challenge.expiresAt,
  };
}
```

UserModule imports에 BullModule + 의존 모듈 보장:

```ts
@Module({
  imports: [
    BullModule.registerQueue({ name: PUSH_CHALLENGE_QUEUE }),
    forwardRef(() => AuthModule),
    forwardRef(() => TwoFaModule),
    DeviceModule,
    TrustedDeviceModule,
    InvitationModule,
  ],
  providers: [UserService, UserRepository],
  exports: [UserService],
})
export class UserModule {}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd services/api && npm test -- user.service.spec.ts -t "login"
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add services/api/src/user/user.service.ts services/api/src/user/user.service.spec.ts services/api/src/user/user.module.ts
git commit -m "feat(api): UserService.login — 2FA dispatch 결정 포함"
```

---

### Task 3.5: UserService.loginWithBackupCode 메서드 추가

**Files:**
- Modify: `services/api/src/user/user.service.ts`
- Modify: `services/api/src/user/user.service.spec.ts`

- [ ] **Step 1: spec 작성**

```ts
describe('loginWithBackupCode', () => {
  it('user가 없으면 INVALID_CREDENTIALS 예외', async () => {
    mockUserRepository.findByUsername.mockResolvedValue(null);
    const res = { cookie: jest.fn() } as any;

    await expect(service.loginWithBackupCode({ username: 'g', password: 'p', backupCode: 'c' }, res))
      .rejects.toMatchObject({ errorCode: 'INVALID_CREDENTIALS' });
  });

  it('정상 흐름 — backup-code 소비 후 토큰 발급', async () => {
    const user = { id: 'u1', username: 'a', nickname: 'A', password: 'h', active: true };
    mockUserRepository.findByUsername.mockResolvedValue(user);
    mockAuthService.validateCredentials.mockResolvedValue(undefined);
    mockBackupCodeService.consume.mockResolvedValue(undefined);
    mockAuthService.issueTokenPair.mockResolvedValue({ accessToken: 'JWT' });
    const res = { cookie: jest.fn() } as any;

    const result = await service.loginWithBackupCode(
      { username: 'a', password: 'p', backupCode: 'c' }, res,
    );

    expect(mockBackupCodeService.consume).toHaveBeenCalledWith('u1', 'c');
    expect(result).toEqual({
      status: 'AUTHENTICATED',
      accessToken: 'JWT',
      user: { id: 'u1', username: 'a', nickname: 'A' },
    });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd services/api && npm test -- user.service.spec.ts -t "loginWithBackupCode"
```

Expected: FAIL

- [ ] **Step 3: 메서드 구현**

```ts
async loginWithBackupCode(
  body: BackupLoginBodyDto,
  res: Response,
): Promise<LoginResponse> {
  const user = await this.userRepository.findByUsername(body.username);
  if (!user) throw new ApiException('INVALID_CREDENTIALS');
  await this.authService.validateCredentials(user, body.password);
  await this.backupCodeService.consume(user.id, body.backupCode);
  const { accessToken } = await this.authService.issueTokenPair(user, res);
  return {
    status: 'AUTHENTICATED',
    accessToken,
    user: { id: user.id, username: user.username, nickname: user.nickname },
  };
}
```

import 추가: `BackupLoginBodyDto`

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd services/api && npm test -- user.service.spec.ts -t "loginWithBackupCode"
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/api/src/user/user.service.ts services/api/src/user/user.service.spec.ts
git commit -m "feat(api): UserService.loginWithBackupCode"
```

---

### Task 3.6: UserService.refresh 메서드 추가

**Files:**
- Modify: `services/api/src/user/user.service.ts`
- Modify: `services/api/src/user/user.service.spec.ts`

- [ ] **Step 1: spec 작성**

```ts
describe('refresh', () => {
  it('rotation 후 user가 없으면 REFRESH_TOKEN_INVALID 예외', async () => {
    mockAuthService.rotateRefreshToken.mockResolvedValue({ userId: 'ghost' });
    mockUserRepository.findById.mockResolvedValue(null);
    const res = { cookie: jest.fn() } as any;

    await expect(service.refresh('rt', res)).rejects.toMatchObject({
      errorCode: 'REFRESH_TOKEN_INVALID',
    });
  });

  it('정상 흐름 — 새 accessToken + AUTHENTICATED 응답', async () => {
    mockAuthService.rotateRefreshToken.mockResolvedValue({ userId: 'u1' });
    mockUserRepository.findById.mockResolvedValue({
      id: 'u1', username: 'a', nickname: 'A', password: 'h', active: true,
    });
    mockAuthService.generateAccessToken.mockResolvedValue('JWT');
    const res = { cookie: jest.fn() } as any;

    const result = await service.refresh('rt', res);

    expect(result).toEqual({
      status: 'AUTHENTICATED',
      accessToken: 'JWT',
      user: { id: 'u1', username: 'a', nickname: 'A' },
    });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd services/api && npm test -- user.service.spec.ts -t "refresh"
```

Expected: FAIL

- [ ] **Step 3: 메서드 구현**

```ts
@LogReplay({ captureResult: true })
async refresh(rawRt: string | undefined, res: Response): Promise<LoginResponse> {
  const { userId } = await this.authService.rotateRefreshToken(rawRt, res);
  const user = await this.userRepository.findById(userId);
  if (!user) throw new ApiException('REFRESH_TOKEN_INVALID');
  const accessToken = await this.authService.generateAccessToken(user);
  return {
    status: 'AUTHENTICATED',
    accessToken,
    user: { id: user.id, username: user.username, nickname: user.nickname },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd services/api && npm test -- user.service.spec.ts -t "refresh"
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/api/src/user/user.service.ts services/api/src/user/user.service.spec.ts
git commit -m "feat(api): UserService.refresh"
```

---

### Task 3.7: UserService.logout / getMe / issueAfterTwoFa 메서드 추가

**Files:**
- Modify: `services/api/src/user/user.service.ts`
- Modify: `services/api/src/user/user.service.spec.ts`

- [ ] **Step 1: spec 작성 (세 메서드 묶음)**

```ts
describe('logout', () => {
  it('authService.revokeRefreshToken에 위임한다', async () => {
    const res = { clearCookie: jest.fn() } as any;
    mockAuthService.revokeRefreshToken.mockResolvedValue(undefined);

    await service.logout('rt', res);

    expect(mockAuthService.revokeRefreshToken).toHaveBeenCalledWith('rt', res);
  });
});

describe('getMe', () => {
  it('user가 없으면 INVALID_CREDENTIALS 예외', async () => {
    mockUserRepository.findById.mockResolvedValue(null);
    await expect(service.getMe('ghost')).rejects.toMatchObject({ errorCode: 'INVALID_CREDENTIALS' });
  });

  it('UserDto 형태로 반환한다', async () => {
    mockUserRepository.findById.mockResolvedValue({
      id: 'u1', username: 'a', nickname: 'A', password: 'h', active: true,
    });
    const result = await service.getMe('u1');
    expect(result).toEqual({ id: 'u1', username: 'a', nickname: 'A' });
  });
});

describe('issueAfterTwoFa', () => {
  it('user가 없으면 TWOFA_CHALLENGE_NOT_FOUND 예외', async () => {
    mockUserRepository.findById.mockResolvedValue(null);
    const res = { cookie: jest.fn() } as any;

    await expect(service.issueAfterTwoFa('ghost', res)).rejects.toMatchObject({
      errorCode: 'TWOFA_CHALLENGE_NOT_FOUND',
    });
  });

  it('정상 흐름 — issueTokenPair → AUTHENTICATED', async () => {
    mockUserRepository.findById.mockResolvedValue({
      id: 'u1', username: 'a', nickname: 'A', password: 'h', active: true,
    });
    mockAuthService.issueTokenPair.mockResolvedValue({ accessToken: 'JWT' });
    const res = { cookie: jest.fn() } as any;

    const result = await service.issueAfterTwoFa('u1', res);

    expect(result).toEqual({
      status: 'AUTHENTICATED',
      accessToken: 'JWT',
      user: { id: 'u1', username: 'a', nickname: 'A' },
    });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd services/api && npm test -- user.service.spec.ts -t "logout|getMe|issueAfterTwoFa"
```

Expected: FAIL

- [ ] **Step 3: 메서드 구현**

```ts
@LogReplay()
async logout(rawRt: string | undefined, res: Response): Promise<void> {
  await this.authService.revokeRefreshToken(rawRt, res);
}

async getMe(userId: string): Promise<UserDto> {
  const user = await this.userRepository.findById(userId);
  if (!user) throw new ApiException('INVALID_CREDENTIALS');
  return { id: user.id, username: user.username, nickname: user.nickname };
}

async issueAfterTwoFa(userId: string, res: Response): Promise<LoginResponse> {
  const user = await this.userRepository.findById(userId);
  if (!user) throw new ApiException('TWOFA_CHALLENGE_NOT_FOUND');
  const { accessToken } = await this.authService.issueTokenPair(user, res);
  return {
    status: 'AUTHENTICATED',
    accessToken,
    user: { id: user.id, username: user.username, nickname: user.nickname },
  };
}
```

import 추가: `UserDto` (from `../common/dto`)

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd services/api && npm test -- user.service.spec.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/api/src/user/user.service.ts services/api/src/user/user.service.spec.ts
git commit -m "feat(api): UserService.logout / getMe / issueAfterTwoFa"
```

---

### Task 3.8: UserController 신설

**Files:**
- Create: `services/api/src/user/user.controller.ts`
- Create: `services/api/src/user/user.controller.spec.ts`
- Modify: `services/api/src/user/user.module.ts`

- [ ] **Step 1: `services/api/src/user/user.controller.ts` 생성**

```ts
import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiExtraModels, ApiOperation, ApiResponse, ApiTags, getSchemaPath, refs } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiError, Cookies, CurrentUser, Public, type AuthUser } from '@terab/common';
import type { Request, Response } from 'express';
import { UserDto } from '../common/dto';
import { UserService } from './user.service';
import {
  AuthenticatedResponseDto,
  BackupLoginBodyDto,
  LoginBodyDto,
  RegisterBodyDto,
  RegisterResponseDto,
  TwoFaRequiredResponseDto,
  type LoginResponse,
} from './dto';

const LOGIN_RESPONSE_API_RESPONSE = {
  status: HttpStatus.OK,
  schema: {
    oneOf: refs(AuthenticatedResponseDto, TwoFaRequiredResponseDto),
    discriminator: {
      propertyName: 'status',
      mapping: {
        AUTHENTICATED: getSchemaPath(AuthenticatedResponseDto),
        '2FA_REQUIRED': getSchemaPath(TwoFaRequiredResponseDto),
      },
    },
  },
} as const;

@Controller()
@ApiTags('User')
@ApiExtraModels(AuthenticatedResponseDto, TwoFaRequiredResponseDto)
export class UserController {
  private readonly REFRESH_TOKEN_COOKIE = 'refreshToken';

  constructor(private readonly userService: UserService) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('register')
  @ApiOperation({ summary: '회원가입 — 초대 토큰 소비 후 RT 쿠키 설정' })
  @ApiResponse({ status: HttpStatus.CREATED, type: RegisterResponseDto })
  @ApiError(
    'INVITATION_NOT_FOUND',
    'INVITATION_EXPIRED',
    'INVITATION_ALREADY_USED',
    'USERNAME_TAKEN',
    'REGISTRATION_FAILED',
    'ROLE_NOT_FOUND',
  )
  async register(
    @Body() body: RegisterBodyDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RegisterResponseDto> {
    return this.userService.register(body, res);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '로그인 — 2FA 필요 시 챌린지, 아니면 AUTHENTICATED' })
  @ApiResponse(LOGIN_RESPONSE_API_RESPONSE)
  @ApiError('INVALID_CREDENTIALS', 'ACCOUNT_DISABLED')
  async login(
    @Body() body: LoginBodyDto,
    @Cookies('trustToken') trustToken: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    return this.userService.login(body, trustToken, userAgent, res);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login/backup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '백업 코드 로그인 — 2FA 우회' })
  @ApiResponse(LOGIN_RESPONSE_API_RESPONSE)
  @ApiError('INVALID_CREDENTIALS', 'BACKUP_CODE_INVALID', 'ACCOUNT_DISABLED')
  async loginWithBackup(
    @Body() body: BackupLoginBodyDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    return this.userService.loginWithBackupCode(body, res);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh Token 회전' })
  @ApiResponse(LOGIN_RESPONSE_API_RESPONSE)
  @ApiError('REFRESH_TOKEN_INVALID')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<LoginResponse> {
    const rawRt = req.cookies?.[this.REFRESH_TOKEN_COOKIE] as string | undefined;
    return this.userService.refresh(rawRt, res);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '로그아웃 — RT 폐기 및 쿠키 삭제' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const rawRt = req.cookies?.[this.REFRESH_TOKEN_COOKIE] as string | undefined;
    await this.userService.logout(rawRt, res);
  }

  @Get('me')
  @ApiOperation({ summary: '현재 사용자 조회' })
  @ApiResponse({ status: HttpStatus.OK, type: UserDto })
  @ApiError('INVALID_CREDENTIALS')
  async me(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.userService.getMe(user.userId);
  }
}
```

- [ ] **Step 2: `services/api/src/user/user.controller.spec.ts` 생성**

```ts
import { Test } from '@nestjs/testing';
import { mockAuthUser } from '@terab/test';
import { UserController } from './user.controller';
import { UserService } from './user.service';

const mockUserService = {
  register: jest.fn(),
  login: jest.fn(),
  loginWithBackupCode: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  getMe: jest.fn(),
};

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: mockUserService }],
    }).compile();

    controller = module.get(UserController);
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('userService.register에 body와 res를 위임한다', async () => {
      const body = { token: 't', username: 'a', nickname: 'A', password: 'p' };
      const res = {} as any;
      mockUserService.register.mockResolvedValue({ accessToken: 'JWT', user: {}, backupCodes: [] });

      await controller.register(body, res);

      expect(mockUserService.register).toHaveBeenCalledWith(body, res);
    });
  });

  describe('login', () => {
    it('userService.login에 body/trustToken/userAgent/res를 위임한다', async () => {
      const body = { username: 'a', password: 'p' };
      const res = {} as any;
      mockUserService.login.mockResolvedValue({ status: 'AUTHENTICATED' });

      await controller.login(body, 'tt', 'ua', res);

      expect(mockUserService.login).toHaveBeenCalledWith(body, 'tt', 'ua', res);
    });
  });

  describe('refresh', () => {
    it('cookie에서 refreshToken을 추출해 service에 전달한다', async () => {
      const req = { cookies: { refreshToken: 'rt' } } as any;
      const res = {} as any;
      mockUserService.refresh.mockResolvedValue({ status: 'AUTHENTICATED' });

      await controller.refresh(req, res);

      expect(mockUserService.refresh).toHaveBeenCalledWith('rt', res);
    });

    it('cookie 없을 때 undefined를 전달한다', async () => {
      const req = { cookies: undefined } as any;
      const res = {} as any;
      mockUserService.refresh.mockResolvedValue({ status: 'AUTHENTICATED' });

      await controller.refresh(req, res);

      expect(mockUserService.refresh).toHaveBeenCalledWith(undefined, res);
    });
  });

  describe('logout', () => {
    it('cookie에서 refreshToken을 추출해 service에 전달한다', async () => {
      const req = { cookies: { refreshToken: 'rt' } } as any;
      const res = {} as any;
      mockUserService.logout.mockResolvedValue(undefined);

      await controller.logout(req, res);

      expect(mockUserService.logout).toHaveBeenCalledWith('rt', res);
    });
  });

  describe('me', () => {
    it('현재 사용자 정보를 반환한다', async () => {
      mockUserService.getMe.mockResolvedValue({ id: 'u1', username: 'a', nickname: 'A' });

      const result = await controller.me(mockAuthUser);

      expect(mockUserService.getMe).toHaveBeenCalledWith(mockAuthUser.userId);
      expect(result).toEqual({ id: 'u1', username: 'a', nickname: 'A' });
    });
  });
});
```

- [ ] **Step 3: `services/api/src/user/user.module.ts`에 controller 등록**

```ts
@Module({
  imports: [
    BullModule.registerQueue({ name: PUSH_CHALLENGE_QUEUE }),
    forwardRef(() => AuthModule),
    forwardRef(() => TwoFaModule),
    DeviceModule,
    TrustedDeviceModule,
    InvitationModule,
  ],
  controllers: [UserController],     // 신규
  providers: [UserService, UserRepository],
  exports: [UserService],
})
export class UserModule {}
```

import 추가: `import { UserController } from './user.controller';`

- [ ] **Step 4: 빌드 + 테스트**

```bash
cd services/api && npm run build && npm test -- user.controller.spec.ts
```

Expected: PASS, 빌드 성공.

이 시점에서 `/register`, `/login`, `/refresh`, `/logout`, `/me`, `/login/backup` 경로와 옛 `/auth/*` 경로가 둘 다 존재하는 과도기 상태 — 정상.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/user/user.controller.ts services/api/src/user/user.controller.spec.ts services/api/src/user/user.module.ts
git commit -m "feat(api): UserController 신설 — root 경로로 register/login/refresh/logout/me 노출"
```

---

## Phase 4 — TwoFa 변경

### Task 4.1: ChallengeStatusApprovedDto 변경 (userId만 노출)

**Files:**
- Modify: `services/api/src/twofa/dto/challenge-status-response.dto.ts`
- Modify: `services/api/src/twofa/twofa.service.spec.ts`

- [ ] **Step 1: DTO 변경**

`ChallengeStatusApprovedDto`를 아래로 교체:

```ts
import { ApiProperty } from '@nestjs/swagger';

export class ChallengeStatusApprovedDto {
  status!: 'APPROVED';

  @ApiProperty({ format: 'uuid' })
  userId!: string;
}
```

`ChallengeStatusResponse` 유니언에서 `accessToken`/`user` 필드는 더 이상 제공되지 않음. 호출자는 `/2fa/challenge/:id/complete` 호출로 토큰 수신.

- [ ] **Step 2: 빌드 — 타입 에러 발생 확인**

```bash
cd services/api && npm run build
```

Expected: FAIL — `twofa.service.ts:getStatus` 분기에서 `accessToken/user` 사용처 타입 에러.

- [ ] **Step 3: `services/api/src/twofa/twofa.service.ts`의 getStatus APPROVED 분기 단순화**

```ts
// 변경 전
if (challenge.status === 'APPROVED') {
  const user = await this.twoFaRepository.findUserWithPermissionsById(challenge.userId);
  if (!user) throw new ApiException('TWOFA_CHALLENGE_NOT_FOUND');
  const accessToken = this.tokenService.generateAccessToken(user.id, user.username, user.permissions);
  return { status: 'APPROVED', accessToken, user: {...} };
}

// 변경 후
if (challenge.status === 'APPROVED') {
  return { status: 'APPROVED', userId: challenge.userId };
}
```

- [ ] **Step 4: 빌드 + 테스트**

```bash
cd services/api && npm run build && npm test -- twofa.service.spec.ts
```

Expected: 일부 테스트 실패 — Phase 4.2에서 spec 갱신.

- [ ] **Step 5: 빌드만 성공 확인 + Commit**

```bash
cd services/api && npm run build
```

Expected: 빌드 성공.

```bash
git add services/api/src/twofa/dto/challenge-status-response.dto.ts services/api/src/twofa/twofa.service.ts
git commit -m "refactor(api): TwoFa.getStatus가 APPROVED 시 userId만 반환"
```

---

### Task 4.2: TwoFaService.getStatus spec 갱신 + TokenService 의존성 제거

**Files:**
- Modify: `services/api/src/twofa/twofa.service.spec.ts`
- Modify: `services/api/src/twofa/twofa.service.ts`

- [ ] **Step 1: `getStatus` APPROVED 케이스 spec 변경**

```ts
describe('getStatus', () => {
  // 기존 PENDING/EXPIRED/DENIED 케이스 유지

  it('APPROVED 상태면 userId만 반환한다', async () => {
    mockTwoFaRepository.findById.mockResolvedValue({
      id: 'ch-1', userId: 'u1', status: 'APPROVED', options: '1,2,3', correctNum: '2',
      expiresAt: new Date(Date.now() + 60000), respondedAt: new Date(),
    });

    const result = await service.getStatus('ch-1');

    expect(result).toEqual({ status: 'APPROVED', userId: 'u1' });
  });
});
```

`findUserWithPermissionsById` mock 호출 검증 케이스 제거.

- [ ] **Step 2: TokenService 의존성 제거**

`services/api/src/twofa/twofa.service.ts`:

```ts
// 변경 전 생성자
constructor(
  database: DatabaseService,
  txContext: TransactionContext,
  private readonly twoFaRepository: TwoFaRepository,
  private readonly tokenService: TokenService,
  private readonly registry: TwoFaStrategyRegistry,
) { super(database, txContext); }

// 변경 후
constructor(
  database: DatabaseService,
  txContext: TransactionContext,
  private readonly twoFaRepository: TwoFaRepository,
  private readonly registry: TwoFaStrategyRegistry,
) { super(database, txContext); }
```

`TokenService` import 제거.

`issueAuthenticatedResponse` placeholder 메서드 제거.

- [ ] **Step 3: spec 파일의 TokenService mock 제거**

`services/api/src/twofa/twofa.service.spec.ts`에서 `mockTokenService` provider 등록 제거.

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd services/api && npm test -- twofa.service.spec.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/api/src/twofa/twofa.service.ts services/api/src/twofa/twofa.service.spec.ts
git commit -m "refactor(api): TwoFaService에서 TokenService 의존성 제거"
```

---

### Task 4.3: TwoFaRepository.findUserWithPermissionsById 제거

**Files:**
- Modify: `services/api/src/twofa/twofa.repository.ts`
- Modify: `services/api/src/twofa/twofa.repository.spec.ts`

- [ ] **Step 1: 메서드 삭제 + JOIN용 import 정리**

`services/api/src/twofa/twofa.repository.ts`:

```ts
import { Injectable } from '@nestjs/common';
import {
  DatabaseService,
  RepositoryCore,
  TransactionContext,
  twoFaChallenges,
  type TwoFaChallenges$Insert,
} from '@terab/db';
import { eq } from 'drizzle-orm';

@Injectable()
export class TwoFaRepository extends RepositoryCore {
  constructor(database: DatabaseService, txContext: TransactionContext) {
    super(database, txContext);
  }

  async insert(data: Pick<TwoFaChallenges$Insert, 'userId' | 'options' | 'correctNum' | 'expiresAt'>) {
    const [row] = await this.conn.insert(twoFaChallenges).values(data).returning();
    return row;
  }

  async findById(id: string) {
    const [twoFa] = await this.conn.select().from(twoFaChallenges).where(eq(twoFaChallenges.id, id));
    return twoFa;
  }

  async updateStatus(
    id: string,
    status: NonNullable<TwoFaChallenges$Insert['status']>,
    respondedAt?: TwoFaChallenges$Insert['respondedAt'],
  ): Promise<void> {
    await this.conn.update(twoFaChallenges).set({ status, respondedAt }).where(eq(twoFaChallenges.id, id));
  }
}
```

- [ ] **Step 2: spec에서 `findUserWithPermissionsById` 관련 describe 블록 제거**

- [ ] **Step 3: 빌드 + 테스트**

```bash
cd services/api && npm run build && npm test -- twofa.repository.spec.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add services/api/src/twofa/twofa.repository.ts services/api/src/twofa/twofa.repository.spec.ts
git commit -m "refactor(api): TwoFaRepository.findUserWithPermissionsById 제거"
```

---

### Task 4.4: ChallengeController.complete를 UserService.issueAfterTwoFa로 위임

**Files:**
- Modify: `services/api/src/twofa/challenge.controller.ts`
- Modify: `services/api/src/twofa/challenge.controller.spec.ts`
- Modify: `services/api/src/twofa/twofa.module.ts`

- [ ] **Step 1: `services/api/src/twofa/twofa.module.ts`에 UserModule import 추가**

```ts
import { forwardRef } from '@nestjs/common';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: PUSH_CHALLENGE_QUEUE }),
    forwardRef(() => UserModule),     // 신규
  ],
  controllers: [TwoFaController, ChallengeController],
  // ...
})
```

- [ ] **Step 2: ChallengeController 변경**

```ts
import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Post, Res, forwardRef } from '@nestjs/common';
import { ApiExtraModels, ApiOperation, ApiResponse, ApiTags, getSchemaPath, refs } from '@nestjs/swagger';
import { ApiError, type AuthUser, CurrentUser, Public } from '@terab/common';
import type { Response } from 'express';
import { AuthenticatedResponseDto, type LoginResponse } from '../user/dto';
import { UserService } from '../user/user.service';
import {
  ChallengeStatusApprovedDto,
  ChallengeStatusDeniedDto,
  ChallengeStatusExpiredDto,
  ChallengeStatusPendingDto,
  type ChallengeStatusResponse,
  CompleteChallengeBodyDto,
  ResendChallengeResponseDto,
  RespondChallengeBodyDto,
} from './dto';
import { TwoFaService } from './twofa.service';

@Controller('2fa/challenge')
@ApiTags('TwoFa')
export class ChallengeController {
  constructor(
    private readonly twoFaService: TwoFaService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
  ) {}

  // getStatus, respond, resend는 그대로 유지

  @Public()
  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '2FA 챌린지 완료 — type별 verify 후 토큰 발급' })
  @ApiResponse({ status: HttpStatus.OK, type: AuthenticatedResponseDto })
  @ApiError('TWOFA_CHALLENGE_NOT_FOUND', 'TWOFA_TOTP_INVALID_CODE', 'TWOFA_TOTP_LOCKED')
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CompleteChallengeBodyDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const userId = await this.twoFaService.completeChallenge(id, body);
    return this.userService.issueAfterTwoFa(userId, res);
  }
}
```

- [ ] **Step 3: `services/api/src/twofa/challenge.controller.spec.ts` 업데이트**

`complete` describe 블록을 아래로 교체:

```ts
describe('complete', () => {
  it('twoFaService.completeChallenge로 검증 후 userService.issueAfterTwoFa 호출', async () => {
    mockTwoFaService.completeChallenge.mockResolvedValue('u1');
    mockUserService.issueAfterTwoFa.mockResolvedValue({
      status: 'AUTHENTICATED', accessToken: 'JWT', user: { id: 'u1', username: 'a', nickname: 'A' },
    });
    const res = {} as any;

    const result = await controller.complete('ch-1', { type: 'PUSH' }, res);

    expect(mockTwoFaService.completeChallenge).toHaveBeenCalledWith('ch-1', { type: 'PUSH' });
    expect(mockUserService.issueAfterTwoFa).toHaveBeenCalledWith('u1', res);
    expect(result.status).toBe('AUTHENTICATED');
  });
});
```

`mockUserService` provider도 추가:

```ts
const mockUserService = { issueAfterTwoFa: jest.fn() };

// Test.createTestingModule providers:
{ provide: UserService, useValue: mockUserService },
```

- [ ] **Step 4: 빌드 + 테스트**

```bash
cd services/api && npm run build && npm test -- challenge.controller.spec.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/api/src/twofa/challenge.controller.ts services/api/src/twofa/challenge.controller.spec.ts services/api/src/twofa/twofa.module.ts
git commit -m "refactor(api): ChallengeController.complete를 UserService.issueAfterTwoFa로 위임"
```

---

## Phase 5 — BackupCodeController 신설

### Task 5.1: BackupCode 관련 DTO를 twofa 모듈로 이관

**Files:**
- Move: `services/api/src/auth/dto/backup-code-regenerate-body.dto.ts` → `services/api/src/twofa/dto/backup-code-regenerate-body.dto.ts`
- Move: `services/api/src/auth/dto/backup-code-regenerate-response.dto.ts` → `services/api/src/twofa/dto/backup-code-regenerate-response.dto.ts`
- Modify: `services/api/src/auth/dto/index.ts`
- Modify: `services/api/src/twofa/dto/index.ts`
- Modify: `services/api/src/auth/auth.controller.ts` (import 경로 갱신)
- Modify: `services/api/src/auth/auth.service.ts` (import 경로 갱신)

- [ ] **Step 1: 파일 이동**

```bash
git mv services/api/src/auth/dto/backup-code-regenerate-body.dto.ts services/api/src/twofa/dto/backup-code-regenerate-body.dto.ts
git mv services/api/src/auth/dto/backup-code-regenerate-response.dto.ts services/api/src/twofa/dto/backup-code-regenerate-response.dto.ts
```

- [ ] **Step 2: `services/api/src/auth/dto/index.ts` 비우기 (또는 삭제)**

```bash
rm services/api/src/auth/dto/index.ts
rmdir services/api/src/auth/dto 2>/dev/null || true
```

만약 옛 auth.controller.ts에서 여전히 참조한다면, 임시로 빈 index.ts 유지 후 Phase 7에서 정리.

- [ ] **Step 3: `services/api/src/twofa/dto/index.ts`에 re-export 추가**

```ts
export * from './backup-code-regenerate-body.dto';
export * from './backup-code-regenerate-response.dto';
// 기존 export 유지
```

- [ ] **Step 4: `services/api/src/auth/auth.controller.ts`와 `auth.service.ts`의 import 경로 변경**

```ts
// 변경 전
import { BackupCodeRegenerateBodyDto, BackupCodeRegenerateResponseDto } from './dto';
// 변경 후
import { BackupCodeRegenerateBodyDto, BackupCodeRegenerateResponseDto } from '../twofa/dto';
```

- [ ] **Step 5: 빌드 + 테스트**

```bash
cd services/api && npm run build && npm test
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add services/api/src/twofa/dto services/api/src/auth/dto services/api/src/auth/auth.controller.ts services/api/src/auth/auth.service.ts
git commit -m "refactor(api): BackupCodeRegenerate DTO를 twofa 모듈로 이관"
```

---

### Task 5.2: BackupCodeController 생성

**Files:**
- Create: `services/api/src/twofa/backup-code.controller.ts`
- Create: `services/api/src/twofa/backup-code.controller.spec.ts`
- Modify: `services/api/src/twofa/twofa.module.ts`

- [ ] **Step 1: `services/api/src/twofa/backup-code.controller.ts` 생성**

```ts
import { Body, Controller, HttpCode, HttpStatus, Inject, Post, forwardRef } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiError, ApiException, type AuthUser, CurrentUser } from '@terab/common';
import { AuthService } from '../auth/auth.service';
import { UserService } from '../user/user.service';
import { BackupCodeService } from './backup-code.service';
import {
  BackupCodeRegenerateBodyDto,
  BackupCodeRegenerateResponseDto,
} from './dto';

@Controller('backup-codes')
@ApiTags('TwoFa')
export class BackupCodeController {
  constructor(
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly backupCodeService: BackupCodeService,
  ) {}

  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('regenerate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Backup Code 재발급 — 기존 unused 폐기 후 신규 발급' })
  @ApiResponse({ status: HttpStatus.OK, type: BackupCodeRegenerateResponseDto })
  @ApiError('INVALID_CREDENTIALS')
  async regenerate(
    @CurrentUser() user: AuthUser,
    @Body() body: BackupCodeRegenerateBodyDto,
  ): Promise<BackupCodeRegenerateResponseDto> {
    const dbUser = await this.userService.findById(user.userId);
    if (!dbUser) throw new ApiException('INVALID_CREDENTIALS');
    await this.authService.validateCredentials(dbUser, body.currentPassword);
    const backupCodes = await this.backupCodeService.regenerateForUser(user.userId);
    return { backupCodes };
  }
}
```

- [ ] **Step 2: `services/api/src/twofa/backup-code.controller.spec.ts` 생성**

```ts
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { mockAuthUser, mockUser } from '@terab/test';
import { AuthService } from '../auth/auth.service';
import { UserService } from '../user/user.service';
import { BackupCodeController } from './backup-code.controller';
import { BackupCodeService } from './backup-code.service';

const mockUserService = { findById: jest.fn() };
const mockAuthService = { validateCredentials: jest.fn() };
const mockBackupCodeService = { regenerateForUser: jest.fn() };

describe('BackupCodeController', () => {
  let controller: BackupCodeController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [BackupCodeController],
      providers: [
        { provide: UserService, useValue: mockUserService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: BackupCodeService, useValue: mockBackupCodeService },
      ],
    }).compile();

    controller = module.get(BackupCodeController);
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(controller).toBeDefined();
  });

  describe('regenerate', () => {
    it('user가 없으면 INVALID_CREDENTIALS 예외', async () => {
      mockUserService.findById.mockResolvedValue(null);

      await expect(controller.regenerate(mockAuthUser, { currentPassword: 'p' }))
        .rejects.toMatchObject({ errorCode: 'INVALID_CREDENTIALS' });
    });

    it('정상 흐름 — backup codes 재발급 반환', async () => {
      mockUserService.findById.mockResolvedValue(mockUser);
      mockAuthService.validateCredentials.mockResolvedValue(undefined);
      mockBackupCodeService.regenerateForUser.mockResolvedValue(['c1', 'c2']);

      const result = await controller.regenerate(mockAuthUser, { currentPassword: 'p' });

      expect(mockAuthService.validateCredentials).toHaveBeenCalledWith(mockUser, 'p');
      expect(result).toEqual({ backupCodes: ['c1', 'c2'] });
    });
  });
});
```

- [ ] **Step 3: `services/api/src/twofa/twofa.module.ts`에 controller 등록 + AuthModule import**

```ts
import { AuthModule } from '../auth/auth.module';
import { BackupCodeController } from './backup-code.controller';

@Module({
  imports: [
    BullModule.registerQueue({ name: PUSH_CHALLENGE_QUEUE }),
    forwardRef(() => UserModule),
    forwardRef(() => AuthModule),       // 신규
  ],
  controllers: [
    TwoFaController,
    ChallengeController,
    BackupCodeController,                // 신규
  ],
  // ...
})
```

- [ ] **Step 4: 빌드 + 테스트**

```bash
cd services/api && npm run build && npm test -- backup-code.controller.spec.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/api/src/twofa/backup-code.controller.ts services/api/src/twofa/backup-code.controller.spec.ts services/api/src/twofa/twofa.module.ts
git commit -m "feat(api): BackupCodeController 신설 — POST /backup-codes/regenerate"
```

---

## Phase 6 — TrustedDeviceController cookie write 위임

### Task 6.1: TrustedDeviceController가 AuthService.setTrustCookie 호출하도록 변경

**Files:**
- Modify: `services/api/src/trusted-device/trusted-device.controller.ts`
- Modify: `services/api/src/trusted-device/trusted-device.controller.spec.ts`
- Modify: `services/api/src/trusted-device/trusted-device.module.ts`

- [ ] **Step 1: TrustedDeviceModule이 AuthModule import**

`services/api/src/trusted-device/trusted-device.module.ts`:

```ts
import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],   // 신규
  // ...
})
```

- [ ] **Step 2: TrustedDeviceController 변경**

```ts
import {
  Controller, Delete, Get, Headers, HttpCode, HttpStatus, Inject, Param,
  ParseUUIDPipe, Post, Res, forwardRef,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiError, type AuthUser, CurrentUser } from '@terab/common';
import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { TrustedDeviceResponseDto } from './dto';
import { TrustedDeviceService } from './trusted-device.service';

@Controller('trusted-device')
@ApiTags('TrustedDevice')
export class TrustedDeviceController {
  constructor(
    private readonly trustedDeviceService: TrustedDeviceService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  @Get()
  @ApiOperation({ summary: '신뢰기기 목록 조회' })
  @ApiResponse({ status: HttpStatus.OK, type: TrustedDeviceResponseDto, isArray: true })
  async list(@CurrentUser() user: AuthUser): Promise<TrustedDeviceResponseDto[]> {
    return this.trustedDeviceService.list(user.userId);
  }

  @Post()
  @ApiOperation({ summary: '신뢰기기 등록 — trustToken 쿠키를 설정한다' })
  @ApiResponse({ status: HttpStatus.CREATED })
  async register(
    @CurrentUser() user: AuthUser,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const rawToken = await this.trustedDeviceService.register(user.userId, userAgent);
    this.authService.setTrustCookie(res, rawToken, this.trustedDeviceService.trustDurationMs);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '신뢰기기 해제' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError('TRUSTED_DEVICE_NOT_FOUND')
  async revoke(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.trustedDeviceService.revoke(id, user.userId);
  }
}
```

(기존 `TRUST_TOKEN_COOKIE`, `COOKIE_PATH` 상수와 `res.cookie(...)` 직접 호출 제거)

- [ ] **Step 3: spec 업데이트**

`services/api/src/trusted-device/trusted-device.controller.spec.ts`의 `register` describe 블록:

```ts
const mockAuthService = { setTrustCookie: jest.fn() };

// providers에 추가
{ provide: AuthService, useValue: mockAuthService },

describe('register', () => {
  it('신뢰기기 등록 후 AuthService.setTrustCookie를 호출한다', async () => {
    mockTrustedDeviceService.register.mockResolvedValue('raw-tt');
    Object.defineProperty(mockTrustedDeviceService, 'trustDurationMs', { value: 30 * 24 * 60 * 60 * 1000 });
    const res = {} as any;

    await controller.register(mockAuthUser, 'UA-1', res);

    expect(mockTrustedDeviceService.register).toHaveBeenCalledWith(mockAuthUser.userId, 'UA-1');
    expect(mockAuthService.setTrustCookie).toHaveBeenCalledWith(res, 'raw-tt', 30 * 24 * 60 * 60 * 1000);
  });
});
```

- [ ] **Step 4: 빌드 + 테스트**

```bash
cd services/api && npm run build && npm test -- trusted-device.controller.spec.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/api/src/trusted-device/trusted-device.controller.ts services/api/src/trusted-device/trusted-device.controller.spec.ts services/api/src/trusted-device/trusted-device.module.ts
git commit -m "refactor(api): TrustedDeviceController가 AuthService.setTrustCookie로 cookie write 위임"
```

---

## Phase 7 — 옛 AuthController/AuthService 정리

### Task 7.1: AuthController 삭제 + AuthModule에서 controller 등록 제거

**Files:**
- Delete: `services/api/src/auth/auth.controller.ts`
- Delete: `services/api/src/auth/auth.controller.spec.ts`
- Modify: `services/api/src/auth/auth.module.ts`

- [ ] **Step 1: 파일 삭제**

```bash
rm services/api/src/auth/auth.controller.ts
rm services/api/src/auth/auth.controller.spec.ts
```

- [ ] **Step 2: AuthModule에서 controllers 배열 비우기 + import 정리**

```ts
@Module({
  imports: [
    PassportModule,
    RoleModule,
    SessionModule,
  ],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, RoleModule, SessionModule],
})
export class AuthModule {}
```

옛 import 제거: `BullModule`, `DeviceModule`, `TwoFaModule`, `TrustedDeviceModule`, `InvitationModule`, `UserModule`, `PUSH_CHALLENGE_QUEUE`, `AuthController`. (BullModule.registerQueue는 UserModule이 가져갔음)

- [ ] **Step 3: 빌드 + 테스트**

```bash
cd services/api && npm run build && npm test
```

Expected: PASS — 옛 `/auth/*` 경로는 더 이상 응답하지 않고, root 경로(`/login` 등)만 응답.

- [ ] **Step 4: Commit**

```bash
git add services/api/src/auth services/api/src/auth/auth.module.ts
git commit -m "refactor(api): AuthController 제거 — 모든 라우트가 UserController로 이관됨"
```

---

### Task 7.2: AuthService에서 옛 public 메서드 제거 (register/login/refresh/logout/me/regenerateBackupCodes/completeTwoFa/loginWithBackupCode/findUserWithPermissionsBy*/issueTokenPair 옛 시그니처)

**Files:**
- Modify: `services/api/src/auth/auth.service.ts`
- Modify: `services/api/src/auth/auth.service.spec.ts`
- Delete: `services/api/src/auth/types/user-with-permissions.type.ts`

- [ ] **Step 1: `services/api/src/auth/auth.service.ts` 최종 형태로 정리**

아래 메서드만 남기고 모두 삭제:
- `hashPassword`
- `validateCredentials`
- `assignDefaultRole`
- `generateAccessToken`
- `issueTokenPair` (신규 시그니처)
- `rotateRefreshToken`
- `revokeRefreshToken`
- `setTrustCookie`, `clearTrustCookie`, `setRefreshCookie`, `clearRefreshCookie`

삭제할 메서드:
- 옛 `register`
- 옛 `login`
- 옛 `loginWithBackupCode`
- 옛 `completeTwoFa`
- 옛 `refresh`
- 옛 `logout`
- 옛 `getCurrentUser`
- 옛 `regenerateBackupCodes`
- 옛 `findUserWithPermissionsById`
- 옛 `findUserWithPermissionsByUsername`

삭제할 의존성:
- `PushChallengePublisher`
- `DeviceService`
- `TwoFaService`
- `TrustedDeviceService`
- `InvitationService`
- `BackupCodeService`
- `UserService`

최종 constructor:

```ts
constructor(
  database: DatabaseService,
  txContext: TransactionContext,
  private readonly tokenService: TokenService,
  private readonly sessionService: SessionService,
  private readonly roleService: RoleService,
) { super(database, txContext); }
```

`UserWithPermissions` import 제거, `AuthTokens` interface 제거.

- [ ] **Step 2: 옛 메서드 관련 spec 케이스 모두 제거**

`services/api/src/auth/auth.service.spec.ts`에서 register/login/refresh/logout/regenerateBackupCodes/completeTwoFa/loginWithBackupCode/findUserWithPermissions* describe 블록 모두 삭제. Phase 2에서 추가한 새 메서드 케이스만 남김.

- [ ] **Step 3: `services/api/src/auth/types/user-with-permissions.type.ts` 삭제**

```bash
rm services/api/src/auth/types/user-with-permissions.type.ts
rmdir services/api/src/auth/types 2>/dev/null || true
```

- [ ] **Step 4: 빌드 + 테스트**

```bash
cd services/api && npm run build && npm test
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/api/src/auth
git commit -m "refactor(api): AuthService 옛 public 메서드 + UserWithPermissions 타입 제거"
```

---

### Task 7.3: UserModule import 정리 + 최종 AppModule 확인

**Files:**
- Modify: `services/api/src/app.module.ts`

- [ ] **Step 1: `services/api/src/app.module.ts` 최종 imports 순서 정리**

```ts
imports: [
  ConfigModule.forRoot({ isGlobal: true }),
  LoggerModule.forRoot(),
  ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
  CacheModule.registerAsync({ ... }),
  BullModule.forRootAsync({ ... }),
  DatabaseModule,
  MinioModule,
  SecurityModule,
  HealthModule,
  UserModule,
  AuthModule,
  DeviceModule,
  TrustedDeviceModule,
  TwoFaModule,
  InvitationModule,
  FolderModule,
  FileModule,
  TrashModule,
],
```

(RoleModule, SessionModule이 이미 제거되었는지 확인)

- [ ] **Step 2: 빌드 + 테스트 + e2e 시작 가능성 확인**

```bash
cd services/api && npm run build && npm test
```

Expected: PASS

- [ ] **Step 3: 개발 서버 기동 smoke test**

```bash
cd services/api && timeout 15 npm run start:dev || true
```

Expected: Nest application 시작 성공 (DI 그래프 문제 없음), 15초 후 정상 종료.

- [ ] **Step 4: Commit (변경이 있다면)**

```bash
git status services/api/src/app.module.ts
# 변경이 있으면
git add services/api/src/app.module.ts
git commit -m "refactor(api): AppModule imports 정리"
```

---

## Phase 8 — 문서/룰 갱신

### Task 8.1: services/api/CLAUDE.md 모듈 표 갱신

**Files:**
- Modify: `services/api/CLAUDE.md`

- [ ] **Step 1: 모듈 표 행 변경**

찾아 바꾸기:

```md
# 변경 전
| `src/auth/` | 인증 (로그인·등록·토큰·2FA 진입) |
| ... |
| (없음 - role/session은 별도 항목)

# 변경 후
| `src/auth/` | 인증 — 자격증명·토큰·쿠키 관리 (controller 없음, role/session sub-module 포함) |
| `src/user/` | 사용자 lifecycle 흐름 (register/login/refresh/logout/me) — UserController가 root 경로로 노출 |
```

`src/role/`, `src/session/` 항목이 존재한다면 제거.

- [ ] **Step 2: "도메인 간 의존 관계" 섹션 갱신**

기존 `FileModule → FolderModule` 아래 추가:

```md
- `UserModule → AuthModule, TwoFaModule (forwardRef), DeviceModule, TrustedDeviceModule, InvitationModule` — register/login/refresh 흐름에서 호출
- `TwoFaModule → UserModule (forwardRef), AuthModule (forwardRef)` — ChallengeController.complete 및 BackupCodeController가 UserService/AuthService를 사용
- `TrustedDeviceModule → AuthModule (forwardRef)` — trustToken 쿠키 write를 AuthService.setTrustCookie에 위임
```

- [ ] **Step 3: Commit**

```bash
git add services/api/CLAUDE.md
git commit -m "docs(api): CLAUDE.md 모듈 표/의존 관계 — auth/user 책임 분리 반영"
```

---

### Task 8.2: 최종 전체 빌드 + 테스트 + 커밋

**Files:**
- 없음

- [ ] **Step 1: 전체 빌드 + 테스트**

```bash
cd services/api && npm run build && npm test
```

Expected: 모든 테스트 PASS, 빌드 성공.

- [ ] **Step 2: 변경된 git history 확인**

```bash
git log --oneline refactor/ts-rest-removal..HEAD
```

Expected: Phase 1~8의 커밋이 의도한 순서대로 나열됨.

- [ ] **Step 3: 브랜치 push (옵션)**

사용자가 명시적으로 요청할 때만 push.

---

## 자가 검토 체크리스트

설계 문서(spec) 대비 구현 계획 커버리지를 점검한다.

- [ ] spec §3 디렉토리 구조 — Phase 1, 3.1, 5.1, 7.1, 7.2에서 모두 처리
- [ ] spec §4 AuthService API — Phase 2.1~2.8에서 메서드별 TDD로 커버
- [ ] spec §5 UserController + UserService — Phase 3.3~3.8에서 커버
- [ ] spec §6 TwoFa 변경 — Phase 4.1~4.4에서 커버
- [ ] spec §7 TrustedDeviceController — Phase 6.1에서 커버
- [ ] spec §8 모듈 구성 — Phase 1, 3.3~3.4, 4.4, 5.2, 6.1, 7.1, 7.3에서 분산 처리
- [ ] spec §10 테스트 영향 — 각 phase TDD 단계에서 spec 추가/갱신
- [ ] spec §11 CLAUDE.md 갱신 — Phase 8.1
- [ ] spec §12 web codegen — 본 계획 범위 밖 (구현 완료 후 web 별도 갱신)
- [ ] spec §13 마이그레이션 순서 — phase 번호와 일치
