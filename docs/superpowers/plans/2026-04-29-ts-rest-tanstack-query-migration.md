# ts-rest + TanStack Query 마이그레이션 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모노레포 내 `packages/contracts/`에 `@terab/contracts` 패키지를 생성하고, Zod 스키마 기반 ts-rest 계약을 통해 API(`@ts-rest/nest`)와 Web(`@ts-rest/react-query`) 양측을 완전히 타입 안전하게 연결한다. 기존 수동 타입 정의 및 `axiosUser` 직접 호출 패턴을 제거하고 FSD 규칙(`{slice}/api/query.ts`, `{slice}/api/mutation.ts`)으로 통일한다.

**Architecture:** `packages/contracts/` (공유 계약 패키지) → `services/api/` (`@ts-rest/nest` TsRestHandler) + `services/web/` (`@ts-rest/react-query` initQueryClient). Docker 빌드 컨텍스트를 repo root(`.`)로 확장하여 contracts를 API/Web 모두 COPY 가능하게 한다. npm workspaces 미도입 — 로컬 경로 참조(`file:../../packages/contracts`)로 연결. contracts는 TypeScript → dist/ 빌드 후 소비한다. ts-rest 클라이언트는 기존 `axiosUser` 인스턴스를 transport로 재사용하되, 계약 경로(`/api/...`)와 `axiosUser.baseURL('/api')` 중복을 막기 위해 어댑터에서 `baseURL: ''` per-request 오버라이드를 적용한다. login/backup-login 엔드포인트는 401 → refresh → redirect 루프를 막기 위해 순수 `axios`를 사용한다.

**Tech Stack:** NestJS 11 / `@ts-rest/nest` ^3 / `@ts-rest/core` ^3 / Zod ^3 · React 19 / `@ts-rest/react-query` ^3 / `@tanstack/react-query` ^5 / Zustand / Axios · Node 24 / TypeScript 5.x

---

## 파일 맵

### 신규 생성 — packages/contracts/

```
packages/contracts/package.json
packages/contracts/tsconfig.json
packages/contracts/src/index.ts
packages/contracts/src/schemas/common.schema.ts
packages/contracts/src/schemas/invitation.schema.ts
packages/contracts/src/schemas/auth.schema.ts
packages/contracts/src/schemas/twofa.schema.ts
packages/contracts/src/schemas/device.schema.ts
packages/contracts/src/schemas/trusted-device.schema.ts
packages/contracts/src/contracts/index.ts
packages/contracts/src/contracts/invitation.contract.ts
packages/contracts/src/contracts/auth.contract.ts
packages/contracts/src/contracts/twofa.contract.ts
packages/contracts/src/contracts/device.contract.ts
packages/contracts/src/contracts/trusted-device.contract.ts
```

### 수정 — 인프라

```
services/api/Dockerfile                                          (repo root context 기준 재작성)
services/web/Dockerfile                                          (repo root context 기준 재작성)
Makefile                                                         (build-local: -f 플래그, context .)
.github/workflows/deploy.yml                                     (matrix context: ., file 지정, test jobs contracts 빌드 추가)
services/api/package.json                                        (@ts-rest/nest, @ts-rest/core, @terab/contracts 추가)
services/web/package.json                                        (@ts-rest/react-query, @tanstack/react-query, @terab/contracts 추가)
```

### 수정 — Web 공통

```
services/web/src/app/App.tsx                                     (QueryClientProvider 추가)
services/web/src/shared/api/client.ts                            (신규: initQueryClient, axiosUser 재사용)
services/web/src/shared/api/index.ts                             (client re-export 추가)
```

### 전환 — Phase 1: invitation

```
services/api/src/invitation/invitation.controller.ts             (@TsRestHandler로 교체)
services/api/src/invitation/invitation.controller.spec.ts        (supertest 통합 테스트로 재작성)
services/api/src/invitation/dto/create-invitation.dto.ts         (삭제)
services/api/src/invitation/dto/invitation-response.dto.ts       (삭제)
services/web/src/features/register-by-invitation/api/query.ts    (신규: useValidateInvitationQuery)
services/web/src/features/register-by-invitation/api/mutation.ts (신규: useRegisterMutation)
services/web/src/features/register-by-invitation/api/registerApi.ts (삭제)
services/web/src/features/register-by-invitation/model/useRegister.ts (업데이트)
```

### 전환 — Phase 2: auth

```
services/api/src/auth/auth.controller.ts                         (@TsRestHandler로 교체)
services/api/src/auth/auth.controller.spec.ts                    (supertest 통합 테스트로 재작성)
services/api/src/auth/dto/login.dto.ts                           (삭제)
services/api/src/auth/dto/login-response.dto.ts                  (삭제)
services/api/src/auth/dto/register.dto.ts                        (삭제)
services/api/src/auth/dto/register-response.dto.ts               (삭제)
services/api/src/auth/dto/backup-login.dto.ts                    (삭제)
services/api/src/auth/dto/user-response.dto.ts                   (삭제)
services/web/src/features/login-by-credentials/api/mutation.ts   (신규)
services/web/src/features/login-by-credentials/api/loginApi.ts   (삭제)
services/web/src/features/login-by-credentials/model/useLogin.ts (업데이트)
services/web/src/features/logout/api/mutation.ts                  (신규)
services/web/src/features/logout/api/logoutApi.ts                (삭제)
services/web/src/features/logout/model/useLogout.ts              (업데이트)
services/web/src/features/backup-code/api/mutation.ts            (신규: useLoginWithBackupMutation)
services/web/src/features/backup-code/api/backupCodeApi.ts       (삭제)
services/web/src/features/backup-code/model/useBackupCode.ts     (업데이트)
services/web/src/entities/user/api/query.ts                      (신규: useMeQuery)
services/web/src/entities/user/api/userApi.ts                    (삭제)
```

### 전환 — Phase 3: twofa

```
services/api/src/twofa/twofa.controller.ts                       (@TsRestHandler로 교체)
services/api/src/twofa/twofa.controller.spec.ts                  (supertest 통합 테스트로 재작성)
services/api/src/twofa/dto/challenge-status-response.dto.ts      (삭제)
services/api/src/twofa/dto/respond-challenge.dto.ts              (삭제)
services/web/src/features/login-by-2fa/api/query.ts              (신규: useChallengeStatusQuery)
services/web/src/features/login-by-2fa/api/mutation.ts           (신규: useRespondChallengeMutation, useResendChallengeMutation)
services/web/src/features/login-by-2fa/api/twoFactorApi.ts       (삭제)
services/web/src/features/login-by-2fa/model/useTwoFactorPolling.ts (업데이트)
services/web/src/features/login-by-2fa/model/useTwoFactorRespond.ts (업데이트)
```

### 전환 — Phase 4: device

```
services/api/src/device/device.controller.ts                     (@TsRestHandler로 교체)
services/api/src/device/device.controller.spec.ts                (supertest 통합 테스트로 재작성)
services/api/src/device/dto/device-response.dto.ts               (삭제)
services/api/src/device/dto/register-device.dto.ts               (삭제)
services/web/src/features/push-notification/api/query.ts         (신규: useDevicesQuery)
services/web/src/features/push-notification/api/mutation.ts      (신규: useRegisterDeviceMutation, useRemoveDeviceMutation)
services/web/src/features/push-notification/api/deviceApi.ts     (삭제)
services/web/src/features/push-notification/model/usePushNotification.ts (업데이트)
```

### 전환 — Phase 5: trusted-device

```
services/api/src/trusted-device/trusted-device.controller.ts     (@TsRestHandler로 교체)
services/api/src/trusted-device/trusted-device.controller.spec.ts (supertest 통합 테스트로 재작성)
services/api/src/trusted-device/dto/trusted-device-response.dto.ts (삭제)
services/web/src/features/trusted-device/api/query.ts            (신규: useTrustedDevicesQuery)
services/web/src/features/trusted-device/api/mutation.ts         (신규: useRegisterTrustedDeviceMutation, useRevokeTrustedDeviceMutation)
services/web/src/features/trusted-device/api/trustedDeviceApi.ts (삭제)
services/web/src/features/trusted-device/model/useTrustedDevice.ts (업데이트)
```

---

## Task 1: packages/contracts/ 패키지 초기화

- [ ] `packages/contracts/package.json` 파일을 생성한다.

```json
{
  "name": "@terab/contracts",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch"
  },
  "dependencies": {
    "@ts-rest/core": "^3.51.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.3"
  }
}
```

- [ ] `packages/contracts/tsconfig.json` 파일을 생성한다.

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] `packages/contracts/src/index.ts` 파일을 생성한다.

```typescript
export * from './schemas/common.schema';
export * from './contracts';
```

- [ ] `git add packages/contracts/package.json packages/contracts/tsconfig.json packages/contracts/src/index.ts && git commit -m "chore: contracts 패키지 스캐폴딩"`

---

## Task 2: 공통 Zod 스키마 작성

- [ ] `packages/contracts/src/schemas/common.schema.ts` 파일을 생성한다.

```typescript
import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  nickname: z.string(),
});

export type User = z.infer<typeof UserSchema>;
```

- [ ] `git add packages/contracts/src/schemas/common.schema.ts && git commit -m "feat(contracts): 공통 User Zod 스키마 추가"`

---

## Task 3: invitation 스키마 + 계약

- [ ] `packages/contracts/src/schemas/invitation.schema.ts` 파일을 생성한다.

```typescript
import { z } from 'zod';

export const CreateInvitationBodySchema = z.object({
  expiresInDays: z.number().int().min(1).max(30).optional(),
});

export const InvitationResponseSchema = z.object({
  token: z.string(),
  url: z.string(),
  expiresAt: z.coerce.date(),
});

export const ValidateInvitationResponseSchema = z.object({
  valid: z.boolean(),
});

export type CreateInvitationBody = z.infer<typeof CreateInvitationBodySchema>;
export type InvitationResponse = z.infer<typeof InvitationResponseSchema>;
export type ValidateInvitationResponse = z.infer<typeof ValidateInvitationResponseSchema>;
```

