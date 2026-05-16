# Phase 5 — twofa 도메인 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Phase 1 plan을 참조 원본으로 사용.

**Goal:** twofa 도메인(controller 3 메서드)을 표준 NestJS swagger + class-validator로 전환한다. **이 Phase는 discriminated union(`ChallengeStatusResponse`: PENDING/APPROVED/DENIED/EXPIRED) 첫 실전 적용** — Phase 6 (auth)의 `LoginResponse` 패턴이 검증되는 자리.

**Architecture:** twofa는 auth 흐름의 핵심 가지. 챌린지 상태 조회/응답/재발송 3개. `ChallengeStatusResponse`는 `status` discriminator 기반 4-way union. spec §6.A.4의 oneOf+discriminator.mapping 3종 세트 적용.

**Tech Stack:** Phase 0/1과 동일.

**Commit 단위:** 1 commit (`refactor: Phase 5 — twofa 도메인 전환 (discriminated union 첫 적용)`).

**Spec 참조:** §2.3 (discriminated union), §6.A.4, §6.B.3. Phase 1 plan 기본 패턴 + 본 Phase의 특수 사항(union).

**전제:** Phase 0/1 완료. (Phase 2/3/4 완료 권장 — 패턴 누적 후 union 첫 적용이 안전)

---

## File Structure

### Create (API)
- `services/api/src/twofa/dto/challenge-status-response.dto.ts` — **4개 클래스 + 합성 타입**
- `services/api/src/twofa/dto/respond-challenge-body.dto.ts`
- `services/api/src/twofa/dto/resend-challenge-response.dto.ts`
- `services/api/src/twofa/dto/index.ts`

### Modify (API)
- `services/api/src/twofa/twofa.controller.ts`
- `services/api/src/twofa/twofa.controller.spec.ts`
- `services/api/src/twofa/twofa.service.ts` (반환 타입)

### Modify (Web)
- `services/web/src/shared/api/generated/`
- `services/web/src/features/login-by-2fa/api/{query,mutation}.ts`
- `services/web/src/features/login-by-2fa/model/*.ts`

---

## Task 1: ChallengeStatus discriminated union DTO 작성

**Files:**
- Create: `services/api/src/twofa/dto/challenge-status-response.dto.ts`

이 task가 본 Phase의 가장 중요한 부분 — Phase 6 LoginResponse 패턴의 정착 지점.

- [ ] **Step 1: 4개 status DTO 클래스 + 합성 타입**

```ts
// services/api/src/twofa/dto/challenge-status-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from '../../common/dto';

export class ChallengeStatusPendingDto {
  @ApiProperty({ enum: ['PENDING'] })
  status!: 'PENDING';

  @ApiProperty({ type: [String] })
  options!: string[];

  correctNum!: string;

  remainingSeconds!: number;
}

export class ChallengeStatusApprovedDto {
  @ApiProperty({ enum: ['APPROVED'] })
  status!: 'APPROVED';

  accessToken!: string;

  @ApiProperty({ type: UserDto })
  user!: UserDto;
}

export class ChallengeStatusDeniedDto {
  @ApiProperty({ enum: ['DENIED'] })
  status!: 'DENIED';
}

export class ChallengeStatusExpiredDto {
  @ApiProperty({ enum: ['EXPIRED'] })
  status!: 'EXPIRED';
}

export type ChallengeStatusResponse =
  | ChallengeStatusPendingDto
  | ChallengeStatusApprovedDto
  | ChallengeStatusDeniedDto
  | ChallengeStatusExpiredDto;
```

**핵심:**
- 4개 클래스 각각 `status` 필드를 `enum: ['LITERAL']`로 swagger에 명시
- 합성 union type은 type alias로 export (TypeScript narrowing용)
- `ChallengeStatusApprovedDto`의 `user` 필드는 Phase 0에서 작성한 `UserDto` 사용

- [ ] **Step 2: 빌드**

Run: `cd services/api && npm run build`
Expected: 빌드 성공.

---

## Task 2: 나머지 DTO 작성

