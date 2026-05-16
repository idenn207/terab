# Phase 6 — auth 도메인 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Phase 1 + Phase 5 plan을 참조 원본으로 사용.

**Goal:** auth 도메인(controller 7 메서드)을 표준 NestJS swagger + class-validator로 전환한다. **핵심 도메인** — LoginResponse discriminated union(AUTHENTICATED/2FA_REQUIRED), 쿠키 처리, refresh token 흐름 포함.

**Architecture:** auth는 다른 모든 도메인이 의존하는 인증 진입점. JwtAuthGuard·쿠키 라이프사이클·refresh token queue가 결합되어 있어 변경 영향이 가장 큼. Phase 5 (twofa)에서 discriminated union 패턴이 검증되어 있는 상태에서 LoginResponse에 동일 패턴 적용.

**Tech Stack:** Phase 0/1과 동일.

**Commit 단위:** 1 commit (`refactor: Phase 6 — auth 도메인 전환 (discriminated union 포함)`).

**Spec 참조:** §2.3 (discriminated union), §2.4~2.5 (controller 변환), §6.A. Phase 1 + Phase 5 plan 패턴.

**전제:** Phase 0~5 완료. Phase 5에서 OpenAPI oneOf 출력과 web codegen narrowing이 정상 동작 확인됨.

---

## File Structure

### Create (API)
- `services/api/src/auth/dto/login-body.dto.ts`
- `services/api/src/auth/dto/backup-login-body.dto.ts`
- `services/api/src/auth/dto/register-body.dto.ts`
- `services/api/src/auth/dto/login-response.dto.ts` — **discriminated union** (Authenticated + TwoFaRequired)
- `services/api/src/auth/dto/register-response.dto.ts`
- `services/api/src/auth/dto/index.ts`

### Modify (API)
- `services/api/src/auth/auth.controller.ts` — 7 메서드 변환
- `services/api/src/auth/auth.controller.spec.ts`
- `services/api/src/auth/auth.service.ts` (반환 타입)
- `services/api/src/common/dto/user.dto.ts` — Phase 0에서 작성한 stub을 실제 필드(`{ id, username, nickname }`)로 완성

### Modify (Web)
- `services/web/src/shared/api/generated/`
- `services/web/src/features/login-by-credentials/api/mutation.ts`
- `services/web/src/features/login-by-credentials/model/useLogin.ts` — LoginResponse narrowing
- `services/web/src/features/login-by-2fa/api/mutation.ts` (loginWithBackup, completeTwoFa 영향)
- `services/web/src/features/register-by-invitation/api/mutation.ts`
- `services/web/src/features/register-by-invitation/model/useRegister.ts`
- `services/web/src/features/logout/api/mutation.ts`
- `services/web/src/entities/user/api/query.ts` (me query)
- `services/web/src/shared/api/axiosInstance.ts` — refresh 인터셉터 내부 `/api/auth/refresh` URL 확인 (이미 raw axios.post 사용 중이라 변경 거의 없음)

---

## Task 1: UserDto 완성

**Files:**
- Modify: `services/api/src/common/dto/user.dto.ts`

- [ ] **Step 1: UserSchema 필드 확정**

기존 Zod (`common.schema.ts`): `{ id: uuid, username, nickname }`.

```ts
// services/api/src/common/dto/user.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  username!: string;

  nickname!: string;
}
```

- [ ] **Step 2: 빌드 검증**

Run: `cd services/api && npm run build`
Expected: 빌드 성공. Phase 5에서 `ChallengeStatusApprovedDto`가 이미 `UserDto`를 참조하고 있으면 그 참조도 정상 동작.

---

## Task 2: auth Body DTO 작성

**Files:**
- Create: `services/api/src/auth/dto/login-body.dto.ts`
- Create: `services/api/src/auth/dto/backup-login-body.dto.ts`
- Create: `services/api/src/auth/dto/register-body.dto.ts`

- [ ] **Step 1: LoginBodyDto**

```ts
// services/api/src/auth/dto/login-body.dto.ts
import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginBodyDto {
  @IsString() @MinLength(1) @MaxLength(50)
  username!: string;

  @IsString() @MinLength(1) @MaxLength(255)
  password!: string;
}
```

- [ ] **Step 2: BackupLoginBodyDto**

