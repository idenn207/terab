# Phase 1 — invitation 도메인 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** invitation 도메인(controller 3 메서드)을 ts-rest에서 표준 NestJS swagger + class-validator로 전환하고, web 측 사용처를 hey-api codegen으로 갱신한다. **Phase 2~8 도메인 plan의 참조 원본**.

**Architecture:** invitation은 단방향 흐름이며 다른 도메인 의존이 없다. validate(GET, Public)·create(POST 201, RequirePermission)·deactivate(DELETE 204, RequirePermission) 3개 엔드포인트. 이 Phase에서 (1) DTO 작성 + Controller 변환 + 헬퍼 적용 패턴, (2) Web codegen 후 features 갱신 패턴, (3) MSW handler import 갱신 패턴을 정착시킨다.

**Tech Stack:** Phase 0과 동일. 본 Phase에서 추가 의존성 없음.

**Commit 단위:** 1 commit (`refactor: Phase 1 — invitation 도메인을 표준 NestJS로 전환`). API/Web 변경이 함께 build/test 통과하는 단위로 묶는다.

**Spec 참조:** [`2026-05-16-ts-rest-removal-swagger-migration-design.md`](../specs/2026-05-16-ts-rest-removal-swagger-migration-design.md) §2, §3.5, §4.3, §4.4, §6.A, §6.B

**전제:** Phase 0 완료 상태. API/Web 인프라가 모두 적용되어 있음.

---

## File Structure

### Create (API)
- `services/api/src/invitation/dto/create-invitation-body.dto.ts`
- `services/api/src/invitation/dto/invitation-response.dto.ts`
- `services/api/src/invitation/dto/validate-invitation-response.dto.ts`
- `services/api/src/invitation/dto/index.ts`

### Modify (API)
- `services/api/src/invitation/invitation.controller.ts` — `@TsRestHandler` → 표준 데코레이터
- `services/api/src/invitation/invitation.controller.spec.ts` — tsRestHandler mock 제거, 표준 호출 검증
- `services/api/src/invitation/invitation.service.ts` — 반환 타입 시그니처 `ServerInferResponseBody<typeof contract...>` → DTO 클래스

### Modify (Web)
- `services/web/src/shared/api/generated/` — codegen 재실행 후 갱신
- `services/web/src/features/register-by-invitation/api/query.ts` — ts-rest → hey-api `validateInvitationOptions`
- `services/web/src/features/register-by-invitation/model/useInvitationValidation.ts` — 응답 구조 `data.body.valid` → `data.valid`

---

## Task 1: invitation DTO 작성

**Files:**
- Create: `services/api/src/invitation/dto/create-invitation-body.dto.ts`
- Create: `services/api/src/invitation/dto/invitation-response.dto.ts`
- Create: `services/api/src/invitation/dto/validate-invitation-response.dto.ts`
- Create: `services/api/src/invitation/dto/index.ts`

- [ ] **Step 1: CreateInvitationBodyDto 작성**

기존 Zod 스키마: `CreateInvitationBodySchema = z.object({ expiresInDays: z.number().int().min(1).max(30).optional() })`.

```ts
// services/api/src/invitation/dto/create-invitation-body.dto.ts
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateInvitationBodyDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInDays?: number;
}
```

> swagger plugin이 컴파일 시 `@ApiProperty({ type: Number, minimum: 1, maximum: 30, required: false })` 자동 부착.

- [ ] **Step 2: InvitationResponseDto 작성**

기존 Zod: `InvitationResponseSchema = z.object({ token: z.string(), url: z.string(), expiresAt: z.coerce.date() })`.

```ts
// services/api/src/invitation/dto/invitation-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class InvitationResponseDto {
  token!: string;

  url!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: Date;
}
```

> `expiresAt`은 직렬화 시 ISO string으로 자동 변환됨 (Express의 JSON.stringify가 Date → ISO).

- [ ] **Step 3: ValidateInvitationResponseDto 작성**

기존 Zod: `ValidateInvitationResponseSchema = z.object({ valid: z.boolean() })`.

```ts
// services/api/src/invitation/dto/validate-invitation-response.dto.ts
export class ValidateInvitationResponseDto {
  valid!: boolean;
}
```

- [ ] **Step 4: dto/index.ts 진입점 작성**

```ts
// services/api/src/invitation/dto/index.ts
export * from './create-invitation-body.dto';
export * from './invitation-response.dto';
export * from './validate-invitation-response.dto';
```