**Files:**
- Create: `services/api/src/twofa/dto/respond-challenge-body.dto.ts`
- Create: `services/api/src/twofa/dto/resend-challenge-response.dto.ts`
- Create: `services/api/src/twofa/dto/index.ts`

- [ ] **Step 1: RespondChallengeBodyDto**

기존 Zod: `{ selectedNumber: z.string().regex(/^\d{2}$/) }`.

```ts
// services/api/src/twofa/dto/respond-challenge-body.dto.ts
import { Matches } from 'class-validator';

export class RespondChallengeBodyDto {
  @Matches(/^\d{2}$/, { message: 'selectedNumber must be exactly 2 digits' })
  selectedNumber!: string;
}
```

- [ ] **Step 2: ResendChallengeResponseDto**

기존 Zod: `{ challengeId: string, options: string[], expiresAt: Date }`.

```ts
// services/api/src/twofa/dto/resend-challenge-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class ResendChallengeResponseDto {
  challengeId!: string;

  @ApiProperty({ type: [String] })
  options!: string[];

  @ApiProperty({ format: 'date-time' })
  expiresAt!: Date;
}
```

- [ ] **Step 3: dto/index.ts**

```ts
export * from './challenge-status-response.dto';
export * from './respond-challenge-body.dto';
export * from './resend-challenge-response.dto';
```

- [ ] **Step 4: 빌드 + EOL**

Run: `cd services/api && npm run build`
Expected: 빌드 성공.

---

## Task 3: twofa.controller.ts 변환 — oneOf+discriminator 적용

**Files:**
- Modify: `services/api/src/twofa/twofa.controller.ts`

- [ ] **Step 1: 기존 컨트롤러 확인**

Run: `cat services/api/src/twofa/twofa.controller.ts`

- [ ] **Step 2: 재작성 — `getStatus`가 핵심**

```ts
// services/api/src/twofa/twofa.controller.ts
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiExtraModels, ApiOperation, ApiResponse, ApiTags, getSchemaPath, refs } from '@nestjs/swagger';
import { ApiError, Public } from '@terab/common';
import {
  ChallengeStatusApprovedDto,
  ChallengeStatusDeniedDto,
  ChallengeStatusExpiredDto,
  ChallengeStatusPendingDto,
  type ChallengeStatusResponse,
  RespondChallengeBodyDto,
  ResendChallengeResponseDto,
} from './dto';
import { TwofaService } from './twofa.service';

@Controller('auth/2fa/challenge')
@ApiTags('TwoFa')
export class TwofaController {
  constructor(private readonly twofaService: TwofaService) {}

  @Public()
  @Get(':id/status')
  @ApiOperation({ summary: '2FA 챌린지 상태 조회' })
  @ApiExtraModels(
    ChallengeStatusPendingDto,
    ChallengeStatusApprovedDto,
    ChallengeStatusDeniedDto,
    ChallengeStatusExpiredDto,
  )
  @ApiResponse({
    status: HttpStatus.OK,
    schema: {
      oneOf: refs(
        ChallengeStatusPendingDto,
        ChallengeStatusApprovedDto,
        ChallengeStatusDeniedDto,
        ChallengeStatusExpiredDto,
      ),
      discriminator: {
        propertyName: 'status',
        mapping: {
          PENDING: getSchemaPath(ChallengeStatusPendingDto),
          APPROVED: getSchemaPath(ChallengeStatusApprovedDto),
          DENIED: getSchemaPath(ChallengeStatusDeniedDto),
          EXPIRED: getSchemaPath(ChallengeStatusExpiredDto),
        },
      },
    },
  })
  @ApiError('TWO_FA_CHALLENGE_NOT_FOUND')
  async getStatus(@Param('id') id: string): Promise<ChallengeStatusResponse> {
    return this.twofaService.getStatus(id);
  }

  @Public()
  @Post(':id/respond')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '2FA 챌린지 응답' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiError('TWO_FA_CHALLENGE_NOT_FOUND')
  async respond(
    @Param('id') id: string,
    @Body() body: RespondChallengeBodyDto,
  ): Promise<void> {
    await this.twofaService.respond(id, body.selectedNumber);
  }

  @Public()
  @Post(':id/resend')
  @ApiOperation({ summary: '2FA 챌린지 재발송' })
  @ApiResponse({ status: HttpStatus.OK, type: ResendChallengeResponseDto })
  @ApiError('TWO_FA_CHALLENGE_NOT_FOUND')
  async resend(@Param('id') id: string): Promise<ResendChallengeResponseDto> {
    return this.twofaService.resend(id);
  }
}
```