```ts
// services/api/src/auth/dto/backup-login-body.dto.ts
import { IsString, MaxLength, MinLength } from 'class-validator';

export class BackupLoginBodyDto {
  @IsString() @MinLength(1) @MaxLength(50)
  username!: string;

  @IsString() @MinLength(1) @MaxLength(255)
  password!: string;

  @IsString() @MinLength(1) @MaxLength(10)
  backupCode!: string;
}
```

- [ ] **Step 3: RegisterBodyDto**

기존 Zod: `{ token: uuid, username: 1-50, nickname: 1-50, password: min 8 }`.

```ts
// services/api/src/auth/dto/register-body.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class RegisterBodyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  token!: string;

  @IsString() @MinLength(1) @MaxLength(50)
  username!: string;

  @IsString() @MinLength(1) @MaxLength(50)
  nickname!: string;

  @IsString() @MinLength(8)
  password!: string;
}
```

- [ ] **Step 4: 빌드**

Run: `cd services/api && npm run build`
Expected: 빌드 성공.

---

## Task 3: LoginResponse discriminated union DTO 작성

**Files:**
- Create: `services/api/src/auth/dto/login-response.dto.ts`

- [ ] **Step 1: 2개 status DTO + 합성 union type**

```ts
// services/api/src/auth/dto/login-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from '../../common/dto';

export class AuthenticatedResponseDto {
  @ApiProperty({ enum: ['AUTHENTICATED'] })
  status!: 'AUTHENTICATED';

  accessToken!: string;

  @ApiProperty({ type: UserDto })
  user!: UserDto;
}

export class TwoFaRequiredResponseDto {
  @ApiProperty({ enum: ['2FA_REQUIRED'] })
  status!: '2FA_REQUIRED';

  challengeId!: string;

  @ApiProperty({ type: [String] })
  options!: string[];

  @ApiProperty({ format: 'date-time' })
  expiresAt!: Date;
}

export type LoginResponse = AuthenticatedResponseDto | TwoFaRequiredResponseDto;
```

> Phase 5의 ChallengeStatusResponseDto와 정확히 같은 패턴. swagger plugin이 status enum을 처리하고, controller에서 `@ApiExtraModels + oneOf + discriminator.mapping`을 부착해 OpenAPI에 정확한 union 출력.

---

## Task 4: RegisterResponseDto 작성

**Files:**
- Create: `services/api/src/auth/dto/register-response.dto.ts`

기존 Zod: `{ accessToken: string, user: User, backupCodes: string[] }`.

```ts
// services/api/src/auth/dto/register-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from '../../common/dto';

export class RegisterResponseDto {
  accessToken!: string;

  @ApiProperty({ type: UserDto })
  user!: UserDto;

  @ApiProperty({ type: [String] })
  backupCodes!: string[];
}
```

---

## Task 5: dto/index.ts 진입점

**Files:**
- Create: `services/api/src/auth/dto/index.ts`

```ts
// services/api/src/auth/dto/index.ts
export * from './login-body.dto';
export * from './backup-login-body.dto';
export * from './register-body.dto';
export * from './login-response.dto';
export * from './register-response.dto';
```

빌드 검증:
Run: `cd services/api && npm run build`
Expected: 빌드 성공.

---

## Task 6: auth.controller.ts 변환

**Files:**
- Modify: `services/api/src/auth/auth.controller.ts`

- [ ] **Step 1: 전체 재작성**