- [ ] **Step 5: 빌드 검증**

Run: `cd services/api && npm run build`
Expected: 빌드 성공

- [ ] **Step 6: EOL 확인**

Run: `(Get-Content -Raw services/api/src/invitation/dto/create-invitation-body.dto.ts) -match "\r\n"`
Expected: `True` (3개 파일 모두)

---

## Task 2: invitation.controller.ts 변환

**Files:**
- Modify: `services/api/src/invitation/invitation.controller.ts`

- [ ] **Step 1: 전체 재작성**

```ts
// services/api/src/invitation/invitation.controller.ts
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiError, type AuthUser, CurrentUser, Public, RequirePermission } from '@terab/common';
import { InvitationService } from './invitation.service';
import {
  CreateInvitationBodyDto,
  InvitationResponseDto,
  ValidateInvitationResponseDto,
} from './dto';

@Controller('invitations')
@ApiTags('Invitation')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @RequirePermission('user:invite')
  @Post()
  @ApiOperation({ summary: '초대장 생성' })
  @ApiResponse({ status: HttpStatus.CREATED, type: InvitationResponseDto })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateInvitationBodyDto,
  ): Promise<InvitationResponseDto> {
    return this.invitationService.create(user.userId, body.expiresInDays);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Get(':token')
  @ApiOperation({ summary: '초대 토큰 유효성 검증' })
  @ApiResponse({ status: HttpStatus.OK, type: ValidateInvitationResponseDto })
  async validate(@Param('token') token: string): Promise<ValidateInvitationResponseDto> {
    return this.invitationService.validate(token);
  }

  @RequirePermission('user:manage')
  @Delete(':token')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '초대장 비활성화' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError('INVITATION_NOT_FOUND')
  async deactivate(@Param('token') token: string): Promise<void> {
    await this.invitationService.deactivate(token);
  }
}
```

**변경 핵심:**
- `@Controller()` → `@Controller('invitations')` (path prefix)
- `@ApiTags('Invitation')` 그룹 태그 추가
- `@TsRestHandler` 제거, 표준 `@Post`/`@Get`/`@Delete` 사용
- DELETE는 `@HttpCode(HttpStatus.NO_CONTENT)` 명시 필수
- POST는 201 기본이므로 `@HttpCode` 생략 (NestJS 기본값과 일치)
- create는 `INVITATION_*` 예외를 던지지 않으므로 `@ApiError` 불필요. deactivate는 `INVITATION_NOT_FOUND` 던질 수 있어 명시.
- validate는 예외를 던지지 않고 `{ valid: boolean }` 반환 — `@ApiError` 불필요.
- `contract.invitation.X` 참조 모두 제거, `@ts-rest/nest` import 제거

- [ ] **Step 2: 빌드 검증**

Run: `cd services/api && npm run build`
Expected: 빌드 성공. `invitation.service.ts`의 반환 타입이 `ServerInferResponseBody<typeof contract...>`인 채로 남아 있어도 컴파일은 통과(다음 task에서 정리).

- [ ] **Step 3: dev 서버 기동 + /json에 invitation paths 등장 확인**

Run (별도 터미널): `make api`
Run: `curl -s http://localhost:3000/json | python -c "import sys, json; d=json.load(sys.stdin); print('\n'.join(d['paths'].keys()))" | grep invitation`
Expected:
```
/invitations
/invitations/{token}
```

`make api` 종료.

---

## Task 3: invitation.service.ts 반환 타입 갱신

**Files:**
- Modify: `services/api/src/invitation/invitation.service.ts`

- [ ] **Step 1: import 갱신 — `@terab/contract` 제거, DTO import 추가**

기존:
```ts
import { contract } from '@terab/contract';
import { ServerInferResponseBody } from '@ts-rest/core';
```

변경 (위 두 줄 삭제, 아래 추가):
```ts
import { InvitationResponseDto, ValidateInvitationResponseDto } from './dto';
```

- [ ] **Step 2: `create()` 반환 타입 변경**

기존:
```ts
async create(
  createdBy: string,
  expiresInDays: number = this.DEFAULT_EXPIRES_DAYS,
): Promise<ServerInferResponseBody<typeof contract.invitation.create>> {
```

변경:
```ts
async create(
  createdBy: string,
  expiresInDays: number = this.DEFAULT_EXPIRES_DAYS,
): Promise<InvitationResponseDto> {
```