**핵심 변경:**
- `@Public()`: 2FA 챌린지는 로그인 미완료 상태에서 호출되므로 모든 메서드 Public
- `getStatus`에 `@ApiExtraModels` + `oneOf + discriminator.mapping` 3종 세트 적용 (spec §6.A.4 금지 패턴 표 기준)
- `respond`는 NO_CONTENT 응답 (`@HttpCode` 명시)
- `resend`는 POST지만 OK(200) 응답이므로 `@HttpCode(HttpStatus.OK)` 명시 (POST 기본 201과 다름)

> `resend`의 200 status는 ts-rest contract에서 명시 (`responses: { [HttpStatus.OK]: ResendChallengeResponseSchema }`). 명시 누락 시 NestJS는 201로 등록 → web codegen 출력도 어긋남.

- [ ] **Step 3: 누락 확인 — `@HttpCode(HttpStatus.OK)` 추가**

위 코드에서 `resend`에 `@HttpCode(HttpStatus.OK)`가 빠져 있다. Step 2의 코드는 `@HttpCode` 누락 — Step 3에서 추가:

```ts
  @Public()
  @Post(':id/resend')
  @HttpCode(HttpStatus.OK)         // 추가
  @ApiOperation({ summary: '2FA 챌린지 재발송' })
  @ApiResponse({ status: HttpStatus.OK, type: ResendChallengeResponseDto })
  @ApiError('TWO_FA_CHALLENGE_NOT_FOUND')
  async resend(...) { ... }
```

- [ ] **Step 4: service throw ErrorCode 확인**

Run: `grep -n "ApiException" services/api/src/twofa/twofa.service.ts`
Expected: `TWO_FA_CHALLENGE_NOT_FOUND` 등 확인. `@ApiError(...)` 인자 조정.

- [ ] **Step 5: 빌드**

Run: `cd services/api && npm run build`
Expected: 빌드 성공.

---

## Task 4: twofa.service.ts 시그니처 갱신

**Files:**
- Modify: `services/api/src/twofa/twofa.service.ts`

- [ ] **Step 1: 반환 타입 변경**

- `getStatus`: `Promise<ChallengeStatusResponse>` (union type alias)
- `respond`: `Promise<void>`
- `resend`: `Promise<ResendChallengeResponseDto>`

`contract`/`ServerInferResponseBody` import 제거. DTO import 추가.

- [ ] **Step 2: getStatus의 반환 객체 형태 검증**

기존 service는 status별로 다른 형태 객체를 반환할 것. 반환 객체에 `status: 'PENDING'`(또는 `'APPROVED'` 등) 리터럴이 정확히 포함되어 있어야 union narrowing 동작.

Run: `grep -n "return\|status:" services/api/src/twofa/twofa.service.ts`
Expected: 4가지 status 분기 모두 status 리터럴 포함 확인.

- [ ] **Step 3: 빌드 + 테스트**

Run: `cd services/api && npm run build && npm test -- twofa`
Expected: 통과.

---

## Task 5: twofa.controller.spec.ts 갱신

**Files:**
- Modify: `services/api/src/twofa/twofa.controller.spec.ts`

- [ ] **Step 1: Phase 1 Task 4 패턴 + 4가지 status 분기 검증**

테스트 케이스:
- `getStatus`:
  - PENDING 응답 반환 + status·options·correctNum·remainingSeconds 필드 검증
  - APPROVED 응답 반환 + accessToken·user 필드 검증
  - DENIED 응답 반환
  - EXPIRED 응답 반환
  - TWO_FA_CHALLENGE_NOT_FOUND 예외 던지면 그대로 전파
- `respond`:
  - service.respond 호출 검증 (id, selectedNumber 전달)
  - TWO_FA_CHALLENGE_NOT_FOUND 전파
