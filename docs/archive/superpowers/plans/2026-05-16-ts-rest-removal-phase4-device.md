# Phase 4 — device 도메인 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Phase 1 plan을 참조 원본으로 사용.

**Goal:** device 도메인(controller 3 메서드)을 표준 NestJS swagger + class-validator로 전환한다.

**Architecture:** device는 auth/trusted-device의 곁가지. 엔드포인트: `list`(GET)/`register`(POST 204, push token body)/`remove`(DELETE 204).

**Tech Stack:** Phase 0/1과 동일.

**Commit 단위:** 1 commit (`refactor: Phase 4 — device 도메인 전환`).

**Spec 참조:** §2, §6.A. Phase 1 plan 패턴 그대로 적용.

**전제:** Phase 0/1 완료. (Phase 3와 의존 없음, 순서 무관하나 plan 순서대로 진행 권장)

---

## File Structure

### Create (API)
- `services/api/src/device/dto/device-response.dto.ts`
- `services/api/src/device/dto/register-device-body.dto.ts`
- `services/api/src/device/dto/index.ts`

### Modify (API)
- `services/api/src/device/device.controller.ts`
- `services/api/src/device/device.controller.spec.ts`
- `services/api/src/device/device.service.ts` (반환 타입)

### Modify (Web)
- `services/web/src/shared/api/generated/`
- `services/web/src/features/push-notification/api/mutation.ts` (device register는 푸시 알림 등록 흐름에서 호출)
- 기타 device 사용처

---

## Task 1: device DTO 작성

**Files:**
- Create: `services/api/src/device/dto/device-response.dto.ts`
- Create: `services/api/src/device/dto/register-device-body.dto.ts`
- Create: `services/api/src/device/dto/index.ts`

- [ ] **Step 1: DeviceResponseDto 작성**

```ts
// services/api/src/device/dto/device-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class DeviceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ required: false })
  userAgent?: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;
}
```

- [ ] **Step 2: RegisterDeviceBodyDto 작성**

기존 Zod: `{ pushToken: z.string().min(1) }`.

```ts
// services/api/src/device/dto/register-device-body.dto.ts
import { IsString, MinLength } from 'class-validator';

export class RegisterDeviceBodyDto {
  @IsString()
  @MinLength(1)
  pushToken!: string;
}
```

- [ ] **Step 3: dto/index.ts**

```ts
export * from './device-response.dto';
export * from './register-device-body.dto';
```

- [ ] **Step 4: 빌드 + EOL**

Run: `npm --prefix services/api run build`
Expected: 빌드 성공.

---

## Task 2: device.controller.ts 변환

**Files:**
- Modify: `services/api/src/device/device.controller.ts`

- [ ] **Step 1: 기존 컨트롤러 확인**

Run: `cat services/api/src/device/device.controller.ts`

- [ ] **Step 2: 재작성**

```ts
// services/api/src/device/device.controller.ts
import {
  Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiError, type AuthUser, CurrentUser } from '@terab/common';
import { DeviceResponseDto, RegisterDeviceBodyDto } from './dto';
import { DeviceService } from './device.service';

@Controller('devices')
@ApiTags('Device')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Get()
  @ApiOperation({ summary: '디바이스 목록 조회' })
  @ApiResponse({ status: HttpStatus.OK, type: DeviceResponseDto, isArray: true })
  async list(@CurrentUser() user: AuthUser): Promise<DeviceResponseDto[]> {
    return this.deviceService.list(user.userId);
  }

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '디바이스 등록' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  async register(
    @CurrentUser() user: AuthUser,
    @Body() body: RegisterDeviceBodyDto,
    @Headers('user-agent') userAgent: string | undefined,
  ): Promise<void> {
    await this.deviceService.register(user.userId, body.pushToken, userAgent);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '디바이스 삭제' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError('DEVICE_NOT_FOUND')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.deviceService.remove(user.userId, id);
  }
}
```

**도메인 specifics:**
- `register` 응답이 NO_CONTENT (ts-rest 시절 그대로). POST 기본 201이 아닌 204이므로 `@HttpCode(HttpStatus.NO_CONTENT)` 명시 필수
- `remove`는 DELETE 204 명시 필수
- userAgent 헤더는 기존 컨트롤러에서 추출하는지 확인 후 그대로 이식