- [ ] `packages/contracts/src/contracts/invitation.contract.ts` 파일을 생성한다.

```typescript
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { CreateInvitationBodySchema, InvitationResponseSchema, ValidateInvitationResponseSchema } from '../schemas/invitation.schema';

const c = initContract();

export const invitationContract = c.router({
  create: {
    method: 'POST',
    path: '/api/invitations',
    body: CreateInvitationBodySchema,
    responses: {
      201: InvitationResponseSchema,
    },
    summary: '초대장 생성',
  },
  validate: {
    method: 'GET',
    path: '/api/invitations/:token',
    pathParams: z.object({ token: z.string() }),
    responses: {
      200: ValidateInvitationResponseSchema,
    },
    summary: '초대 토큰 유효성 검증',
  },
  deactivate: {
    method: 'DELETE',
    path: '/api/invitations/:token',
    pathParams: z.object({ token: z.string() }),
    body: z.object({}),
    responses: {
      204: z.undefined(),
    },
    summary: '초대장 비활성화',
  },
});
```

- [ ] `packages/contracts/src/contracts/index.ts` 파일을 생성한다.

```typescript
import { initContract } from '@ts-rest/core';
import { invitationContract } from './invitation.contract';

const c = initContract();

export const contract = c.router({
  invitation: invitationContract,
});

export { invitationContract };
```

- [ ] `packages/contracts/src/index.ts`를 업데이트한다.

```typescript
export * from './schemas/common.schema';
export * from './schemas/invitation.schema';
export * from './contracts';
```

- [ ] `git add packages/contracts/src/schemas/invitation.schema.ts packages/contracts/src/contracts/invitation.contract.ts packages/contracts/src/contracts/index.ts packages/contracts/src/index.ts && git commit -m "feat(contracts): invitation 스키마 및 계약 추가"`

---

## Task 4: auth 스키마 + 계약

- [ ] `packages/contracts/src/schemas/auth.schema.ts` 파일을 생성한다.

```typescript
import { z } from 'zod';
import { UserSchema } from './common.schema';

export const LoginBodySchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(255),
});

export const RegisterBodySchema = z.object({
  token: z.string().uuid(),
  username: z.string().min(1).max(50),
  nickname: z.string().min(1).max(50),
  password: z.string().min(8),
});

export const BackupLoginBodySchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(255),
  backupCode: z.string().min(1).max(20),
});

export const AuthenticatedResponseSchema = z.object({
  status: z.literal('AUTHENTICATED'),
  accessToken: z.string(),
  user: UserSchema,
});

export const TwoFaRequiredResponseSchema = z.object({
  status: z.literal('2FA_REQUIRED'),
  challengeId: z.string(),
  options: z.array(z.string()),
  expiresAt: z.coerce.date(),
});

export const LoginResponseSchema = z.discriminatedUnion('status', [AuthenticatedResponseSchema, TwoFaRequiredResponseSchema]);

export const RegisterResponseSchema = z.object({
  accessToken: z.string(),
  user: UserSchema,
  backupCodes: z.array(z.string()),
});

export type LoginBody = z.infer<typeof LoginBodySchema>;
export type RegisterBody = z.infer<typeof RegisterBodySchema>;
export type BackupLoginBody = z.infer<typeof BackupLoginBodySchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;
export type AuthenticatedResponse = z.infer<typeof AuthenticatedResponseSchema>;
export type TwoFaRequiredResponse = z.infer<typeof TwoFaRequiredResponseSchema>;
```

- [ ] `packages/contracts/src/contracts/auth.contract.ts` 파일을 생성한다.

```typescript
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { UserSchema } from '../schemas/common.schema';
import { BackupLoginBodySchema, LoginBodySchema, LoginResponseSchema, RegisterBodySchema, RegisterResponseSchema } from '../schemas/auth.schema';

const c = initContract();

export const authContract = c.router({
  register: {
    method: 'POST',
    path: '/api/auth/register',
    body: RegisterBodySchema,
    responses: {
      201: RegisterResponseSchema,
    },
    summary: '초대 기반 회원가입',
  },
  login: {
    method: 'POST',
    path: '/api/auth/login',
    body: LoginBodySchema,
    responses: {
      200: LoginResponseSchema,
    },
    summary: '아이디/비밀번호 로그인',
  },
  loginWithBackup: {
    method: 'POST',
    path: '/api/auth/login/backup',
    body: BackupLoginBodySchema,
    responses: {
      200: LoginResponseSchema,
    },
    summary: '백업 코드 로그인',
  },
  completeTwoFa: {
    method: 'POST',
    path: '/api/auth/2fa/challenge/:id/complete',
    pathParams: z.object({ id: z.string() }),
    body: z.object({}),
    responses: {
      200: LoginResponseSchema,
    },
    summary: '2FA 챌린지 완료',
  },
  refresh: {
    method: 'POST',
    path: '/api/auth/refresh',
    body: z.object({}),
    responses: {
      200: LoginResponseSchema,
    },
    summary: '토큰 갱신',
  },
  logout: {
    method: 'POST',
    path: '/api/auth/logout',
    body: z.object({}),
    responses: {
      204: z.undefined(),
    },
    summary: '로그아웃',
  },
  me: {
    method: 'GET',
    path: '/api/auth/me',
    responses: {
      200: UserSchema,
    },
    summary: '현재 사용자 조회',
  },
});
```

- [ ] `packages/contracts/src/contracts/index.ts`를 업데이트한다.

```typescript
import { initContract } from '@ts-rest/core';
import { authContract } from './auth.contract';
import { invitationContract } from './invitation.contract';

const c = initContract();

export const contract = c.router({
  auth: authContract,
  invitation: invitationContract,
});

export { authContract, invitationContract };
```

- [ ] `packages/contracts/src/index.ts`를 업데이트한다.

```typescript
export * from './schemas/common.schema';
export * from './schemas/invitation.schema';
export * from './schemas/auth.schema';
export * from './contracts';
```

- [ ] `git add packages/contracts/src/schemas/auth.schema.ts packages/contracts/src/contracts/auth.contract.ts packages/contracts/src/contracts/index.ts packages/contracts/src/index.ts && git commit -m "feat(contracts): auth 스키마 및 계약 추가"`

---

## Task 5: twofa 스키마 + 계약

- [ ] `packages/contracts/src/schemas/twofa.schema.ts` 파일을 생성한다.

```typescript
import { z } from 'zod';
import { UserSchema } from './common.schema';

export const ChallengeStatusPendingSchema = z.object({
  status: z.literal('PENDING'),
  options: z.array(z.string()),
  correctNum: z.string(),
  remainingSeconds: z.number(),
});

export const ChallengeStatusApprovedSchema = z.object({
  status: z.literal('APPROVED'),
  accessToken: z.string(),
  user: UserSchema,
});

export const ChallengeStatusDeniedSchema = z.object({
  status: z.literal('DENIED'),
});

export const ChallengeStatusExpiredSchema = z.object({
  status: z.literal('EXPIRED'),
});

export const ChallengeStatusResponseSchema = z.discriminatedUnion('status', [
  ChallengeStatusPendingSchema,
  ChallengeStatusApprovedSchema,
  ChallengeStatusDeniedSchema,
  ChallengeStatusExpiredSchema,
]);

export const RespondChallengeBodySchema = z.object({
  selectedNumber: z.string().regex(/^\d{2}$/),
});

export const ResendChallengeResponseSchema = z.object({
  challengeId: z.string(),
  options: z.array(z.string()),
  expiresAt: z.coerce.date(),
});

export type ChallengeStatusResponse = z.infer<typeof ChallengeStatusResponseSchema>;
export type RespondChallengeBody = z.infer<typeof RespondChallengeBodySchema>;
export type ResendChallengeResponse = z.infer<typeof ResendChallengeResponseSchema>;
```

- [ ] `packages/contracts/src/contracts/twofa.contract.ts` 파일을 생성한다.

```typescript
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { ChallengeStatusResponseSchema, ResendChallengeResponseSchema, RespondChallengeBodySchema } from '../schemas/twofa.schema';

const c = initContract();

export const twofaContract = c.router({
  getStatus: {
    method: 'GET',
    path: '/api/auth/2fa/challenge/:id/status',
    pathParams: z.object({ id: z.string() }),
    responses: {
      200: ChallengeStatusResponseSchema,
    },
    summary: '2FA 챌린지 상태 조회',
  },
  respond: {
    method: 'POST',
    path: '/api/auth/2fa/challenge/:id/respond',
    pathParams: z.object({ id: z.string() }),
    body: RespondChallengeBodySchema,
    responses: {
      204: z.undefined(),
    },
    summary: '2FA 챌린지 응답',
  },
  resend: {
    method: 'POST',
    path: '/api/auth/2fa/challenge/:id/resend',
    pathParams: z.object({ id: z.string() }),
    body: z.object({}),
    responses: {
      200: ResendChallengeResponseSchema,
    },
    summary: '2FA 챌린지 재발송',
  },
});
```

- [ ] `packages/contracts/src/contracts/index.ts`를 업데이트한다.

```typescript
import { initContract } from '@ts-rest/core';
import { authContract } from './auth.contract';
import { invitationContract } from './invitation.contract';
import { twofaContract } from './twofa.contract';

const c = initContract();

export const contract = c.router({
  auth: authContract,
  invitation: invitationContract,
  twofa: twofaContract,
});

export { authContract, invitationContract, twofaContract };
```

- [ ] `packages/contracts/src/index.ts`를 업데이트한다.

```typescript
export * from './schemas/common.schema';
export * from './schemas/invitation.schema';
export * from './schemas/auth.schema';
export * from './schemas/twofa.schema';
export * from './contracts';
```