- `resend`:
  - 응답 반환 검증
  - TWO_FA_CHALLENGE_NOT_FOUND 전파

```ts
// 예시 - getStatus의 APPROVED 케이스
it('APPROVED 상태 반환 시 accessToken과 user 포함', async () => {
  const expected = {
    status: 'APPROVED' as const,
    accessToken: 'token-1',
    user: mockUser,
  };
  service.getStatus.mockResolvedValue(expected);

  const result = await controller.getStatus('challenge-1');

  expect(result).toEqual(expected);
});
```

- [ ] **Step 2: 테스트 실행**

Run: `cd services/api && npm test -- twofa.controller.spec`
Expected: 통과.

---

## Task 6: API Phase 5 검증 — **OpenAPI oneOf 출력 확인**

- [ ] **Step 1: 빌드 + 전체 테스트**

Run: `cd services/api && npm run build && npm test`
Expected: 통과.

- [ ] **Step 2: /json에서 oneOf 구조 확인 (본 Phase의 핵심 검증)**

Run (별도): `make api`
Run:
```bash
curl -s http://localhost:3000/json | python -c "
import sys, json
d = json.load(sys.stdin)
status_op = d['paths']['/auth/2fa/challenge/{id}/status']['get']
print(json.dumps(status_op['responses']['200'], indent=2))
"
```

Expected: 응답 schema에 다음 구조가 포함되어 있어야 함:
```json
{
  "content": {
    "application/json": {
      "schema": {
        "oneOf": [
          { "$ref": "#/components/schemas/ChallengeStatusPendingDto" },
          { "$ref": "#/components/schemas/ChallengeStatusApprovedDto" },
          ...
        ],
        "discriminator": {
          "propertyName": "status",
          "mapping": {
            "PENDING": "#/components/schemas/ChallengeStatusPendingDto",
            ...
          }
        }
      }
    }
  }
}
```

**oneOf 또는 discriminator가 누락되면 stop** — Phase 6 (auth) 진입 전 반드시 해결. swagger plugin이 결합한 정보가 빠질 가능성 있음. 누락 시 controller의 `@ApiResponse` schema 객체를 다시 확인.

`make api` 종료.

---

## Task 7: Web codegen + features/login-by-2fa 갱신

**Files:**
- Modify: `services/web/src/features/login-by-2fa/api/{query,mutation}.ts`
- Modify: `services/web/src/features/login-by-2fa/model/*.ts`

- [ ] **Step 1: API 기동 + codegen**

Run (별도): `make api`
Run: `cd services/web && npm run openapi:codegen`

- [ ] **Step 2: generated types에서 union 출력 확인 (본 Phase의 두 번째 핵심 검증)**

Run: `grep -A 5 "ChallengeStatusResponse" services/web/src/shared/api/generated/types.gen.ts`
Expected:
```ts
export type ChallengeStatusResponse =
  | ChallengeStatusPendingDto
  | ChallengeStatusApprovedDto
  | ChallengeStatusDeniedDto
  | ChallengeStatusExpiredDto;
```
또는 hey-api 출력 형식이 약간 다른 inline union (`{ status: 'PENDING'; ... } | ...`). 어느 쪽이든 **TypeScript narrowing이 status 필드로 동작해야 함**. discriminator 출력이 깨졌으면 stop.

- [ ] **Step 3: features/login-by-2fa/api/query.ts 갱신**

```ts
// services/web/src/features/login-by-2fa/api/query.ts
import { useQuery } from '@tanstack/react-query';
import { getChallengeStatusOptions } from '@shared/api';

export function useChallengeStatusQuery(challengeId: string) {
  return useQuery({
    ...getChallengeStatusOptions({ path: { id: challengeId } }),
    enabled: !!challengeId,
    refetchInterval: 2000,   // polling 정책 (기존 동작 유지)
    retry: false,
  });
}
```

> 정확한 함수명·옵션은 generated 확인 후 조정.

- [ ] **Step 4: features/login-by-2fa/api/mutation.ts 갱신**