```ts
// services/api/src/auth/auth.controller.ts
import {
  Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, Req, Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiExtraModels, ApiOperation, ApiResponse, ApiTags, getSchemaPath, refs,
} from '@nestjs/swagger';
import { ApiError, type AuthUser, Cookies, CurrentUser, Public } from '@terab/common';
import { UserDto } from '../common/dto';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  AuthenticatedResponseDto,
  BackupLoginBodyDto,
  LoginBodyDto,
  type LoginResponse,
  RegisterBodyDto,
  RegisterResponseDto,
  TwoFaRequiredResponseDto,
} from './dto';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  protected REFRESH_TOKEN_COOKIE = 'refreshToken';
  protected COOKIE_PATH = '/';

  constructor(private readonly authService: AuthService) {}

  // ───── register ──────────────────────────────
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('register')
  @ApiOperation({ summary: '초대 기반 회원가입' })
  @ApiResponse({ status: HttpStatus.CREATED, type: RegisterResponseDto })
  @ApiError('INVITATION_NOT_FOUND', 'INVITATION_EXPIRED', 'INVITATION_ALREADY_USED', 'USERNAME_TAKEN', 'REGISTRATION_FAILED', 'ROLE_NOT_FOUND')
  async register(
    @Body() body: RegisterBodyDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RegisterResponseDto> {
    const { accessToken, user, backupCodes, rawRefreshToken, refreshTokenExpMs } =
      await this.authService.register(body);
    this.setRefreshTokenCookie(res, rawRefreshToken, refreshTokenExpMs);
    return { accessToken, user, backupCodes };
  }

  // ───── login (discriminated union 반환) ──────────────────────────────
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '아이디/비밀번호 로그인' })
  @ApiExtraModels(AuthenticatedResponseDto, TwoFaRequiredResponseDto)
  @ApiResponse({
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
  })
  @ApiError('INVALID_CREDENTIALS', 'ACCOUNT_DISABLED')
  async login(
    @Body() body: LoginBodyDto,
    @Cookies('trustToken') trustToken: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const { response, rawRefreshToken, refreshTokenExpMs } = await this.authService.login(
      body,
      trustToken,
      userAgent,
    );
    if (rawRefreshToken && refreshTokenExpMs) {
      this.setRefreshTokenCookie(res, rawRefreshToken, refreshTokenExpMs);
    }
    return response;
  }

  // ───── loginWithBackup ──────────────────────────────
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login/backup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '백업 코드 로그인' })
  @ApiExtraModels(AuthenticatedResponseDto, TwoFaRequiredResponseDto)
  @ApiResponse({
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
  })
  @ApiError('INVALID_CREDENTIALS', 'BACKUP_CODE_INVALID', 'ACCOUNT_DISABLED')
  async loginWithBackup(
    @Body() body: BackupLoginBodyDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const { response, rawRefreshToken, refreshTokenExpMs } =
      await this.authService.loginWithBackupCode(body);
    this.setRefreshTokenCookie(res, rawRefreshToken, refreshTokenExpMs);
    return response;
  }

  // ───── completeTwoFa ──────────────────────────────
  @Public()
  @Post('2fa/challenge/:id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '2FA 챌린지 완료' })
  @ApiExtraModels(AuthenticatedResponseDto, TwoFaRequiredResponseDto)
  @ApiResponse({
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
  })
  @ApiError('TWO_FA_CHALLENGE_NOT_FOUND')
  async completeTwoFa(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const { response, rawRefreshToken, refreshTokenExpMs } = await this.authService.completeTwoFa(id);
    this.setRefreshTokenCookie(res, rawRefreshToken, refreshTokenExpMs);
    return response;
  }

  // ───── refresh ──────────────────────────────
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '토큰 갱신' })
  @ApiExtraModels(AuthenticatedResponseDto, TwoFaRequiredResponseDto)
  @ApiResponse({
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
  })
  @ApiError('REFRESH_TOKEN_INVALID', 'TOKEN_EXPIRED', 'TOKEN_INVALID')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const rawRefreshToken = req.cookies?.[this.REFRESH_TOKEN_COOKIE] as string | undefined;
    const { response, rawRefreshToken: newRt, refreshTokenExpMs } = await this.authService.refresh(rawRefreshToken);
    this.setRefreshTokenCookie(res, newRt, refreshTokenExpMs);
    return response;
  }

  // ───── logout ──────────────────────────────
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '로그아웃' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const rawRefreshToken = req.cookies?.[this.REFRESH_TOKEN_COOKIE] as string | undefined;
    await this.authService.logout(rawRefreshToken);
    res.clearCookie(this.REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: this.COOKIE_PATH,
    });
  }

  // ───── me ──────────────────────────────
  @Get('me')
  @ApiOperation({ summary: '현재 사용자 조회' })
  @ApiResponse({ status: HttpStatus.OK, type: UserDto })
  async me(@CurrentUser() user: AuthUser): Promise<UserDto> {
    return this.authService.getCurrentUser(user.userId);
  }

  // ───── 쿠키 헬퍼 ──────────────────────────────
  private setRefreshTokenCookie(res: Response, rawToken: string, maxAgeMs: number): void {
    res.cookie(this.REFRESH_TOKEN_COOKIE, rawToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: maxAgeMs,
      path: this.COOKIE_PATH,
    });
  }
}
```