- [ ] `git add packages/contracts/src/schemas/twofa.schema.ts packages/contracts/src/contracts/twofa.contract.ts packages/contracts/src/contracts/index.ts packages/contracts/src/index.ts && git commit -m "feat(contracts): twofa 스키마 및 계약 추가"`

---

## Task 6: device 스키마 + 계약

- [ ] `packages/contracts/src/schemas/device.schema.ts` 파일을 생성한다.

```typescript
import { z } from 'zod';

export const DeviceResponseSchema = z.object({
  id: z.string().uuid(),
  userAgent: z.string().optional(),
  createdAt: z.coerce.date(),
});

export const RegisterDeviceBodySchema = z.object({
  pushToken: z.string().min(1),
});

export type DeviceResponse = z.infer<typeof DeviceResponseSchema>;
export type RegisterDeviceBody = z.infer<typeof RegisterDeviceBodySchema>;
```

- [ ] `packages/contracts/src/contracts/device.contract.ts` 파일을 생성한다.

```typescript
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { DeviceResponseSchema, RegisterDeviceBodySchema } from '../schemas/device.schema';

const c = initContract();

export const deviceContract = c.router({
  register: {
    method: 'POST',
    path: '/api/devices',
    body: RegisterDeviceBodySchema,
    responses: {
      204: z.undefined(),
    },
    summary: '디바이스 등록',
  },
  list: {
    method: 'GET',
    path: '/api/devices',
    responses: {
      200: z.array(DeviceResponseSchema),
    },
    summary: '디바이스 목록 조회',
  },
  remove: {
    method: 'DELETE',
    path: '/api/devices/:id',
    pathParams: z.object({ id: z.string().uuid() }),
    body: z.object({}),
    responses: {
      204: z.undefined(),
    },
    summary: '디바이스 삭제',
  },
});
```

- [ ] `packages/contracts/src/contracts/index.ts`를 업데이트한다.

```typescript
import { initContract } from '@ts-rest/core';
import { authContract } from './auth.contract';
import { deviceContract } from './device.contract';
import { invitationContract } from './invitation.contract';
import { twofaContract } from './twofa.contract';

const c = initContract();

export const contract = c.router({
  auth: authContract,
  invitation: invitationContract,
  twofa: twofaContract,
  device: deviceContract,
});

export { authContract, deviceContract, invitationContract, twofaContract };
```

- [ ] `packages/contracts/src/index.ts`를 업데이트한다.

```typescript
export * from './schemas/common.schema';
export * from './schemas/invitation.schema';
export * from './schemas/auth.schema';
export * from './schemas/twofa.schema';
export * from './schemas/device.schema';
export * from './contracts';
```

- [ ] `git add packages/contracts/src/schemas/device.schema.ts packages/contracts/src/contracts/device.contract.ts packages/contracts/src/contracts/index.ts packages/contracts/src/index.ts && git commit -m "feat(contracts): device 스키마 및 계약 추가"`

---

## Task 7: trusted-device 스키마 + 계약

- [ ] `packages/contracts/src/schemas/trusted-device.schema.ts` 파일을 생성한다.

```typescript
import { z } from 'zod';

export const TrustedDeviceResponseSchema = z.object({
  id: z.string().uuid(),
  userAgent: z.string().optional(),
  createdAt: z.coerce.date(),
});

export type TrustedDeviceResponse = z.infer<typeof TrustedDeviceResponseSchema>;
```

- [ ] `packages/contracts/src/contracts/trusted-device.contract.ts` 파일을 생성한다.

```typescript
import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { TrustedDeviceResponseSchema } from '../schemas/trusted-device.schema';

const c = initContract();

export const trustedDeviceContract = c.router({
  list: {
    method: 'GET',
    path: '/api/trusted-device',
    responses: {
      200: z.array(TrustedDeviceResponseSchema),
    },
    summary: '신뢰 기기 목록 조회',
  },
  register: {
    method: 'POST',
    path: '/api/trusted-device',
    body: z.object({}),
    responses: {
      201: z.undefined(),
    },
    summary: '신뢰 기기 등록',
  },
  revoke: {
    method: 'DELETE',
    path: '/api/trusted-device/:id',
    pathParams: z.object({ id: z.string().uuid() }),
    body: z.object({}),
    responses: {
      204: z.undefined(),
    },
    summary: '신뢰 기기 해제',
  },
});
```

- [ ] `packages/contracts/src/contracts/index.ts`를 업데이트한다.

```typescript
import { initContract } from '@ts-rest/core';
import { authContract } from './auth.contract';
import { deviceContract } from './device.contract';
import { invitationContract } from './invitation.contract';
import { trustedDeviceContract } from './trusted-device.contract';
import { twofaContract } from './twofa.contract';

const c = initContract();

export const contract = c.router({
  auth: authContract,
  invitation: invitationContract,
  twofa: twofaContract,
  device: deviceContract,
  trustedDevice: trustedDeviceContract,
});

export { authContract, deviceContract, invitationContract, trustedDeviceContract, twofaContract };
```

- [ ] `packages/contracts/src/index.ts`를 업데이트한다.

```typescript
export * from './schemas/common.schema';
export * from './schemas/invitation.schema';
export * from './schemas/auth.schema';
export * from './schemas/twofa.schema';
export * from './schemas/device.schema';
export * from './schemas/trusted-device.schema';
export * from './contracts';
```

- [ ] `git add packages/contracts/src/schemas/trusted-device.schema.ts packages/contracts/src/contracts/trusted-device.contract.ts packages/contracts/src/contracts/index.ts packages/contracts/src/index.ts && git commit -m "feat(contracts): trusted-device 스키마 및 계약 추가"`

---

## Task 8: contracts 빌드 검증

- [ ] `cd packages/contracts && npm ci`를 실행하여 의존성을 설치한다.
- [ ] `npm run build`를 실행하여 `dist/` 디렉토리가 생성되고 `dist/index.js`, `dist/index.d.ts`가 존재하는지 확인한다.
- [ ] `node -e "const c = require('./dist/index.js'); console.log(Object.keys(c.contract))"`를 실행하여 `['auth','invitation','twofa','device','trustedDevice']`가 출력되는지 확인한다.
- [ ] `git add packages/contracts/dist && git commit -m "build(contracts): dist 초기 빌드 결과물 추가"`

---

## Task 9: Docker/CI 빌드 컨텍스트 변경

- [ ] `services/api/Dockerfile`을 repo root context 기준으로 재작성한다.

```dockerfile
FROM node:24-alpine AS contracts-builder
WORKDIR /packages/contracts
COPY packages/contracts/package*.json ./
RUN npm ci --ignore-scripts
COPY packages/contracts/tsconfig.json ./
COPY packages/contracts/src ./src
RUN npm run build

FROM node:24-alpine AS builder
WORKDIR /app
COPY services/api/package*.json ./
RUN npm ci --ignore-scripts
COPY services/api/tsconfig*.json services/api/nest-cli.json services/api/.swcrc ./
COPY services/api/src ./src
COPY --from=contracts-builder /packages/contracts/dist /packages/contracts/dist
COPY --from=contracts-builder /packages/contracts/package.json /packages/contracts/package.json
RUN npm run build

FROM node:24-alpine
WORKDIR /app
RUN apk add --no-cache bash
COPY services/api/wait-for-it.sh /usr/local/bin/wait-for-it.sh
RUN sed -i 's/\r$//' /usr/local/bin/wait-for-it.sh && chmod +x /usr/local/bin/wait-for-it.sh
COPY services/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && chmod +x /usr/local/bin/docker-entrypoint.sh
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY services/api/package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=builder /app/dist ./dist
COPY --from=builder /packages/contracts/dist /packages/contracts/dist
COPY --from=builder /packages/contracts/package.json /packages/contracts/package.json
COPY services/api/drizzle ./drizzle
RUN chown -R appuser:appgroup /app
USER appuser
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
```

- [ ] `services/web/Dockerfile`을 repo root context 기준으로 재작성한다.

```dockerfile
FROM node:24-alpine AS contracts-builder
WORKDIR /packages/contracts
COPY packages/contracts/package*.json ./
RUN npm ci --ignore-scripts
COPY packages/contracts/tsconfig.json ./
COPY packages/contracts/src ./src
RUN npm run build

FROM node:24-alpine AS builder
WORKDIR /app
COPY services/web/package*.json ./
RUN npm ci
COPY --from=contracts-builder /packages/contracts/dist /packages/contracts/dist
COPY --from=contracts-builder /packages/contracts/package.json /packages/contracts/package.json
COPY services/web .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY services/web/nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] `Makefile`의 `build-local` 타겟을 수정한다.

```makefile
.PHONY: build-local
build-local:
	docker build -t terab-api:local -f services/api/Dockerfile .
	docker build -t terab-mq:local ./services/mq
	docker build -t terab-web:local -f services/web/Dockerfile .
```

- [ ] `.github/workflows/deploy.yml`의 `build-and-push` 잡 matrix를 수정한다.

```yaml
strategy:
  matrix:
    include:
      - service: api
        context: .
        file: services/api/Dockerfile
      - service: mq
        context: ./services/mq
        file: services/mq/Dockerfile
      - service: web
        context: .
        file: services/web/Dockerfile