- [ ] **Step 3: `validate()` 반환 타입 변경**

기존:
```ts
async validate(token: string): Promise<ServerInferResponseBody<typeof contract.invitation.validate>> {
```

변경:
```ts
async validate(token: string): Promise<ValidateInvitationResponseDto> {
```

- [ ] **Step 4: 반환 객체 형태 검증 — 기존 그대로 동작**

`create()`는 `{ token, url, expiresAt }` 반환, `validate()`는 `{ valid }` 반환. DTO 클래스 필드와 동일하므로 plain object 반환 그대로 동작. class-transformer가 직렬화 처리.

- [ ] **Step 5: 빌드 검증**

Run: `cd services/api && npm run build`
Expected: 빌드 성공

- [ ] **Step 6: 테스트 실행**

Run: `cd services/api && npm test -- invitation`
Expected: 기존 service 테스트 통과 (시그니처만 변경, 동작 동일)

---

## Task 4: invitation.controller.spec.ts 갱신

**Files:**
- Modify: `services/api/src/invitation/invitation.controller.spec.ts`

- [ ] **Step 1: 기존 spec 구조 확인**

Run: `cat services/api/src/invitation/invitation.controller.spec.ts`

ts-rest 시절 spec은 `tsRestHandler` mock 또는 `handleCreate()` 호출 패턴이었을 것. 새 spec은 표준 메서드 호출 검증.

- [ ] **Step 2: spec 재작성**

```ts
// services/api/src/invitation/invitation.controller.spec.ts
import { Test } from '@nestjs/testing';
import { ApiException } from '@terab/common';
import { mockAuthUser } from '@terab/test';
import { InvitationController } from './invitation.controller';
import { InvitationService } from './invitation.service';

describe('InvitationController', () => {
  let controller: InvitationController;
  let service: jest.Mocked<InvitationService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [InvitationController],
      providers: [
        {
          provide: InvitationService,
          useValue: {
            create: jest.fn(),
            validate: jest.fn(),
            deactivate: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(InvitationController);
    service = module.get(InvitationService);
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('현재 사용자 id와 expiresInDays로 service.create를 호출하고 결과를 반환한다', async () => {
      const expected = { token: 'tok-1', url: 'https://x/register/tok-1', expiresAt: new Date('2030-01-01') };
      service.create.mockResolvedValue(expected);

      const result = await controller.create(mockAuthUser, { expiresInDays: 7 });

      expect(service.create).toHaveBeenCalledWith(mockAuthUser.userId, 7);
      expect(result).toEqual(expected);
    });

    it('expiresInDays 미지정 시에도 service.create를 호출한다', async () => {
      const expected = { token: 'tok-2', url: 'https://x/register/tok-2', expiresAt: new Date('2030-01-01') };
      service.create.mockResolvedValue(expected);

      const result = await controller.create(mockAuthUser, {});

      expect(service.create).toHaveBeenCalledWith(mockAuthUser.userId, undefined);
      expect(result).toEqual(expected);
    });
  });

  describe('validate', () => {
    it('토큰이 유효하면 { valid: true } 반환', async () => {
      service.validate.mockResolvedValue({ valid: true });

      const result = await controller.validate('valid-token');

      expect(service.validate).toHaveBeenCalledWith('valid-token');
      expect(result).toEqual({ valid: true });
    });

    it('토큰이 무효이면 { valid: false } 반환', async () => {
      service.validate.mockResolvedValue({ valid: false });

      const result = await controller.validate('invalid-token');

      expect(result).toEqual({ valid: false });
    });
  });

  describe('deactivate', () => {
    it('토큰으로 service.deactivate를 호출한다', async () => {
      service.deactivate.mockResolvedValue(undefined);

      await controller.deactivate('tok-1');

      expect(service.deactivate).toHaveBeenCalledWith('tok-1');
    });

    it('service.deactivate에서 INVITATION_NOT_FOUND를 던지면 그대로 전파한다', async () => {
      service.deactivate.mockRejectedValue(new ApiException('INVITATION_NOT_FOUND'));

      await expect(controller.deactivate('ghost-token')).rejects.toThrow(ApiException);
      await expect(controller.deactivate('ghost-token')).rejects.toMatchObject({
        errorCode: 'INVITATION_NOT_FOUND',
      });
    });
  });
});
```

- [ ] **Step 3: 테스트 실행**

