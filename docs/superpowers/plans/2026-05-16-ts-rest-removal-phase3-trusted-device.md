# Phase 3 — trusted-device 도메인 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Phase 1 plan을 참조 원본으로 사용.

**Goal:** trusted-device 도메인(controller 3 메서드)을 표준 NestJS swagger + class-validator로 전환한다.

**Architecture:** trusted-device는 device·auth의 곁가지. 다른 도메인 의존 거의 없음. 엔드포인트: `list`(GET)/`register`(POST 201, body 없음)/`revoke`(DELETE 204).

**Tech Stack:** Phase 0/1과 동일.

**Commit 단위:** 1 commit (`refactor: Phase 3 — trusted-device 도메인 전환`).

**Spec 참조:** §2, §6.A. Phase 1 plan 패턴 그대로 적용.

**전제:** Phase 0/1 완료.

---

## File Structure

### Create (API)
- `services/api/src/trusted-device/dto/trusted-device-response.dto.ts`
- `services/api/src/trusted-device/dto/index.ts`

### Modify (API)
- `services/api/src/trusted-device/trusted-device.controller.ts`
- `services/api/src/trusted-device/trusted-device.controller.spec.ts`
- `services/api/src/trusted-device/trusted-device.service.ts` (반환 타입)

### Modify (Web)
- `services/web/src/shared/api/generated/`
- `services/web/src/features/trusted-device/api/query.ts` (이미 존재)
- `services/web/src/features/trusted-device/api/mutation.ts` (이미 존재)
- `services/web/src/features/trusted-device/model/useTrustedDevice.ts` (응답 구조)

---

## Task 1: TrustedDeviceResponseDto 작성

**Files:**
- Create: `services/api/src/trusted-device/dto/trusted-device-response.dto.ts`
- Create: `services/api/src/trusted-device/dto/index.ts`

- [ ] **Step 1: DTO 작성**

기존 Zod: `{ id: uuid, userAgent: string optional, createdAt: Date }`.

```ts
// services/api/src/trusted-device/dto/trusted-device-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class TrustedDeviceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ required: false })
  userAgent?: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}
```

- [ ] **Step 2: dto/index.ts**

```ts
export * from './trusted-device-response.dto';
```

- [ ] **Step 3: 빌드 + EOL**

Run: `cd services/api && npm run build`
Expected: 빌드 성공.

---

## Task 2: trusted-device.controller.ts 변환

**Files:**
- Modify: `services/api/src/trusted-device/trusted-device.controller.ts`

- [ ] **Step 1: 기존 컨트롤러 확인**

Run: `cat services/api/src/trusted-device/trusted-device.controller.ts`

- [ ] **Step 2: 재작성**

```ts
// services/api/src/trusted-device/trusted-device.controller.ts
import {
  Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiError, type AuthUser, CurrentUser } from '@terab/common';
import { TrustedDeviceResponseDto } from './dto';
import { TrustedDeviceService } from './trusted-device.service';

@Controller('trusted-device')
@ApiTags('TrustedDevice')
export class TrustedDeviceController {
  constructor(private readonly trustedDeviceService: TrustedDeviceService) {}

  @Get()
  @ApiOperation({ summary: '신뢰 기기 목록 조회' })
  @ApiResponse({ status: HttpStatus.OK, type: TrustedDeviceResponseDto, isArray: true })
  async list(@CurrentUser() user: AuthUser): Promise<TrustedDeviceResponseDto[]> {
    return this.trustedDeviceService.list(user.userId);
  }

  @Post()
  @ApiOperation({ summary: '신뢰 기기 등록' })
  @ApiResponse({ status: HttpStatus.CREATED })
  async register(
    @CurrentUser() user: AuthUser,
    @Headers('user-agent') userAgent: string | undefined,
  ): Promise<void> {
    await this.trustedDeviceService.register(user.userId, userAgent);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '신뢰 기기 해제' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError('TRUSTED_DEVICE_NOT_FOUND')
  async revoke(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.trustedDeviceService.revoke(user.userId, id);
  }
}
```

**도메인 specifics:**
- `register`는 ts-rest 시절 `body: EmptySchema`, response `EmptySchema` (201). NestJS에서는 `@Body()` 생략 + 반환 `void` + POST 기본 201이라 `@HttpCode` 생략
- `revoke`는 `@HttpCode(HttpStatus.NO_CONTENT)` 명시
- 기존 컨트롤러에서 `@Headers('user-agent')` 또는 device 추출 로직 있는지 확인 후 그대로 이식

- [ ] **Step 3: service에서 throw하는 ErrorCode 확인**

Run: `grep -n "ApiException" services/api/src/trusted-device/trusted-device.service.ts`
Expected: `TRUSTED_DEVICE_NOT_FOUND` 등 확인 후 `@ApiError(...)` 키 조정.

- [ ] **Step 4: 빌드**

Run: `cd services/api && npm run build`
Expected: 빌드 성공.

---

## Task 3: trusted-device.service.ts 시그니처 갱신

**Files:**
- Modify: `services/api/src/trusted-device/trusted-device.service.ts`

- [ ] **Step 1: Phase 1 Task 3 패턴**