**도메인 specifics:**
- 5개 메서드(`login`/`loginWithBackup`/`completeTwoFa`/`refresh`/`me`는 200, `register`는 201, `logout`은 204)
- 4개 메서드(`login`/`loginWithBackup`/`completeTwoFa`/`refresh`)가 모두 LoginResponse union 반환 — 같은 oneOf+discriminator 블록 4회 반복
- POST 200이 4건 → `@HttpCode(HttpStatus.OK)` 모두 명시 필수
- 쿠키 처리는 기존 그대로 (`@Res({ passthrough: true })`, `setRefreshTokenCookie` 헬퍼)
- `@ApiError`는 service 실제 throw 키 점검 후 조정

- [ ] **Step 2: service throw 키 검증**

Run: `grep -n "ApiException" services/api/src/auth/auth.service.ts`
Expected: register/login/loginWithBackup/completeTwoFa/refresh/me별로 어떤 ErrorCode를 throw하는지 확인. 위 controller의 `@ApiError(...)` 인자에 누락된 키 있으면 추가, 잘못된 키 있으면 제거.

- [ ] **Step 3: 빌드**

Run: `cd services/api && npm run build`
Expected: 빌드 성공.

---

## Task 7: auth.service.ts 시그니처 갱신

**Files:**
- Modify: `services/api/src/auth/auth.service.ts`

- [ ] **Step 1: import 갱신**

`@terab/contract` import 제거, `ServerInferResponseBody` import 제거. DTO import 추가.

- [ ] **Step 2: 반환 타입 변경**

| 메서드 | After (반환) |
|---|---|
| register | `Promise<{ accessToken: string; user: UserDto; backupCodes: string[]; rawRefreshToken: string; refreshTokenExpMs: number }>` |
| login | `Promise<{ response: LoginResponse; rawRefreshToken?: string; refreshTokenExpMs?: number }>` |
| loginWithBackupCode | `Promise<{ response: LoginResponse; rawRefreshToken: string; refreshTokenExpMs: number }>` |
| completeTwoFa | `Promise<{ response: LoginResponse; rawRefreshToken: string; refreshTokenExpMs: number }>` |
| refresh | `Promise<{ response: LoginResponse; rawRefreshToken: string; refreshTokenExpMs: number }>` |
| logout | `Promise<void>` |
| getCurrentUser | `Promise<UserDto>` |

기존 service의 매개변수 타입(`LoginBody`, `BackupLoginBody`, `RegisterBody`)도 DTO로 교체.

- [ ] **Step 3: 빌드 + 테스트**

Run: `cd services/api && npm run build && npm test -- auth`
Expected: 통과.

---

## Task 8: auth.controller.spec.ts 갱신

**Files:**
- Modify: `services/api/src/auth/auth.controller.spec.ts`

- [ ] **Step 1: Phase 1 Task 4 + Phase 5 Task 5 패턴**

테스트 케이스:
- `register`: INVITATION_* 실패 케이스들, USERNAME_TAKEN, 성공 (쿠키 set 검증)
- `login`:
  - INVALID_CREDENTIALS
  - ACCOUNT_DISABLED
  - AUTHENTICATED 응답 (response status = AUTHENTICATED, accessToken·user 포함, 쿠키 set)
  - 2FA_REQUIRED 응답 (response status = 2FA_REQUIRED, challengeId·options·expiresAt 포함, **쿠키 set 안 됨**)
- `loginWithBackup`: BACKUP_CODE_INVALID 실패, 성공
- `completeTwoFa`: TWO_FA_CHALLENGE_NOT_FOUND, 성공
- `refresh`: REFRESH_TOKEN_INVALID, 성공
- `logout`: 쿠키 clearCookie 호출 검증
- `me`: 성공 케이스만

mock Response 객체:
```ts
const mockRes = {
  cookie: jest.fn(),
  clearCookie: jest.fn(),
} as unknown as Response;
```

- [ ] **Step 2: 테스트 실행**

Run: `cd services/api && npm test -- auth.controller.spec`
Expected: 통과.

---

## Task 9: API Phase 6 검증 — OpenAPI oneOf 4회 출력 확인

- [ ] **Step 1: 빌드 + 전체 테스트**

Run: `cd services/api && npm run build && npm test`
Expected: 통과.

- [ ] **Step 2: /json에서 4개 LoginResponse oneOf 확인**