```

- [ ] `.github/workflows/deploy.yml`의 `build-and-push` 잡 내 `Build and push` step을 수정한다.

```yaml
- name: Build and push
  uses: docker/build-push-action@v6
  with:
    context: ${{ matrix.context }}
    file: ${{ matrix.file }}
    push: true
    tags: ${{ steps.meta.outputs.tags }}
    labels: ${{ steps.meta.outputs.labels }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

- [ ] `.github/workflows/deploy.yml`의 `test-api` 잡에 contracts 빌드 step을 추가한다. `Api build & type check` step 이전에 삽입한다.

```yaml
- name: Set up Node 24 (contracts)
  uses: actions/setup-node@v6
  with:
    node-version: 24
    cache: npm
    cache-dependency-path: packages/contracts/package-lock.json

- name: Build contracts
  working-directory: packages/contracts
  run: |
    npm ci
    npm run build
```

- [ ] `.github/workflows/deploy.yml`의 `test-web` 잡에도 동일한 contracts 빌드 step을 추가한다. `Frontend build & type check` step 이전에 삽입한다.

```yaml
- name: Set up Node 24 (contracts)
  uses: actions/setup-node@v6
  with:
    node-version: 24
    cache: npm
    cache-dependency-path: packages/contracts/package-lock.json

- name: Build contracts
  working-directory: packages/contracts
  run: |
    npm ci
    npm run build
```

- [ ] `git add services/api/Dockerfile services/web/Dockerfile Makefile .github/workflows/deploy.yml && git commit -m "chore: Docker 빌드 컨텍스트를 repo root로 확장 및 CI contracts 빌드 추가"`

---

## Task 10: API 의존성 추가

- [ ] `services/api/package.json`의 `dependencies`에 다음을 추가한다.

```json
"@ts-rest/core": "^3.51.0",
"@ts-rest/nest": "^3.51.0",
"@terab/contracts": "file:../../packages/contracts"
```

- [ ] `cd services/api && npm install`을 실행한다.
- [ ] `npm run build`를 실행하여 타입 오류가 없는지 확인한다.
- [ ] `git add services/api/package.json services/api/package-lock.json && git commit -m "chore(api): @ts-rest/nest 및 @terab/contracts 의존성 추가"`

---

## Task 11: Web 의존성 추가 + QueryClientProvider

- [ ] `services/web/package.json`의 `dependencies`에 다음을 추가한다.

```json
"@tanstack/react-query": "^5.75.0",
"@ts-rest/core": "^3.51.0",
"@ts-rest/react-query": "^3.51.0",
"@terab/contracts": "file:../../packages/contracts"
```

- [ ] `cd services/web && npm install`을 실행한다.

- [ ] `services/web/src/app/App.tsx`를 수정하여 `QueryClientProvider`를 추가한다. `AppShell.tsx`는 `<Outlet />`을 반환하는 라우트 레이아웃 컴포넌트이므로 `QueryClientProvider`는 라우터를 감싸는 위치인 `App.tsx`에 추가한다.

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './providers';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>
);

export default App;
```

- [ ] `git add services/web/package.json services/web/package-lock.json services/web/src/app/App.tsx && git commit -m "chore(web): @ts-rest/react-query 및 QueryClientProvider 추가"`

---

## Task 12: shared/api/client.ts 생성

**설계 결정:**
- `axiosUser`는 `baseURL: '/api'`로 생성되어 있고 계약 경로는 `/api/auth/login` 형식이다. 그대로 사용하면 `/api/api/auth/login`이 되므로 어댑터 내 per-request `baseURL: ''`로 오버라이드한다.
- `axiosUser`의 401 → refresh → redirect 인터셉터는 로그인/백업 로그인 엔드포인트에서 무한 루프를 유발하므로 해당 경로는 순수 `axios`(인스턴스 미생성, 기본 싱글턴)를 사용한다.
- CLAUDE.md 규칙("axios 인스턴스: `shared/api/axiosInstance.ts` — 이 외 경로에 인스턴스 생성 금지")에 따라 `axios.create()` 호출 없이 기본 `axios` 싱글턴을 사용한다.

- [ ] `services/web/src/shared/api/client.ts` 파일을 생성한다.

```typescript
import axios from 'axios';
import { initQueryClient } from '@ts-rest/react-query';
import { contract } from '@terab/contracts';
import { axiosUser } from './axiosInstance';

// 401 → refresh → redirect 루프를 막아야 하는 공개 엔드포인트
const PUBLIC_PATHS = new Set(['/api/auth/login', '/api/auth/login/backup']);

export const tsRestClient = initQueryClient(contract, {
  baseUrl: '',
  baseHeaders: {},
  api: async ({ path, method, headers, body }) => {
    const instance = PUBLIC_PATHS.has(path) ? axios : axiosUser;
    const response = await instance.request({
      url: path,
      baseURL: '',
      withCredentials: true,
      method,
      headers,
      data: body,
    });
    return { status: response.status, body: response.data, headers: response.headers as Headers };
  },
});
```

- [ ] `services/web/src/shared/api/index.ts`를 업데이트한다.

```typescript
export * from './axiosInstance';
export * from './client';
```

- [ ] `git add services/web/src/shared/api/client.ts services/web/src/shared/api/index.ts && git commit -m "feat(web/shared): ts-rest QueryClient 초기화 및 axiosUser 연결"`

---

## Task 13: Phase 1 — invitation API 컨트롤러 전환

`@TsRestHandler`는 HTTP 파이프라인 인터셉터가 Zod 파싱을 처리한 뒤 핸들러를 호출하므로, 컨트롤러 테스트는 실제 HTTP 레이어가 필요하다. `supertest`를 사용한 통합 테스트로 작성한다.

- [ ] `services/api/src/invitation/invitation.controller.spec.ts`를 아래와 같이 재작성한다.

```typescript
import { INestApplication, ExecutionContext } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { TsRestModule } from '@ts-rest/nest';
import * as request from 'supertest';
import { InvitationController } from './invitation.controller';
import { InvitationService } from './invitation.service';

const mockUser = { userId: 'user-id', username: 'admin', permissions: ['user:invite', 'user:manage'] };

const mockInvitationService = {
  create: jest.fn(),
  validate: jest.fn(),
  deactivate: jest.fn(),
};

describe('InvitationController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [TsRestModule.register({ isGlobal: true })],
      controllers: [InvitationController],
      providers: [
        { provide: InvitationService, useValue: mockInvitationService },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (ctx: ExecutionContext) => {
              ctx.switchToHttp().getRequest().user = mockUser;
              return true;
            },
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  it('컨트롤러가 정의되어 있다', () => {
    expect(app).toBeDefined();
  });

  it('POST /api/invitations — 초대장을 생성하고 201을 반환한다', async () => {
    const fakeResult = {
      token: 'tok-uuid',
      url: 'https://example.com/invite/tok-uuid',
      expiresAt: new Date('2026-05-10T00:00:00.000Z'),
    };
    mockInvitationService.create.mockResolvedValue(fakeResult);

    const res = await request(app.getHttpServer())
      .post('/api/invitations')
      .send({ expiresInDays: 7 })
      .expect(201);

    expect(mockInvitationService.create).toHaveBeenCalledWith('user-id', 7);
    expect(res.body.token).toBe('tok-uuid');
  });

  it('GET /api/invitations/:token — valid: true를 반환한다', async () => {
    mockInvitationService.validate.mockResolvedValue(true);

    const res = await request(app.getHttpServer())
      .get('/api/invitations/tok-uuid')
      .expect(200);

    expect(mockInvitationService.validate).toHaveBeenCalledWith('tok-uuid');
    expect(res.body).toEqual({ valid: true });
  });

  it('DELETE /api/invitations/:token — 204를 반환한다', async () => {
    mockInvitationService.deactivate.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .delete('/api/invitations/tok-uuid')
      .expect(204);

    expect(mockInvitationService.deactivate).toHaveBeenCalledWith('tok-uuid');
  });
});
```

- [ ] `npm test -- --testPathPattern=invitation.controller` 테스트가 실패하는 것을 확인한다 (아직 구현 전).

- [ ] `services/api/src/invitation/invitation.controller.ts`를 TsRestHandler로 교체한다. 기존 `@Throttle`은 `validate` 엔드포인트에 유지한다.

```typescript
import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Throttle } from '@nestjs/throttler';
import { contract } from '@terab/contracts';
import { CurrentUser, Public, RequirePermission } from '@terab/common';
import type { AuthUser } from '../auth/types/auth-user.type';
import { InvitationService } from './invitation.service';

@Controller()
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @RequirePermission('user:invite')
  @TsRestHandler(contract.invitation.create)
  async handleCreate(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.invitation.create, async ({ body }) => {
      const result = await this.invitationService.create(user.userId, body.expiresInDays);
      return { status: 201 as const, body: result };
    });
  }

  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Public()
  @TsRestHandler(contract.invitation.validate)
  async handleValidate() {
    return tsRestHandler(contract.invitation.validate, async ({ params }) => {
      const valid = await this.invitationService.validate(params.token);
      return { status: 200 as const, body: { valid } };
    });
  }

  @RequirePermission('user:manage')
  @TsRestHandler(contract.invitation.deactivate)
  async handleDeactivate() {
    return tsRestHandler(contract.invitation.deactivate, async ({ params }) => {
      await this.invitationService.deactivate(params.token);
      return { status: 204 as const, body: undefined };
    });
  }
}
```

- [ ] `npm test -- --testPathPattern=invitation.controller` 테스트가 통과하는지 확인한다.
- [ ] `services/api/src/invitation/dto/create-invitation.dto.ts`를 삭제한다.
- [ ] `services/api/src/invitation/dto/invitation-response.dto.ts`를 삭제한다.
- [ ] `npm run build`를 실행하여 타입 오류가 없는지 확인한다.
- [ ] `git add services/api/src/invitation/ && git commit -m "feat(api): invitation 컨트롤러 @TsRestHandler로 전환"`

---

## Task 14: Phase 1 — invitation Web 전환

- [ ] `services/web/src/features/register-by-invitation/api/query.ts` 파일을 생성한다.

```typescript
import { tsRestClient } from '@/shared/api';