Run: `cd services/api && npm test -- invitation.controller.spec`
Expected: 전체 통과

- [ ] **Step 4: 전체 테스트 실행 (영향 점검)**

Run: `cd services/api && npm test`
Expected: 전체 통과

---

## Task 5: API Phase 1 빌드/검증

**Files:**
- 없음 (검증만)

- [ ] **Step 1: 빌드**

Run: `cd services/api && npm run build`
Expected: 빌드 성공

- [ ] **Step 2: dev 서버 기동 + invitation 라우트 직접 호출 검증**

Run (별도 터미널): `make api`

invitation validate (Public, 인증 불필요):
```bash
curl -s -i http://localhost:3000/api/invitations/test-token
```
Expected: 200 응답, body `{"valid":false}` (DB에 토큰 없음)

invitation create (인증 필요):
```bash
curl -s -i -X POST http://localhost:3000/api/invitations -H "Content-Type: application/json" -d '{}'
```
Expected: 401 (인증 토큰 없음 — 정상 동작 신호)

invitation create with invalid body:
```bash
# JwtAuthGuard 통과 가능한 토큰이 있다면, 다음 body는 ValidationPipe에서 400으로 거부되어야 함
curl -s -i -X POST http://localhost:3000/api/invitations -H "Content-Type: application/json" -d '{"expiresInDays":100}'
```
Expected: 401 (인증 토큰 없으면) 또는 400 (인증 통과 시 ValidationPipe — `max: 30` 위반)

`make api` 종료.

---

## Task 6: Web codegen 재실행

**Files:**
- 자동 갱신: `services/web/src/shared/api/generated/`

- [ ] **Step 1: API dev 서버 기동**

Run (별도 터미널): `make api`

- [ ] **Step 2: codegen 실행**

Run: `cd services/web && npm run openapi:codegen`
Expected:
- `openapi-ts`가 `http://localhost:3000/json` fetch 후 `src/shared/api/generated/` 갱신
- `extract-public-paths.mjs` 실행 → invitation validate가 Public이므로 `/invitations/{token}`이 PUBLIC_PATHS에 포함될 수 있음 (단, GET이라 axios call URL과 path 형태 차이 주의)
- `public-paths.gen.ts`에 적어도 `/invitations/{token}` 항목 출력

- [ ] **Step 3: 산출물 diff 확인**

Run: `git diff services/web/src/shared/api/generated/`
Expected:
- `types.gen.ts`에 `CreateInvitationBodyDto`, `InvitationResponseDto`, `ValidateInvitationResponseDto` 타입 추가
- `sdk.gen.ts`에 `createInvitation()`, `validateInvitation()`, `deactivateInvitation()` 같은 함수 추가 (정확한 함수명은 hey-api operationId 추론 규칙에 따라 결정 — 보통 메서드명 또는 path 기반)
- `@tanstack/react-query.gen.ts`에 `createInvitationMutation`, `validateInvitationOptions`, `deactivateInvitationMutation` 추가
- `public-paths.gen.ts`에 invitation Public 경로 추가

- [ ] **Step 4: API dev 서버 종료**

Ctrl+C로 종료.

---

## Task 7: `features/register-by-invitation/api/query.ts` 갱신

**Files:**
- Modify: `services/web/src/features/register-by-invitation/api/query.ts`

- [ ] **Step 1: 기존 파일 확인**

기존:
```ts
import { api } from '@/shared/api';
import { contract } from '@terab/contract';

export function useValidateInvitationQuery(token: string) {
  return api.invitation.validate.useQuery({
    queryKey: [contract.invitation.validate.path, token],
    queryData: { params: { token } },
    enabled: !!token,
    retry: false,
    staleTime: 1000 * 30,
  });
}
```

- [ ] **Step 2: 생성된 함수명 확인**

Run: `grep -E "validateInvitation|getInvitation" services/web/src/shared/api/generated/@tanstack/react-query.gen.ts | head -5`
Expected: validate 함수의 정확한 이름 확인 (예: `validateInvitationOptions` 또는 `getInvitationByTokenOptions`)

본 plan에서는 `validateInvitationOptions`로 가정한다. 실제 이름이 다르면 그것으로 치환.

- [ ] **Step 3: 재작성**