Run (별도): `make api`
Run:
```bash
curl -s http://localhost:3000/json | python -c "
import sys, json
d = json.load(sys.stdin)
for path, key in [
  ('/auth/login', 'post'),
  ('/auth/login/backup', 'post'),
  ('/auth/2fa/challenge/{id}/complete', 'post'),
  ('/auth/refresh', 'post'),
]:
  op = d['paths'][path][key]
  schema = op['responses']['200']['content']['application/json']['schema']
  has_oneof = 'oneOf' in schema
  has_disc = 'discriminator' in schema
  print(f'{path}: oneOf={has_oneof} discriminator={has_disc}')
"
```
Expected: 4개 path 모두 `oneOf=True discriminator=True` 출력.

하나라도 False면 **stop** — `@ApiExtraModels` 또는 schema 객체 누락 확인.

`make api` 종료.

---

## Task 10: Web codegen + features 갱신

**Files:**
- Modify: `services/web/src/features/login-by-credentials/api/mutation.ts`
- Modify: `services/web/src/features/login-by-credentials/model/useLogin.ts`
- Modify: `services/web/src/features/login-by-2fa/api/mutation.ts`
- Modify: `services/web/src/features/register-by-invitation/api/mutation.ts`
- Modify: `services/web/src/features/register-by-invitation/model/useRegister.ts`
- Modify: `services/web/src/features/logout/api/mutation.ts`
- Modify: `services/web/src/entities/user/api/query.ts`

- [ ] **Step 1: API 기동 + codegen**

Run (별도): `make api`
Run: `cd services/web && npm run openapi:codegen`

- [ ] **Step 2: generated에서 LoginResponse union 출력 확인**

Run: `grep -A 5 "LoginResponse\|AuthenticatedResponse\|TwoFaRequiredResponse" services/web/src/shared/api/generated/types.gen.ts | head -30`
Expected: union type 또는 inline union 출력.

- [ ] **Step 3: features/login-by-credentials/api/mutation.ts 갱신**

```ts
// services/web/src/features/login-by-credentials/api/mutation.ts
import { useMutation } from '@tanstack/react-query';
import { loginMutation } from '@shared/api';

export function useLoginMutation() {
  return useMutation({ ...loginMutation() });
}
```

- [ ] **Step 4: features/login-by-credentials/model/useLogin.ts 갱신 — LoginResponse narrowing**

```ts
// services/web/src/features/login-by-credentials/model/useLogin.ts
import { useLoginMutation } from '../api/mutation';
import { useUserStore } from '@/entities';
import type { LoginBodyDto } from '@shared/api';

export function useLogin() {
  const { mutate, isPending, isError } = useLoginMutation();

  const login = (credentials: LoginBodyDto) => {
    mutate(
      { body: credentials },
      {
        onSuccess: ({ data }) => {
          if (data.status === 'AUTHENTICATED') {
            // TS narrowing: data.accessToken, data.user 접근 가능
            useUserStore.getState().setAuth(data.accessToken, data.user);
            // 메인 화면 라우팅 등
          } else if (data.status === '2FA_REQUIRED') {
            // TS narrowing: data.challengeId, data.options, data.expiresAt 접근 가능
            // 2FA 챌린지 페이지로 이동
          }
        },
      },
    );
  };

  return { login, isPending, isError };
}
```

- [ ] **Step 5: features/login-by-2fa/api/mutation.ts 갱신**

기존 ts-rest `api.auth.loginWithBackup.useMutation()`, `api.auth.completeTwoFa.useMutation()` 등을 hey-api로 변경.

```ts
import { useMutation } from '@tanstack/react-query';
import { loginWithBackupMutation, completeTwoFaMutation } from '@shared/api';

export function useLoginWithBackupMutation() {
  return useMutation({ ...loginWithBackupMutation() });
}

export function useCompleteTwoFaMutation() {
  return useMutation({ ...completeTwoFaMutation() });
}
```

> Phase 5에서 작성한 `useRespondChallengeMutation` 등은 그대로 유지. 본 Task에서는 auth 도메인 mutation만 갱신.

- [ ] **Step 6: features/register-by-invitation/api/mutation.ts 갱신**

```ts
import { useMutation } from '@tanstack/react-query';
import { registerMutation } from '@shared/api';

export function useRegisterMutation() {
  return useMutation({ ...registerMutation() });
}
```

- [ ] **Step 7: features/register-by-invitation/model/useRegister.ts 응답 구조 갱신**

기존 ts-rest `{ status, body: { accessToken, user, backupCodes } }` 사용처를 `{ data: { accessToken, user, backupCodes } }`로 변경. Zustand 액션 호출 패턴은 그대로.