export function useValidateInvitationQuery(token: string) {
  return tsRestClient.invitation.validate.useQuery(
    ['invitation', 'validate', token],
    { params: { token } },
    {
      enabled: !!token,
      retry: false,
      staleTime: 1000 * 30,
    },
  );
}
```

- [ ] `services/web/src/features/register-by-invitation/api/mutation.ts` 파일을 생성한다.

```typescript
import { tsRestClient } from '@/shared/api';

export function useRegisterMutation() {
  return tsRestClient.auth.register.useMutation();
}
```

- [ ] `services/web/src/features/register-by-invitation/model/useRegister.ts`를 업데이트한다. 기존 파일을 먼저 읽고 import 경로와 store 호출 방식을 유지한다.

```typescript
import { useUserStore } from '@/entities';
import { useNavigate } from 'react-router-dom';
import { useRegisterMutation } from '../api/mutation';

export interface RegisterFormValues {
  username: string;
  nickname: string;
  password: string;
  passwordConfirm: string;
}

export function useRegister(token: string, onSuccess: (backupCodes: string[]) => void) {
  const setAuth = useUserStore((s) => s.setAuth);
  const navigate = useNavigate();
  const mutation = useRegisterMutation();

  const submit = (values: RegisterFormValues) => {
    mutation.mutate(
      {
        body: {
          token,
          username: values.username,
          nickname: values.nickname,
          password: values.password,
        },
      },
      {
        onSuccess: (response) => {
          if (response.status === 201) {
            setAuth(response.body.accessToken, response.body.user);
            onSuccess(response.body.backupCodes);
          }
        },
      },
    );
  };

  return {
    submit,
    isLoading: mutation.isPending,
    error: mutation.isError ? { code: 'UNKNOWN', message: '회원가입에 실패했습니다.' } : null,
  };
}
```

- [ ] `services/web/src/features/register-by-invitation/api/registerApi.ts`를 삭제한다.
- [ ] `git add services/web/src/features/register-by-invitation/ && git commit -m "feat(web): register-by-invitation ts-rest 훅으로 전환"`

---

## Task 15: Phase 2 — auth API 컨트롤러 전환

- [ ] `services/api/src/auth/auth.controller.spec.ts`를 supertest 기반으로 재작성한다.

```typescript
import { INestApplication, ExecutionContext } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { TsRestModule } from '@ts-rest/nest';
import * as request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockUser = { userId: 'uid', username: 'user1', permissions: [] };

const fakeUser = { id: 'uid', username: 'user1', nickname: 'User' };

const authenticatedResult = {
  response: { status: 'AUTHENTICATED' as const, accessToken: 'at.token', user: fakeUser },
  rawRefreshToken: 'raw.rt',
  refreshTokenExpMs: 604800000,
};

const mockAuthService = {
  register: jest.fn().mockResolvedValue({
    accessToken: 'at.token',
    user: fakeUser,
    backupCodes: ['code1', 'code2'],
    rawRefreshToken: 'raw.rt',
    refreshTokenExpMs: 604800000,
  }),
  login: jest.fn().mockResolvedValue(authenticatedResult),
  loginWithBackupCode: jest.fn().mockResolvedValue(authenticatedResult),
  completeTwoFa: jest.fn().mockResolvedValue(authenticatedResult),
  refresh: jest.fn().mockResolvedValue(authenticatedResult),
  logout: jest.fn().mockResolvedValue(undefined),
  getCurrentUser: jest.fn().mockResolvedValue(fakeUser),
};

describe('AuthController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [TsRestModule.register({ isGlobal: true })],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (ctx: ExecutionContext) => {
              ctx.switchToHttp().getRequest().user = mockUser;
              return true;
            },
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  it('POST /api/auth/login — RT 쿠키를 설정하고 AUTHENTICATED 응답을 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'user1', password: 'pass' })
      .expect(200);

    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.body.status).toBe('AUTHENTICATED');
    expect(res.body.accessToken).toBe('at.token');
  });

  it('POST /api/auth/logout — RT 쿠키를 삭제하고 204를 반환한다', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .send({})
      .expect(204);

    expect(mockAuthService.logout).toHaveBeenCalled();
  });

  it('POST /api/auth/2fa/challenge/:id/complete — RT 쿠키를 설정하고 AUTHENTICATED 응답을 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/2fa/challenge/challenge-id/complete')
      .send({})
      .expect(200);

    expect(mockAuthService.completeTwoFa).toHaveBeenCalledWith('challenge-id');
    expect(res.body.status).toBe('AUTHENTICATED');
  });

  it('GET /api/auth/me — 현재 사용자를 반환한다', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .expect(200);

    expect(mockAuthService.getCurrentUser).toHaveBeenCalledWith('uid');
    expect(res.body.id).toBe('uid');
  });
});
```

- [ ] `npm test -- --testPathPattern=auth.controller` 테스트가 실패하는 것을 확인한다.

- [ ] `services/api/src/auth/auth.controller.ts`를 TsRestHandler로 교체한다.

```typescript
import { Controller, Req, Res } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@terab/contracts';
import { Cookies, CurrentUser, Public } from '@terab/common';
import type { Request, Response } from 'express';
import type { AuthUser } from './types/auth-user.type';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  private readonly REFRESH_TOKEN_COOKIE = 'refreshToken';
  private readonly COOKIE_PATH = '/api/auth';

  constructor(private readonly authService: AuthService) {}

  @Public()
  @TsRestHandler(contract.auth.register)
  async handleRegister(@Res({ passthrough: true }) res: Response) {
    return tsRestHandler(contract.auth.register, async ({ body }) => {
      const { accessToken, user, backupCodes, rawRefreshToken, refreshTokenExpMs } = await this.authService.register(body);
      this.setRefreshTokenCookie(res, rawRefreshToken, refreshTokenExpMs);
      return { status: 201 as const, body: { accessToken, user, backupCodes } };
    });
  }

  @Public()
  @TsRestHandler(contract.auth.login)
  async handleLogin(
    @Cookies('trustToken') trustToken: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return tsRestHandler(contract.auth.login, async ({ body }) => {
      const userAgent = req.headers['user-agent'];
      const { response, rawRefreshToken, refreshTokenExpMs } = await this.authService.login(body, trustToken, userAgent);
      if (rawRefreshToken && refreshTokenExpMs) {
        this.setRefreshTokenCookie(res, rawRefreshToken, refreshTokenExpMs);
      }
      return { status: 200 as const, body: response };
    });
  }

  @Public()
  @TsRestHandler(contract.auth.loginWithBackup)
  async handleLoginWithBackup(@Res({ passthrough: true }) res: Response) {
    return tsRestHandler(contract.auth.loginWithBackup, async ({ body }) => {
      const { response, rawRefreshToken, refreshTokenExpMs } = await this.authService.loginWithBackupCode(body);
      this.setRefreshTokenCookie(res, rawRefreshToken, refreshTokenExpMs);
      return { status: 200 as const, body: response };
    });
  }

  @Public()
  @TsRestHandler(contract.auth.completeTwoFa)
  async handleCompleteTwoFa(@Res({ passthrough: true }) res: Response) {
    return tsRestHandler(contract.auth.completeTwoFa, async ({ params }) => {
      const { response, rawRefreshToken, refreshTokenExpMs } = await this.authService.completeTwoFa(params.id);
      this.setRefreshTokenCookie(res, rawRefreshToken, refreshTokenExpMs);
      return { status: 200 as const, body: response };
    });
  }

  @Public()
  @TsRestHandler(contract.auth.refresh)
  async handleRefresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return tsRestHandler(contract.auth.refresh, async () => {
      const rawRefreshToken = req.cookies?.[this.REFRESH_TOKEN_COOKIE] as string | undefined;
      const { response, rawRefreshToken: newRt, refreshTokenExpMs } = await this.authService.refresh(rawRefreshToken);
      this.setRefreshTokenCookie(res, newRt, refreshTokenExpMs);
      return { status: 200 as const, body: response };
    });
  }

  @Public()
  @TsRestHandler(contract.auth.logout)
  async handleLogout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return tsRestHandler(contract.auth.logout, async () => {
      const rawRefreshToken = req.cookies?.[this.REFRESH_TOKEN_COOKIE] as string | undefined;
      await this.authService.logout(rawRefreshToken);
      res.clearCookie(this.REFRESH_TOKEN_COOKIE, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: this.COOKIE_PATH,
      });
      return { status: 204 as const, body: undefined };
    });
  }

  @TsRestHandler(contract.auth.me)
  async handleMe(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.auth.me, async () => {
      const result = await this.authService.getCurrentUser(user.userId);
      return { status: 200 as const, body: result };
    });
  }

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

- [ ] `npm test -- --testPathPattern=auth.controller` 테스트가 통과하는지 확인한다.
- [ ] `services/api/src/auth/dto/login.dto.ts`를 삭제한다.
- [ ] `services/api/src/auth/dto/login-response.dto.ts`를 삭제한다.
- [ ] `services/api/src/auth/dto/register.dto.ts`를 삭제한다.
- [ ] `services/api/src/auth/dto/register-response.dto.ts`를 삭제한다.
- [ ] `services/api/src/auth/dto/backup-login.dto.ts`를 삭제한다.
- [ ] `services/api/src/auth/dto/user-response.dto.ts`를 삭제한다.
- [ ] `npm run build`를 실행하여 타입 오류가 없는지 확인한다.
- [ ] `git add services/api/src/auth/ && git commit -m "feat(api): auth 컨트롤러 @TsRestHandler로 전환"`

---

## Task 16: Phase 2 — auth Web 전환

- [ ] `services/web/src/features/login-by-credentials/api/mutation.ts` 파일을 생성한다.

```typescript
import { tsRestClient } from '@/shared/api';

export function useLoginMutation() {
  return tsRestClient.auth.login.useMutation();
}
```

- [ ] `services/web/src/features/login-by-credentials/model/useLogin.ts`를 업데이트한다. 기존 파일을 먼저 읽어 import 경로와 navigate 경로를 확인하고 유지한다.