- [ ] **Step 3: service 시그니처 확인**

Run: `grep -n "async register\|async remove\|async list" services/api/src/device/device.service.ts`
Expected: 메서드 시그니처 확인. register 매개변수가 `(userId, pushToken, userAgent)` 인지 또는 다른 형태인지 점검 후 controller 호출부 조정.

- [ ] **Step 4: 빌드**

Run: `npm --prefix services/api run build`
Expected: 빌드 성공.

---

## Task 3: device.service.ts 시그니처 갱신

**Files:**
- Modify: `services/api/src/device/device.service.ts`

- [ ] **Step 1: Phase 1 Task 3 패턴**

반환 타입:
- `list`: `Promise<DeviceResponseDto[]>`
- `register`: `Promise<void>`
- `remove`: `Promise<void>`

`contract`/`ServerInferResponseBody` import 제거.

- [ ] **Step 2: 빌드 + 테스트**

Run: `npm --prefix services/api run build && npm test -- device`
Expected: 통과.

---

## Task 4: device.controller.spec.ts 갱신

- [ ] **Step 1: Phase 1 Task 4 패턴**

테스트 케이스:
- `list`: 빈 배열, 항목 있는 배열
- `register`: pushToken 빈 문자열 시 ValidationPipe 거부 (인스턴스 테스트로는 검증 어려움 — 통합 테스트 또는 생략), service.register 호출 검증
- `remove`: DEVICE_NOT_FOUND 실패, 성공

Run: `npm --prefix services/api test -- device.controller.spec`
Expected: 통과.

---

## Task 5: API Phase 4 검증

Run: `npm --prefix services/api run build && npm test`
Expected: 통과.

`make api` 후 `/json`에서 `/devices`, `/devices/{id}` 등재 확인.

---

## Task 6: Web codegen + features 갱신

**Files:**
- Modify: `services/web/src/features/push-notification/api/mutation.ts`
- 기타 device 사용처 (codegen 후 grep으로 식별)

- [ ] **Step 1: API 기동 + codegen**

Run (별도): `make api`
Run: `npm --prefix services/web run openapi:codegen`

- [ ] **Step 2: device 사용처 식별**

Run: `grep -rln "api\.device\.\|deviceContract" services/web/src/`

- [ ] **Step 3: 식별된 각 슬라이스 갱신**

Phase 1 Task 7 패턴. ts-rest `api.device.X.useMutation()` → hey-api `useMutation({ ...XMutation() })`. invalidation 필요 시 wrapper 안에 추가.

`push-notification` 슬라이스가 device.register를 호출하는 경우, push token 등록 흐름의 model에서 사이드이펙트 처리.

- [ ] **Step 4: 빌드 + 테스트**

Run: `npm --prefix services/web run build && npm test`
Expected: 통과.

`make api` 종료.

---

## Task 7: e2e + Phase 4 commit

- [ ] **Step 1: e2e**

`make api` + `make web` 후:
1. 모바일/푸시 알림 등록 흐름 → device.register 호출
2. 디바이스 목록 표시
3. 디바이스 삭제

- [ ] **Step 2: commit**

```bash
git add services/api/src/device/dto/ \
        services/api/src/device/device.controller.ts \
        services/api/src/device/device.controller.spec.ts \
        services/api/src/device/device.service.ts \
        services/web/src/features/<device 사용처>/ \
        services/web/src/shared/api/generated/

git commit -m "refactor: Phase 4 — device 도메인 전환"
```

---

## Phase 4 완료 조건

- [ ] DeviceResponseDto + RegisterDeviceBodyDto 작성
- [ ] controller 3 메서드 변환, register/remove의 NO_CONTENT 명시
- [ ] service 시그니처 DTO로
- [ ] web device 사용처 갱신
- [ ] build/test/e2e 통과
- [ ] 1 commit

Phase 5 (twofa) 진입 가능. **Phase 5는 discriminated union 첫 적용** — Phase 6 (auth)의 LoginResponse 패턴 검증 기회.