Run: `cat services/web/src/features/register-by-invitation/model/useRegister.ts`

확인 후 `data.body.X` → `data.X`, `data.status === 200` → `error || !data` 또는 onSuccess 콜백으로 분리.

- [ ] **Step 8: features/logout/api/mutation.ts 갱신**

```ts
import { useMutation } from '@tanstack/react-query';
import { logoutMutation } from '@shared/api';

export function useLogoutMutation() {
  return useMutation({ ...logoutMutation() });
}
```

- [ ] **Step 9: entities/user/api/query.ts — me query 갱신**

기존:
```ts
import { api } from '@/shared/api';

// 기존 ts-rest 패턴
return api.auth.me.useQuery(...);
```

변경:
```ts
import { useQuery } from '@tanstack/react-query';
import { meOptions } from '@shared/api';

export function useMeQuery() {
  return useQuery({ ...meOptions() });
}
```

> 정확한 함수명은 generated 확인. spec §6.B.1에 따라 user 데이터는 Zustand 복제 금지 — me query로 가져와서 캐시 사용. 기존 코드가 Zustand `user`를 사용 중이면 이 단계에서 me query로 점진 마이그레이션 가능 (또는 Phase 6 범위 외로 둠).

- [ ] **Step 10: 빌드 + 테스트**

Run: `cd services/web && npm run build && npm test`
Expected: 통과. **컴파일러가 LoginResponse narrowing을 정상 검증** (status 필드 분기 안에서만 status별 필드 접근 가능).

`make api` 종료.

---

## Task 11: PUBLIC_PATHS 자동 갱신 확인

**Files:**
- 자동 갱신: `services/web/src/shared/api/generated/public-paths.gen.ts`

- [ ] **Step 1: public-paths.gen.ts 확인**

Run: `cat services/web/src/shared/api/generated/public-paths.gen.ts`
Expected: 다음 경로들이 포함되어야 함:
- `/auth/register`
- `/auth/login`
- `/auth/login/backup`
- `/auth/2fa/challenge/{id}/complete`
- `/auth/refresh`
- `/auth/logout`
- `/invitations/{token}` (Phase 1)
- `/auth/2fa/challenge/{id}/status` (Phase 5)
- `/auth/2fa/challenge/{id}/respond` (Phase 5)
- `/auth/2fa/challenge/{id}/resend` (Phase 5)

> path parameter는 OpenAPI 표현(`{token}`)으로 들어감. axios request URL과 정확히 매칭되려면 axiosInstance.ts의 PUBLIC_PATHS Set 검사 로직을 path pattern 매칭으로 처리해야 할 수 있음. 만약 현재 `Set<string>.has(url)`이 string exact match라면 path param이 있는 경로(예: `/auth/2fa/challenge/{id}/complete` vs 실제 호출 URL `/auth/2fa/challenge/abc-123/complete`)는 매칭 안 됨.

- [ ] **Step 2: PUBLIC_PATHS 매칭 로직 점검**

Run: `cat services/web/src/shared/api/axiosInstance.ts | grep -A 3 "PUBLIC_PATHS"`

`PUBLIC_PATHS.has(config.url)` 호출이 path param이 있는 경로에서 동작하지 않는 경우:

**해결책 A (간단):** 인터셉터에서 URL을 path pattern으로 변환 후 매칭. 예: `/auth/2fa/challenge/abc-123/complete` → `/auth/2fa/challenge/{id}/complete`. 단, 변환 로직이 복잡.

**해결책 B (실용):** `extract-public-paths.mjs`에서 path를 정규식으로 변환해서 export. 또는 prefix 매칭 사용.

**해결책 C (가장 깔끔):** `extract-public-paths.mjs` 출력을 정규식 Set으로 변경:

`scripts/extract-public-paths.mjs` 수정 (해결책 C):
```js
// path를 정규식으로 변환: /auth/2fa/challenge/{id}/complete → ^/auth/2fa/challenge/[^/]+/complete$
const regexes = publicPaths.map((p) => {
  const re = p.replace(/\{[^/]+\}/g, '[^/]+');
  return `^${re}$`;
});

await writeFile(
  OUTPUT_PATH,
  `// AUTO-GENERATED — DO NOT EDIT.\n` +
  `export const PUBLIC_PATH_REGEXES: ReadonlyArray<RegExp> = [\n` +
  regexes.map((r) => `  /${r}/`).join(',\n') +
  `\n];\n` +
  `export function isPublicPath(url: string): boolean {\n` +
  `  return PUBLIC_PATH_REGEXES.some((re) => re.test(url));\n` +
  `}\n`,
);
```

`axiosInstance.ts` 변경:
```ts
import { isPublicPath } from '@shared/api';   // PUBLIC_PATHS Set 대신 isPublicPath 함수