```typescript
import { useUserStore } from '@/entities';
import { useNavigate } from 'react-router-dom';
import { useLoginMutation } from '../api/mutation';

export interface LoginCredentials {
  username: string;
  password: string;
}

export function useLogin() {
  const setAuth = useUserStore((s) => s.setAuth);
  const navigate = useNavigate();
  const mutation = useLoginMutation();

  const login = (credentials: LoginCredentials) => {
    mutation.mutate(
      { body: credentials },
      {
        onSuccess: (response) => {
          if (response.status === 200) {
            const data = response.body;
            if (data.status === 'AUTHENTICATED') {
              setAuth(data.accessToken, data.user);
              navigate('/drive');
            } else if (data.status === '2FA_REQUIRED') {
              navigate(`/login/2fa?id=${data.challengeId}`);
            }
          }
        },
      },
    );
  };

  return {
    login,
    isLoading: mutation.isPending,
    error: mutation.isError ? { code: 'UNKNOWN' as const, message: '로그인에 실패했습니다.' } : null,
    resetError: mutation.reset,
  };
}
```

- [ ] `services/web/src/features/login-by-credentials/api/loginApi.ts`를 삭제한다.

- [ ] `services/web/src/features/logout/api/mutation.ts` 파일을 생성한다.

```typescript
import { tsRestClient } from '@/shared/api';

export function useLogoutMutation() {
  return tsRestClient.auth.logout.useMutation();
}
```

- [ ] `services/web/src/features/logout/model/useLogout.ts`를 업데이트한다. 기존 파일을 먼저 읽어 import 경로와 navigate 경로를 유지한다.

```typescript
import { useUserStore } from '@/entities';
import { useNavigate } from 'react-router-dom';
import { useLogoutMutation } from '../api/mutation';

export function useLogout() {
  const navigate = useNavigate();
  const clearAuth = useUserStore((s) => s.clearAuth);
  const mutation = useLogoutMutation();

  const logout = () => {
    mutation.mutate(
      { body: {} },
      {
        onSettled: () => {
          clearAuth();
          navigate('/login');
        },
      },
    );
  };

  return { logout };
}
```

- [ ] `services/web/src/features/logout/api/logoutApi.ts`를 삭제한다.

- [ ] `services/web/src/features/backup-code/api/mutation.ts` 파일을 생성한다.

```typescript
import { tsRestClient } from '@/shared/api';

export function useLoginWithBackupMutation() {
  return tsRestClient.auth.loginWithBackup.useMutation();
}
```

- [ ] `services/web/src/features/backup-code/model/useBackupCode.ts`를 업데이트한다. 기존 파일을 먼저 읽어 navigate 경로와 기존 인터페이스를 확인하고 유지한다.

```typescript
import { useUserStore } from '@/entities';
import { useNavigate } from 'react-router-dom';
import { useLoginWithBackupMutation } from '../api/mutation';

export function useBackupCode() {
  const setAuth = useUserStore((s) => s.setAuth);
  const navigate = useNavigate();
  const mutation = useLoginWithBackupMutation();

  const loginWithBackup = (username: string, password: string, backupCode: string) => {
    mutation.mutate(
      { body: { username, password, backupCode } },
      {
        onSuccess: (response) => {
          if (response.status === 200) {
            const data = response.body;
            if (data.status === 'AUTHENTICATED') {
              setAuth(data.accessToken, data.user);
              navigate('/drive');
            }
          }
        },
      },
    );
  };

  return {
    loginWithBackup,
    isLoading: mutation.isPending,
    error: mutation.isError ? { code: 'UNKNOWN' as const, message: '백업 코드 로그인에 실패했습니다.' } : null,
  };
}
```

- [ ] `services/web/src/features/backup-code/api/backupCodeApi.ts`를 삭제한다.

- [ ] `services/web/src/entities/user/api/query.ts` 파일을 생성한다.

```typescript
import { tsRestClient } from '@/shared/api';

export function useMeQuery() {
  return tsRestClient.auth.me.useQuery(['auth', 'me'], {}, { staleTime: 1000 * 60 * 5 });
}
```

- [ ] `services/web/src/entities/user/api/userApi.ts`를 삭제한다.
- [ ] `git add services/web/src/features/login-by-credentials/ services/web/src/features/logout/ services/web/src/features/backup-code/ services/web/src/entities/user/api/ && git commit -m "feat(web): auth 도메인 ts-rest 훅으로 전환"`

---

## Task 17: Phase 3 — twofa 전환 (API + Web)

- [ ] `services/api/src/twofa/twofa.controller.spec.ts`를 supertest 기반으로 재작성한다.

```typescript
import { INestApplication, ExecutionContext } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { TsRestModule } from '@ts-rest/nest';
import * as request from 'supertest';
import { TwoFaController } from './twofa.controller';
import { TwoFaService } from './twofa.service';

const mockUser = { userId: 'user-id', username: 'user1', permissions: [] };

const mockTwoFaService = {
  getStatus: jest.fn(),
  respond: jest.fn(),
  resend: jest.fn(),
};

describe('TwoFaController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [TsRestModule.register({ isGlobal: true })],
      controllers: [TwoFaController],
      providers: [
        { provide: TwoFaService, useValue: mockTwoFaService },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (ctx: ExecutionContext) => {
              ctx.switchToHttp().getRequest().user = mockUser;
              return true;
            },
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  it('GET /api/auth/2fa/challenge/:id/status — PENDING 상태를 반환한다', async () => {
    const pendingStatus = {
      status: 'PENDING' as const,
      options: ['47', '82', '13'],
      correctNum: '47',
      remainingSeconds: 55,
    };
    mockTwoFaService.getStatus.mockResolvedValue(pendingStatus);

    const res = await request(app.getHttpServer())
      .get('/api/auth/2fa/challenge/challenge-id/status')
      .expect(200);

    expect(mockTwoFaService.getStatus).toHaveBeenCalledWith('challenge-id');
    expect(res.body.status).toBe('PENDING');
    expect(res.body.correctNum).toBe('47');
  });

  it('POST /api/auth/2fa/challenge/:id/respond — 204를 반환한다', async () => {
    mockTwoFaService.respond.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .post('/api/auth/2fa/challenge/challenge-id/respond')
      .send({ selectedNumber: '47' })
      .expect(204);

    expect(mockTwoFaService.respond).toHaveBeenCalledWith('challenge-id', 'user-id', '47');
  });

  it('POST /api/auth/2fa/challenge/:id/resend — 새 challengeId를 반환한다', async () => {
    const resendResult = { id: 'new-challenge-id', options: ['47', '82', '13'], expiresAt: new Date() };
    mockTwoFaService.resend.mockResolvedValue(resendResult);

    const res = await request(app.getHttpServer())
      .post('/api/auth/2fa/challenge/old-id/resend')
      .send({})
      .expect(200);

    expect(res.body.challengeId).toBe('new-challenge-id');
  });
});
```

- [ ] `npm test -- --testPathPattern=twofa.controller` 테스트가 실패하는 것을 확인한다.

- [ ] `services/api/src/twofa/twofa.controller.ts`를 TsRestHandler로 교체한다. 기존 파일을 먼저 읽어 TwoFaService 메서드 시그니처를 확인한다.

```typescript
import { Controller } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@terab/contracts';
import { CurrentUser, Public } from '@terab/common';
import type { AuthUser } from '../auth/types/auth-user.type';
import { TwoFaService } from './twofa.service';

@Controller()
export class TwoFaController {
  constructor(private readonly twoFaService: TwoFaService) {}

  @Public()
  @TsRestHandler(contract.twofa.getStatus)
  async handleGetStatus() {
    return tsRestHandler(contract.twofa.getStatus, async ({ params }) => {
      const result = await this.twoFaService.getStatus(params.id);
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(contract.twofa.respond)
  async handleRespond(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.twofa.respond, async ({ params, body }) => {
      await this.twoFaService.respond(params.id, user.userId, body.selectedNumber);
      return { status: 204 as const, body: undefined };
    });
  }

  @Public()
  @TsRestHandler(contract.twofa.resend)
  async handleResend() {
    return tsRestHandler(contract.twofa.resend, async ({ params }) => {
      const result = await this.twoFaService.resend(params.id);
      return {
        status: 200 as const,
        body: {
          challengeId: result.id,
          options: result.options,
          expiresAt: result.expiresAt,
        },
      };
    });
  }
}
```

- [ ] `npm test -- --testPathPattern=twofa.controller` 테스트가 통과하는지 확인한다.
- [ ] `services/api/src/twofa/dto/challenge-status-response.dto.ts`를 삭제한다.
- [ ] `services/api/src/twofa/dto/respond-challenge.dto.ts`를 삭제한다.
- [ ] `npm run build`를 실행하여 타입 오류가 없는지 확인한다 (api).

- [ ] `services/web/src/features/login-by-2fa/api/query.ts` 파일을 생성한다.

```typescript
import { tsRestClient } from '@/shared/api';

export function useChallengeStatusQuery(challengeId: string, enabled: boolean) {
  return tsRestClient.twofa.getStatus.useQuery(
    ['twofa', 'status', challengeId],
    { params: { id: challengeId } },
    {
      enabled: enabled && !!challengeId,
      refetchInterval: 3000,
      retry: false,
    },
  );
}
```

- [ ] `services/web/src/features/login-by-2fa/api/mutation.ts` 파일을 생성한다.

```typescript
import { tsRestClient } from '@/shared/api';

export function useRespondChallengeMutation() {
  return tsRestClient.twofa.respond.useMutation();
}

export function useResendChallengeMutation() {
  return tsRestClient.twofa.resend.useMutation();
}

export function useCompleteTwoFaMutation() {
  return tsRestClient.auth.completeTwoFa.useMutation();
}
```