```ts
// services/web/src/features/login-by-2fa/api/mutation.ts
import { useMutation } from '@tanstack/react-query';
import { respondChallengeMutation, resendChallengeMutation } from '@shared/api';

export function useRespondChallengeMutation() {
  return useMutation({ ...respondChallengeMutation() });
}

export function useResendChallengeMutation() {
  return useMutation({ ...resendChallengeMutation() });
}
```

- [ ] **Step 5: model 갱신 — union narrowing 동작 검증**

기존 ts-rest 시절:
```ts
if (data.status === 200 && data.body.status === 'APPROVED') { ... }
```

hey-api로:
```ts
const { data } = useChallengeStatusQuery(challengeId);

if (data?.status === 'APPROVED') {
  // 여기에서 data.accessToken, data.user 접근 가능 (TS narrowing)
  useUserStore.getState().setAuth(data.accessToken, data.user);
} else if (data?.status === 'PENDING') {
  // data.options, data.correctNum, data.remainingSeconds 접근 가능
}
```

`features/login-by-2fa/model/useTwoFa.ts` (또는 유사한 파일) 안의 status 분기 로직을 위 패턴으로 갱신.

- [ ] **Step 6: 빌드 + 테스트**

Run: `cd services/web && npm run build && npm test`
Expected: 통과. **TypeScript narrowing이 status 별 필드 접근에서 동작하는지 컴파일 레벨로 검증.**

`make api` 종료.

---

## Task 8: MSW handler — twofa 응답 검증

- [ ] **Step 1: twofa 핸들러 검색**

Run: `grep -rn "2fa\|twofa\|challenge" services/web/src/__tests__/ services/web/src/features/login-by-2fa/`

ts-rest 시절 `{ status: 200, body: { status: 'PENDING', ... } }` 형태가 있으면 hey-api 형태(`HttpResponse.json({ status: 'PENDING', options: [...], ... })`)로 갱신.

---

## Task 9: e2e + Phase 5 commit

- [ ] **Step 1: e2e — 2FA 흐름 전체 검증**

`make api` + `make web` 후:
1. 2FA가 활성화된 계정으로 로그인 시도
2. 챌린지 ID 발급 → 2FA 폼 표시 (status: PENDING)
3. 폴링으로 status 갱신 확인 (PENDING → APPROVED/DENIED/EXPIRED)
4. 정상 응답 입력 → APPROVED → accessToken 저장 + 메인 화면 이동
5. 잘못된 응답 → DENIED → 에러 표시
6. 시간 초과 → EXPIRED → 재발송 버튼 활성화
7. 재발송 → 새 챌린지 ID로 폴링 재시작

**모든 status 분기가 UI에 정상 반영되어야 함**. 한 분기라도 빠지면 stop — narrowing 또는 응답 처리 누락.

- [ ] **Step 2: commit**

```bash
git add services/api/src/twofa/dto/ \
        services/api/src/twofa/twofa.controller.ts \
        services/api/src/twofa/twofa.controller.spec.ts \
        services/api/src/twofa/twofa.service.ts \
        services/web/src/features/login-by-2fa/ \
        services/web/src/shared/api/generated/

git commit -m "refactor: Phase 5 — twofa 도메인 전환 (discriminated union 첫 적용)"
```

---

## Phase 5 완료 조건

- [ ] 4개 ChallengeStatus DTO + 합성 union type 작성
- [ ] controller 3 메서드 변환, getStatus에 `@ApiExtraModels + oneOf + discriminator.mapping` 3종 세트 적용
- [ ] `resend`의 `@HttpCode(HttpStatus.OK)` 명시
- [ ] service 시그니처 union type 사용
- [ ] /json에서 oneOf 구조 출력 확인 (본 Phase의 핵심 검증)
- [ ] web generated types에서 union type 출력 확인
- [ ] web model에서 union narrowing 정상 동작 (컴파일 + 런타임)
- [ ] e2e: 4가지 status 분기(PENDING/APPROVED/DENIED/EXPIRED) UI 정상 반영
- [ ] 1 commit

Phase 5 종료. **discriminated union 패턴이 검증되어 Phase 6 (auth)의 LoginResponse도 동일 패턴으로 안전하게 적용 가능**.

Phase 6 (auth) 진입 가능.