```ts
// services/web/src/features/register-by-invitation/api/query.ts
import { useQuery } from '@tanstack/react-query';
import { validateInvitationOptions } from '@shared/api';

export function useValidateInvitationQuery(token: string) {
  return useQuery({
    ...validateInvitationOptions({ path: { token } }),
    enabled: !!token,
    retry: false,
    staleTime: 1000 * 30,
  });
}
```

**변경 핵심:**
- `@terab/contract` import 제거
- `@/shared/api`(ts-rest client) → `@shared/api`(hey-api codegen options)
- `queryKey`는 hey-api가 자동 생성 (`validateInvitationOptions(...)`의 `.queryKey` 안에 path 변수 포함)
- `queryData: { params: { token } }` → `path: { token }` (hey-api 인자 형태)
- `staleTime`, `retry`, `enabled` 같은 정책 메타는 wrapper 안에 유지 (이 슬라이스의 `api/`가 "정책 유무 무관 항상 작성" 규칙에 부합하는 좋은 사례)

- [ ] **Step 4: EOL 확인 + 빌드**

Run: `(Get-Content -Raw services/web/src/features/register-by-invitation/api/query.ts) -match "\r\n"`
Expected: `True`

Run: `cd services/web && npm run build`
Expected: 빌드 성공

---

## Task 8: `model/useInvitationValidation.ts` 응답 구조 갱신

**Files:**
- Modify: `services/web/src/features/register-by-invitation/model/useInvitationValidation.ts`

- [ ] **Step 1: 기존 코드 확인**

기존:
```ts
import { useEffect, useState } from 'react';
import { useValidateInvitationQuery } from '../api/query';

export function useInvitationValidation(token: string) {
  const [valid, setValid] = useState<boolean | null>(() => (token ? null : false));
  const { data } = useValidateInvitationQuery(token);

  useEffect(() => {
    if (!token) return;
    if (!data || data.status !== 200) {
      setValid(false);
      return;
    }

    setValid(data.body.valid);
  }, [token, data]);

  return { valid };
}
```

`data.status !== 200`과 `data.body.valid`는 ts-rest의 `{ status, body }` 반환 패턴.

- [ ] **Step 2: hey-api 응답 구조에 맞춰 재작성**

hey-api의 `useQuery({ ...validateInvitationOptions(...) })`는 성공 시 `data`에 응답 body가 바로 들어감 (TanStack Query 표준 동작). 에러는 `error`로 분리.

```ts
// services/web/src/features/register-by-invitation/model/useInvitationValidation.ts
import { useEffect, useState } from 'react';
import { useValidateInvitationQuery } from '../api/query';

export function useInvitationValidation(token: string) {
  const [valid, setValid] = useState<boolean | null>(() => (token ? null : false));
  const { data, error } = useValidateInvitationQuery(token);

  useEffect(() => {
    if (!token) return;
    if (error || !data) {
      setValid(false);
      return;
    }

    setValid(data.valid);
  }, [token, data, error]);

  return { valid };
}
```

**변경 핵심:**
- `data.status !== 200` → `error || !data` (성공/실패 분기를 TanStack의 `error`로 판단)
- `data.body.valid` → `data.valid` (응답 body가 바로 `data`에 들어감)

- [ ] **Step 3: EOL + 빌드 + 테스트**

Run: `(Get-Content -Raw services/web/src/features/register-by-invitation/model/useInvitationValidation.ts) -match "\r\n"`
Expected: `True`

Run: `cd services/web && npm run build`
Expected: 빌드 성공

Run: `cd services/web && npm test -- useInvitationValidation`
Expected: 통과 (테스트 파일이 없으면 skip, 있으면 응답 구조 변경 반영 필요)

- [ ] **Step 4: 테스트 파일이 있는 경우 갱신**

Run: `ls services/web/src/features/register-by-invitation/model/useInvitationValidation.test.tsx 2>&1`

존재한다면 mock 응답을 `{ valid: true }` 또는 `{ valid: false }` 형태로 갱신 (ts-rest의 `{ status, body: { valid } }` 형태 제거).

---

## Task 9: MSW handler 영향 점검

**Files:**
- 점검만: `services/web/src/__tests__/mocks/handlers.ts`

- [ ] **Step 1: 글로벌 핸들러 확인**

Run: `cat services/web/src/__tests__/mocks/handlers.ts`
Expected: 빈 `handlers: RequestHandler[] = []` 배열 (Phase 0 확인 시점 기준)

- [ ] **Step 2: invitation 관련 인라인 핸들러 검색**