- [ ] `services/web/src/features/login-by-2fa/model/useTwoFactorPolling.ts`를 업데이트한다. 기존 파일을 먼저 읽어 navigate 경로와 store 호출을 확인한다.

  **주의:** TanStack Query v5에서 `useQuery` 옵션의 `onSuccess`/`onError`가 제거됐다. 상태 변화 감지는 `useEffect`로 처리한다. `completeTwoFa`는 `useMutation` 훅으로 정의한 뒤 `mutateAsync`로 호출한다.

```typescript
import { useUserStore } from '@/entities';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompleteTwoFaMutation, useResendChallengeMutation } from '../api/mutation';
import { useChallengeStatusQuery } from '../api/query';

export function useTwoFactorPolling(initialChallengeId: string) {
  const [challengeId, setChallengeId] = useState(initialChallengeId);
  const [pollEnabled, setPollEnabled] = useState(true);
  const setAuth = useUserStore((s) => s.setAuth);
  const navigate = useNavigate();
  const resendMutation = useResendChallengeMutation();
  const completeMutation = useCompleteTwoFaMutation();

  const { data } = useChallengeStatusQuery(challengeId, pollEnabled);

  useEffect(() => {
    if (!data || data.status !== 200) return;
    const body = data.body;

    if (body.status === 'APPROVED') {
      setPollEnabled(false);
      completeMutation
        .mutateAsync({ params: { id: challengeId }, body: {} })
        .then((completeRes) => {
          if (completeRes.status === 200 && completeRes.body.status === 'AUTHENTICATED') {
            setAuth(completeRes.body.accessToken, completeRes.body.user);
            navigate('/drive');
          }
        })
        .catch(() => navigate('/login?error=2fa_failed'));
    } else if (body.status === 'DENIED' || body.status === 'EXPIRED') {
      setPollEnabled(false);
      navigate('/login?error=2fa_denied');
    }
  }, [data]);

  const pendingData = data?.status === 200 && data.body.status === 'PENDING' ? data.body : null;

  const resend = () => {
    resendMutation.mutate(
      { params: { id: challengeId }, body: {} },
      {
        onSuccess: (response) => {
          if (response.status === 200) {
            setChallengeId(response.body.challengeId);
            setPollEnabled(true);
          }
        },
      },
    );
  };

  return {
    options: pendingData?.options ?? [],
    correctNum: pendingData?.correctNum ?? '',
    remainingSeconds: pendingData?.remainingSeconds ?? 0,
    resend,
  };
}
```

- [ ] `services/web/src/features/login-by-2fa/model/useTwoFactorRespond.ts`를 업데이트한다. 기존 파일을 먼저 읽어 navigate 경로를 확인한다.

  **주의:** TanStack Query v5에서 `useQuery` 옵션의 `onSuccess`/`onError`가 제거됐다. `useEffect`로 대체한다.

```typescript
import { useState, useEffect } from 'react';
import { useRespondChallengeMutation } from '../api/mutation';
import { useChallengeStatusQuery } from '../api/query';

type RespondStatus = 'loading' | 'selecting' | 'done' | 'expired';

export function useTwoFactorRespond(challengeId: string) {
  const [respondStatus, setRespondStatus] = useState<RespondStatus>('loading');
  const respondMutation = useRespondChallengeMutation();

  const { data, isError } = useChallengeStatusQuery(challengeId, respondStatus === 'loading' || respondStatus === 'selecting');

  useEffect(() => {
    if (isError) {
      setRespondStatus('expired');
      return;
    }
    if (!data || data.status !== 200) return;
    if (data.body.status === 'PENDING') {
      setRespondStatus('selecting');
    } else {
      setRespondStatus('expired');
    }
  }, [data, isError]);

  const options = data?.status === 200 && data.body.status === 'PENDING' ? data.body.options : [];

  const respond = (selectedNumber: string) => {
    respondMutation.mutate(
      { params: { id: challengeId }, body: { selectedNumber } },
      {
        onSuccess: () => setRespondStatus('done'),
      },
    );
  };

  return { options, respondStatus, respond };
}
```

- [ ] `services/web/src/features/login-by-2fa/api/twoFactorApi.ts`를 삭제한다.
- [ ] `cd services/web && npm run build`를 실행하여 타입 오류가 없는지 확인한다.
- [ ] `git add services/api/src/twofa/ services/web/src/features/login-by-2fa/ && git commit -m "feat: twofa 도메인 @TsRestHandler 및 ts-rest 훅으로 전환"`

---

## Task 18: Phase 4 — device 전환 (API + Web)

- [ ] `services/api/src/device/device.controller.spec.ts`를 supertest 기반으로 재작성한다. 기존 파일을 먼저 읽어 DeviceService 메서드명을 확인한다.

```typescript
import { INestApplication, ExecutionContext } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { TsRestModule } from '@ts-rest/nest';
import * as request from 'supertest';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';

const mockUser = { userId: 'uid', username: 'user1', permissions: [] };

const mockDeviceService = {
  register: jest.fn(),
  findAll: jest.fn(),
  remove: jest.fn(),
};

describe('DeviceController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [TsRestModule.register({ isGlobal: true })],
      controllers: [DeviceController],
      providers: [
        { provide: DeviceService, useValue: mockDeviceService },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (ctx: ExecutionContext) => {
              ctx.switchToHttp().getRequest().user = mockUser;
              return true;
            },
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  it('POST /api/devices — 디바이스를 등록하고 204를 반환한다', async () => {
    mockDeviceService.register.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .post('/api/devices')
      .send({ pushToken: 'push-token-value' })
      .expect(204);

    expect(mockDeviceService.register).toHaveBeenCalledWith('uid', 'push-token-value', expect.any(String));
  });

  it('GET /api/devices — 디바이스 목록을 반환한다', async () => {
    const devices = [{ id: 'dev-1', userAgent: 'Mozilla/5.0', createdAt: new Date('2026-01-01') }];
    mockDeviceService.findAll.mockResolvedValue(devices);

    const res = await request(app.getHttpServer())
      .get('/api/devices')
      .expect(200);

    expect(mockDeviceService.findAll).toHaveBeenCalledWith('uid');
    expect(res.body[0].id).toBe('dev-1');
  });

  it('DELETE /api/devices/:id — 디바이스를 삭제하고 204를 반환한다', async () => {
    mockDeviceService.remove.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .delete('/api/devices/dev-1')
      .expect(204);

    expect(mockDeviceService.remove).toHaveBeenCalledWith('dev-1', 'uid');
  });
});
```

- [ ] `npm test -- --testPathPattern=device.controller` 테스트가 실패하는 것을 확인한다.

- [ ] `services/api/src/device/device.controller.ts`를 TsRestHandler로 교체한다. 기존 파일을 먼저 읽어 DeviceService 메서드 시그니처를 확인한다.

```typescript
import { Controller, Req } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@terab/contracts';
import { CurrentUser } from '@terab/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/types/auth-user.type';
import { DeviceService } from './device.service';

@Controller()
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @TsRestHandler(contract.device.register)
  async handleRegister(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return tsRestHandler(contract.device.register, async ({ body }) => {
      const userAgent = req.headers['user-agent'];
      await this.deviceService.register(user.userId, body.pushToken, userAgent);
      return { status: 204 as const, body: undefined };
    });
  }

  @TsRestHandler(contract.device.list)
  async handleList(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.device.list, async () => {
      const result = await this.deviceService.findAll(user.userId);
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(contract.device.remove)
  async handleRemove(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.device.remove, async ({ params }) => {
      await this.deviceService.remove(params.id, user.userId);
      return { status: 204 as const, body: undefined };
    });
  }
}
```

- [ ] `npm test -- --testPathPattern=device.controller` 테스트가 통과하는지 확인한다.
- [ ] `services/api/src/device/dto/device-response.dto.ts`를 삭제한다.
- [ ] `services/api/src/device/dto/register-device.dto.ts`를 삭제한다.
- [ ] `npm run build`를 실행하여 타입 오류가 없는지 확인한다 (api).

- [ ] `services/web/src/features/push-notification/api/query.ts` 파일을 생성한다.

```typescript
import { tsRestClient } from '@/shared/api';

export function useDevicesQuery() {
  return tsRestClient.device.list.useQuery(['device', 'list'], {}, { staleTime: 1000 * 60 });
}
```

- [ ] `services/web/src/features/push-notification/api/mutation.ts` 파일을 생성한다.

```typescript
import { tsRestClient } from '@/shared/api';

export function useRegisterDeviceMutation() {
  return tsRestClient.device.register.useMutation();
}

export function useRemoveDeviceMutation() {
  return tsRestClient.device.remove.useMutation();
}
```

- [ ] `services/web/src/features/push-notification/model/usePushNotification.ts`를 업데이트한다. 기존 파일을 먼저 읽어 Capacitor 코드와 useEffect 구조를 유지하고 `registerMutation` 호출 방식만 교체한다.

```typescript
import { useUserStore } from '@/entities';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { useEffect, useRef } from 'react';
import { useRegisterDeviceMutation } from '../api/mutation';

export function usePushNotification() {
  const pendingTokenRef = useRef<string | null>(null);
  const accessToken = useUserStore((s) => s.accessToken);
  const registerMutation = useRegisterDeviceMutation();

  useEffect(() => {
    if (!accessToken || !pendingTokenRef.current) return;
    const token = pendingTokenRef.current;
    pendingTokenRef.current = null;
    registerMutation.mutate({ body: { pushToken: token } });
  }, [accessToken]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handles: PluginListenerHandle[] = [];
    let cancelled = false;

    const setup = async () => {
      const { receive } = await PushNotifications.requestPermissions();
      if (receive !== 'granted' || cancelled) return;

      await PushNotifications.register();

      const h1 = await PushNotifications.addListener('registration', async (token) => {
        const currentToken = useUserStore.getState().accessToken;
        if (currentToken) {
          registerMutation.mutate({ body: { pushToken: token.value } });
        } else {
          pendingTokenRef.current = token.value;
        }
      });

      const h2 = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received (foreground):', notification.title);
      });

      const h3 = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const data = action.notification.data as { type?: string; challengeId?: string } | undefined;
        if (data?.type === '2FA_CHALLENGE' && data.challengeId) {
          // TODO: Phase 3에서 /auth/2fa/:challengeId 라우팅 추가
        }
      });

      if (cancelled) {
        h1.remove();
        h2.remove();
        h3.remove();
      } else {
        handles.push(h1, h2, h3);
      }
    };

    setup();

    return () => {
      cancelled = true;
      handles.forEach((h) => h.remove());
    };
  }, []);
}
```