// request interceptor:
if (config.url && isPublicPath(config.url)) return config;

// response interceptor:
if (originalRequest.url && isPublicPath(originalRequest.url)) throw error;
```

`shared/api/index.ts` 갱신:
```ts
export { isPublicPath, PUBLIC_PATH_REGEXES } from './generated/public-paths.gen';
// PUBLIC_PATHS Set export 제거
```

- [ ] **Step 3: 해결책 C 적용 + 재실행**

위 변경 후:
Run (별도): `make api`
Run: `cd services/web && npm run openapi:codegen`
Run: `cat services/web/src/shared/api/generated/public-paths.gen.ts`
Expected: `isPublicPath` 함수 export 형태.

Run: `cd services/web && npm run build`
Expected: 빌드 성공.

`make api` 종료.

---

## Task 12: e2e — auth 흐름 전체 검증

`make api` + `make web` 후:
1. **회원가입**: 초대 링크 → 회원가입 폼 → 정상 가입 → 메인 화면 + accessToken·refreshToken 발급
2. **로그인 (AUTHENTICATED)**: 일반 계정 로그인 → AUTHENTICATED 응답 → 메인 화면
3. **로그인 (2FA_REQUIRED)**: 2FA 활성 계정 로그인 → 2FA_REQUIRED 응답 → 챌린지 페이지 이동 → 챌린지 응답 → completeTwoFa AUTHENTICATED → 메인 화면
4. **백업 코드 로그인**: 백업 코드로 로그인 시도 → AUTHENTICATED
5. **토큰 갱신**: accessToken 만료 후 자동 요청 → axios 인터셉터가 `/api/auth/refresh` 호출 → 새 accessToken 발급 → 원 요청 재시도 성공
6. **로그아웃**: 로그아웃 클릭 → refreshToken 쿠키 clear → 로그인 페이지 리다이렉트
7. **me query**: 인증된 상태에서 사용자 정보 표시 정상

각 흐름에서 **OpenAPI oneOf 출력 → web codegen narrowing → UI 표시**가 매끄럽게 연결되어야 함.

---

## Task 13: Phase 6 commit

```bash
git add services/api/src/auth/dto/ \
        services/api/src/auth/auth.controller.ts \
        services/api/src/auth/auth.controller.spec.ts \
        services/api/src/auth/auth.service.ts \
        services/api/src/common/dto/user.dto.ts \
        services/web/src/features/login-by-credentials/ \
        services/web/src/features/login-by-2fa/api/mutation.ts \
        services/web/src/features/register-by-invitation/ \
        services/web/src/features/logout/ \
        services/web/src/entities/user/api/ \
        services/web/src/shared/api/axiosInstance.ts \
        services/web/src/shared/api/index.ts \
        services/web/src/shared/api/generated/ \
        services/web/scripts/extract-public-paths.mjs   # 해결책 C 적용 시

git commit -m "refactor: Phase 6 — auth 도메인 전환 (LoginResponse oneOf + 쿠키/refresh 흐름 포함)"
```

---

## Phase 6 완료 조건

- [ ] UserDto, LoginBodyDto, BackupLoginBodyDto, RegisterBodyDto, LoginResponse 2개 클래스 + union type, RegisterResponseDto 모두 작성
- [ ] controller 7 메서드 모두 변환, 4 메서드에 LoginResponse oneOf+discriminator 적용, POST 200 4건 @HttpCode 명시, logout NO_CONTENT 명시
- [ ] service 시그니처 DTO/union type로 교체
- [ ] /json에서 4개 LoginResponse 응답 모두 oneOf+discriminator 출력 확인
- [ ] web codegen narrowing이 컴파일·런타임 모두 정상 동작
- [ ] PUBLIC_PATHS path-pattern 매칭 (해결책 C 적용 시 `isPublicPath` 함수)
- [ ] e2e: register/login(AUTH)/login(2FA)/login-backup/refresh/logout/me 모두 정상
- [ ] 1 commit

Phase 6 종료. **인증 핵심 흐름이 새 패턴으로 완전히 동작**. Phase 7 (file) 진입 가능.