Run: `grep -rn "invitations\|invitationContract\|invitation.validate" services/web/src/__tests__/ services/web/src/features/register-by-invitation/ 2>&1`

만약 인라인 핸들러에서 ts-rest 응답 형태(`{ status: 200, body: { valid } }`)를 만들고 있다면 hey-api 형태(`{ valid: true }` 그대로)로 갱신. handlers.ts가 빈 상태라면 영향 없음.

---

## Task 10: Web Phase 1 빌드/테스트

**Files:**
- 없음 (검증만)

- [ ] **Step 1: 빌드**

Run: `cd services/web && npm run build`
Expected: 빌드 성공

- [ ] **Step 2: 단위 테스트**

Run: `cd services/web && npm test`
Expected: 전체 통과

- [ ] **Step 3: dev 환경 e2e 흐름 수동 검증**

Run (터미널 A): `make api`
Run (터미널 B): `make web`

브라우저 시나리오:
1. 관리자 권한 계정으로 로그인
2. 초대장 생성 화면에서 초대 URL 발급 (POST `/api/invitations`)
3. 발급된 URL을 새 브라우저(시크릿 모드)에서 열기 → `/register/:token` 진입
4. invitation validate 호출 (GET `/api/invitations/:token`) → `{ valid: true }` 응답으로 등록 폼 표시 정상
5. 잘못된 token으로 접근 시 `{ valid: false }`로 처리되어 등록 폼이 차단되는지

Expected: 위 모든 시나리오 정상 동작

`make api`, `make web` 종료.

---

## Task 11: Phase 1 commit

**Files:**
- staged: 본 Phase 변경 전체

- [ ] **Step 1: 변경 파일 확인**

Run: `git status`
Expected:
```
Changes not staged for commit:
  modified:   services/api/src/invitation/invitation.controller.ts
  modified:   services/api/src/invitation/invitation.controller.spec.ts
  modified:   services/api/src/invitation/invitation.service.ts
  modified:   services/web/src/features/register-by-invitation/api/query.ts
  modified:   services/web/src/features/register-by-invitation/model/useInvitationValidation.ts
  modified:   services/web/src/shared/api/generated/<various>.gen.ts
  (선택) modified: services/web/src/features/register-by-invitation/model/useInvitationValidation.test.tsx

Untracked files:
  services/api/src/invitation/dto/
```

- [ ] **Step 2: stage**

```bash
git add services/api/src/invitation/dto/ \
        services/api/src/invitation/invitation.controller.ts \
        services/api/src/invitation/invitation.controller.spec.ts \
        services/api/src/invitation/invitation.service.ts \
        services/web/src/features/register-by-invitation/api/query.ts \
        services/web/src/features/register-by-invitation/model/useInvitationValidation.ts \
        services/web/src/shared/api/generated/
# 테스트 파일 갱신 시 추가:
# git add services/web/src/features/register-by-invitation/model/useInvitationValidation.test.tsx
```

- [ ] **Step 3: commit**

```bash
git commit -m "refactor: Phase 1 — invitation 도메인을 표준 NestJS로 전환"
```

Expected: 1 commit 생성. `git log -1 --stat`로 변경 통계 확인.

---

## Phase 1 완료 조건

- [ ] API: invitation DTO 3개 작성, controller `@TsRestHandler` → 표준 데코레이터, service 반환 타입 DTO로, spec 갱신 완료
- [ ] Web: codegen 재실행, `features/register-by-invitation/api/query.ts` + `model/useInvitationValidation.ts` 갱신
- [ ] `make build-api && make build-web` 성공
- [ ] `cd services/api && npm test`, `cd services/web && npm test` 통과
- [ ] dev 환경에서 invitation 발급/검증 흐름 정상 동작
- [ ] 1 commit (`refactor: Phase 1 — invitation 도메인을 표준 NestJS로 전환`)

Phase 1 종료. **이 plan에서 정착시킨 패턴이 Phase 2~8의 참조 원본**:
- DTO 작성 (class-validator + swagger plugin 자동 처리)
- Controller 변환 (데코레이터 순서 + HttpCode 명시 + @ApiError 헬퍼)
- Service 시그니처 갱신 (DTO 타입)
- Controller spec 재작성 (tsRestHandler mock 제거)
- Web codegen 재실행 + features `api/` 갱신 + model 응답 구조 변경 + MSW 점검
- 도메인 단위 한글 conventional commit

Phase 2 (folder) 진입 가능.