- [ ] `services/web/src/features/push-notification/api/deviceApi.ts`를 삭제한다.
- [ ] `git add services/api/src/device/ services/web/src/features/push-notification/ && git commit -m "feat: device 도메인 @TsRestHandler 및 ts-rest 훅으로 전환"`

---

## Task 19: Phase 5 — trusted-device 전환 (API + Web)

- [ ] `services/api/src/trusted-device/trusted-device.controller.spec.ts`를 supertest 기반으로 재작성한다. 기존 파일을 먼저 읽어 TrustedDeviceService 메서드명과 `trustDurationMs` 프로퍼티를 확인한다.

```typescript
import { INestApplication, ExecutionContext } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { TsRestModule } from '@ts-rest/nest';
import * as request from 'supertest';
import { TrustedDeviceController } from './trusted-device.controller';
import { TrustedDeviceService } from './trusted-device.service';

const mockUser = { userId: 'uid', username: 'user1', permissions: [] };

const mockTrustedDeviceService = {
  findAll: jest.fn(),
  register: jest.fn(),
  revoke: jest.fn(),
  trustDurationMs: 2592000000,
};

describe('TrustedDeviceController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [TsRestModule.register({ isGlobal: true })],
      controllers: [TrustedDeviceController],
      providers: [
        { provide: TrustedDeviceService, useValue: mockTrustedDeviceService },
        {
          provide: APP_GUARD,
          useValue: {
            canActivate: (ctx: ExecutionContext) => {
              ctx.switchToHttp().getRequest().user = mockUser;
              return true;
            },
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  it('GET /api/trusted-device — 목록을 반환한다', async () => {
    const devices = [{ id: 'td-1', userAgent: 'Mozilla/5.0', createdAt: new Date('2026-01-01') }];
    mockTrustedDeviceService.findAll.mockResolvedValue(devices);

    const res = await request(app.getHttpServer())
      .get('/api/trusted-device')
      .expect(200);

    expect(mockTrustedDeviceService.findAll).toHaveBeenCalledWith('uid');
    expect(res.body[0].id).toBe('td-1');
  });

  it('POST /api/trusted-device — trustToken 쿠키를 설정하고 201을 반환한다', async () => {
    mockTrustedDeviceService.register.mockResolvedValue('raw-trust-token');

    const res = await request(app.getHttpServer())
      .post('/api/trusted-device')
      .send({})
      .expect(201);

    expect(mockTrustedDeviceService.register).toHaveBeenCalledWith('uid', expect.any(String));
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('DELETE /api/trusted-device/:id — 204를 반환한다', async () => {
    mockTrustedDeviceService.revoke.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .delete('/api/trusted-device/td-1')
      .expect(204);

    expect(mockTrustedDeviceService.revoke).toHaveBeenCalledWith('td-1', 'uid');
  });
});
```

- [ ] `npm test -- --testPathPattern=trusted-device.controller` 테스트가 실패하는 것을 확인한다.

- [ ] `services/api/src/trusted-device/trusted-device.controller.ts`를 TsRestHandler로 교체한다. 기존 파일을 먼저 읽어 쿠키 경로와 서비스 메서드를 확인한다.

```typescript
import { Controller, Req, Res } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { contract } from '@terab/contracts';
import { CurrentUser } from '@terab/common';
import type { Request, Response } from 'express';
import type { AuthUser } from '../auth/types/auth-user.type';
import { TrustedDeviceService } from './trusted-device.service';

@Controller()
export class TrustedDeviceController {
  private readonly TRUST_TOKEN_COOKIE = 'trustToken';
  private readonly COOKIE_PATH = '/api/auth';

  constructor(private readonly trustedDeviceService: TrustedDeviceService) {}

  @TsRestHandler(contract.trustedDevice.list)
  async handleList(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.trustedDevice.list, async () => {
      const result = await this.trustedDeviceService.findAll(user.userId);
      return { status: 200 as const, body: result };
    });
  }

  @TsRestHandler(contract.trustedDevice.register)
  async handleRegister(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    return tsRestHandler(contract.trustedDevice.register, async () => {
      const userAgent = req.headers['user-agent'];
      const rawToken = await this.trustedDeviceService.register(user.userId, userAgent);
      res.cookie(this.TRUST_TOKEN_COOKIE, rawToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: this.trustedDeviceService.trustDurationMs,
        path: this.COOKIE_PATH,
      });
      return { status: 201 as const, body: undefined };
    });
  }

  @TsRestHandler(contract.trustedDevice.revoke)
  async handleRevoke(@CurrentUser() user: AuthUser) {
    return tsRestHandler(contract.trustedDevice.revoke, async ({ params }) => {
      await this.trustedDeviceService.revoke(params.id, user.userId);
      return { status: 204 as const, body: undefined };
    });
  }
}
```

- [ ] `npm test -- --testPathPattern=trusted-device.controller` 테스트가 통과하는지 확인한다.
- [ ] `services/api/src/trusted-device/dto/trusted-device-response.dto.ts`를 삭제한다.
- [ ] `npm run build`를 실행하여 타입 오류가 없는지 확인한다 (api).

- [ ] `services/web/src/features/trusted-device/api/query.ts` 파일을 생성한다.

```typescript
import { tsRestClient } from '@/shared/api';

export function useTrustedDevicesQuery() {
  return tsRestClient.trustedDevice.list.useQuery(['trusted-device', 'list'], {}, { staleTime: 1000 * 60 });
}
```

- [ ] `services/web/src/features/trusted-device/api/mutation.ts` 파일을 생성한다.

  **주의:** FSD 규칙에 따라 `api` 세그먼트는 서버와의 데이터 교환만 담당한다. `invalidateQueries`는 사이드이펙트이므로 `model` 세그먼트에서 처리한다.

```typescript
import { tsRestClient } from '@/shared/api';

export function useRegisterTrustedDeviceMutation() {
  return tsRestClient.trustedDevice.register.useMutation();
}

export function useRevokeTrustedDeviceMutation() {
  return tsRestClient.trustedDevice.revoke.useMutation();
}
```

- [ ] `services/web/src/features/trusted-device/model/useTrustedDevice.ts`를 업데이트한다. 기존 파일을 먼저 읽어 반환 인터페이스를 확인한다. `invalidateQueries`는 model 레이어에서 처리한다.

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { useRegisterTrustedDeviceMutation, useRevokeTrustedDeviceMutation } from '../api/mutation';

export function useTrustedDevice() {
  const queryClient = useQueryClient();
  const registerMutation = useRegisterTrustedDeviceMutation();
  const revokeMutation = useRevokeTrustedDeviceMutation();

  const register = () => {
    registerMutation.mutate(
      { body: {} },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['trusted-device', 'list'] });
        },
      },
    );
  };

  const revoke = (id: string) => {
    revokeMutation.mutate(
      { params: { id }, body: {} },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['trusted-device', 'list'] });
        },
      },
    );
  };

  return {
    register,
    revoke,
    isRegistering: registerMutation.isPending,
    isRevoking: revokeMutation.isPending,
  };
}
```

- [ ] `services/web/src/features/trusted-device/api/trustedDeviceApi.ts`를 삭제한다.
- [ ] `cd services/web && npm run build`를 실행하여 타입 오류가 없는지 확인한다.
- [ ] `git add services/api/src/trusted-device/ services/web/src/features/trusted-device/ && git commit -m "feat: trusted-device 도메인 @TsRestHandler 및 ts-rest 훅으로 전환"`

---

## Task 20: 최종 정리

- [ ] `services/api/src/app.module.ts`를 읽어 `ValidationPipe`(APP_PIPE) 전역 등록 여부를 확인한다. `@ts-rest/nest`는 Zod 스키마로 요청을 검증하므로 `class-validator` 기반 `ValidationPipe`와 이중 적용된다. `APP_PIPE` 등록 블록을 제거한다.

```typescript
// providers 배열에서 아래 블록을 삭제:
// {
//   provide: APP_PIPE,
//   useValue: new ValidationPipe({
//     whitelist: true,
//     forbidNonWhitelisted: true,
//     transform: true,
//   }),
// },
```

- [ ] `class-validator`, `class-transformer` 잔여 사용 여부를 확인한다.

```bash
cd services/api && grep -r "class-validator\|class-transformer\|@IsString\|@IsNumber\|@IsOptional\|@MinLength\|@IsUUID" src/ --include="*.ts" -l
```

위 명령으로 사용 중인 파일이 없는지 확인한다. 없으면 `services/api/package.json`의 `dependencies`에서 `class-validator`와 `class-transformer`를 제거하고 `npm install`을 실행한다.

- [ ] API 빌드 최종 확인을 실행한다.

```bash
cd services/api && npm run build
```

- [ ] Web 빌드 최종 확인을 실행한다.

```bash
cd services/web && npm run build
```

- [ ] 전체 테스트를 실행하여 통과하는지 확인한다.

```bash
cd services/api && npm test
cd services/web && npm test
```

- [ ] `git add services/api/package.json services/api/package-lock.json services/api/src/app.module.ts && git commit -m "chore(api): class-validator/class-transformer 제거 및 ValidationPipe 정리"`