`contract`/`ServerInferResponseBody` import 제거. 반환 타입:
- `list`: `Promise<TrustedDeviceResponseDto[]>`
- `register`: `Promise<void>`
- `revoke`: `Promise<void>`

- [ ] **Step 2: 빌드 + 테스트**

Run: `cd services/api && npm run build && npm test -- trusted-device`
Expected: 통과.

---

## Task 4: trusted-device.controller.spec.ts 갱신

**Files:**
- Modify: `services/api/src/trusted-device/trusted-device.controller.spec.ts`

- [ ] **Step 1: Phase 1 Task 4 패턴**

테스트 케이스:
- `list`: 빈 배열 반환, 항목 있는 배열 반환
- `register`: service.register 호출 검증 (userAgent 전달 포함)
- `revoke`: TRUSTED_DEVICE_NOT_FOUND 실패, 성공 케이스

Run: `cd services/api && npm test -- trusted-device.controller.spec`
Expected: 통과.

---

## Task 5: API Phase 3 빌드 검증

- [ ] **Step 1: 빌드 + 전체 테스트**

Run: `cd services/api && npm run build && npm test`
Expected: 통과.

- [ ] **Step 2: dev 서버 + /json 확인**

Run (별도): `make api`
Run: `curl -s http://localhost:3000/json | python -c "import sys, json; d=json.load(sys.stdin); print('\n'.join(d['paths'].keys()))" | grep trusted-device`
Expected: `/trusted-device`, `/trusted-device/{id}` 등재.

`make api` 종료.

---

## Task 6: Web codegen + features 갱신

**Files:**
- Modify: `services/web/src/features/trusted-device/api/query.ts`
- Modify: `services/web/src/features/trusted-device/api/mutation.ts`
- Modify: `services/web/src/features/trusted-device/model/useTrustedDevice.ts`

- [ ] **Step 1: API 기동 + codegen**

Run (별도): `make api`
Run: `cd services/web && npm run openapi:codegen`

- [ ] **Step 2: query.ts 갱신**

기존:
```ts
import { api } from '@/shared/api';
import { contract } from '@terab/contract';

export function useTrustedDevicesQuery() {
  return api.trustedDevice.list.useQuery({
    queryKey: [contract.trustedDevice.list],
    staleTime: 1000 * 60,
  });
}
```

변경:
```ts
import { useQuery } from '@tanstack/react-query';
import { listTrustedDevicesOptions } from '@shared/api';

export function useTrustedDevicesQuery() {
  return useQuery({
    ...listTrustedDevicesOptions(),
    staleTime: 1000 * 60,
  });
}
```

> 정확한 함수명은 generated 파일에서 확인.

- [ ] **Step 3: mutation.ts 갱신 (register + revoke)**

기존 ts-rest 시절 패턴 → hey-api 패턴:

```ts
// services/web/src/features/trusted-device/api/mutation.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { registerTrustedDeviceMutation, revokeTrustedDeviceMutation, listTrustedDevicesOptions } from '@shared/api';

export function useRegisterTrustedDeviceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...registerTrustedDeviceMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listTrustedDevicesOptions().queryKey });
    },
  });
}

export function useRevokeTrustedDeviceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    ...revokeTrustedDeviceMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listTrustedDevicesOptions().queryKey });
    },
  });
}
```

- [ ] **Step 4: model 갱신**

`useTrustedDevice.ts`에서 `data.body` 사용 부분이 있으면 `data`로 변경. `data.status` 분기는 `error` 분기로.

Run: `cat services/web/src/features/trusted-device/model/useTrustedDevice.ts`
이후 응답 구조 부분 식별 후 갱신.

- [ ] **Step 5: 빌드 + 테스트**

Run: `cd services/web && npm run build && npm test`
Expected: 통과.

- [ ] **Step 6: API 종료**

Ctrl+C.

---

## Task 7: e2e 검증 + Phase 3 commit

- [ ] **Step 1: e2e**

`make api` + `make web` 후 브라우저:
1. 로그인 (2FA 흐름 거치면 신뢰기기 등록 옵션)
2. 신뢰 기기 등록 (POST `/api/trusted-device`)
3. 신뢰 기기 목록 표시 (GET `/api/trusted-device`)
4. 기기 하나 해제 (DELETE `/api/trusted-device/:id`)
5. 목록에서 사라지는지 확인 (캐시 invalidation)

- [ ] **Step 2: commit**

```bash
git add services/api/src/trusted-device/dto/ \
        services/api/src/trusted-device/trusted-device.controller.ts \
        services/api/src/trusted-device/trusted-device.controller.spec.ts \
        services/api/src/trusted-device/trusted-device.service.ts \
        services/web/src/features/trusted-device/ \
        services/web/src/shared/api/generated/

git commit -m "refactor: Phase 3 — trusted-device 도메인 전환"
```

---

## Phase 3 완료 조건

- [ ] TrustedDeviceResponseDto 작성
- [ ] controller 3 메서드 변환, spec 갱신
- [ ] service 시그니처 DTO로
- [ ] web features/trusted-device 갱신 + invalidation 적용
- [ ] build/test/e2e 통과
- [ ] 1 commit

Phase 4 (device) 진입 가능.
