---
description: ApiException과 ErrorCode 추가·사용 패턴
alwaysApply: true
---

# 오류 처리 패턴

## ErrorCode 추가

`src/common/exceptions/error-code.enum.ts`의 `ErrorCode` 객체에 추가한다.

```ts
export const ErrorCode = {
  // 기존 항목들...

  NEW_ERROR_KEY: {
    message: '사용자에게 노출되는 한글 오류 메시지',
    status: HttpStatus.NOT_FOUND,  // 적절한 HTTP 상태 코드
  },
} as const satisfies Record<string, ErrorCodeDefinition>;
```

- `message`: 클라이언트에 노출되는 한글 메시지
- `status`: `HttpStatus` enum 값
- `as const satisfies Record<string, ErrorCodeDefinition>` 패턴 유지 필수

## ApiException 사용

```ts
import { ApiException } from '@terab/common';

// ✅ ErrorCode에 등록된 키만 사용 (타입 안전)
throw new ApiException('NEW_ERROR_KEY');

// ❌ 일반 NestJS 예외 (메시지가 제네릭으로 마스킹됨 — 상세 내용은 로그에만 기록)
throw new NotFoundException('상세 메시지');
```

## 응답 형식

`ApiExceptionFilter`가 모든 예외를 아래 형식으로 직렬화한다.

```json
// ApiException — code + message 그대로 노출
{ "code": "NEW_ERROR_KEY", "message": "사용자에게 노출되는 한글 오류 메시지" }

// 일반 HttpException — status 기반 제네릭 메시지
{ "code": "HTTP_ERROR", "message": "Not Found" }
```

## 추가 순서

1. `ErrorCode` 객체에 항목 등록
2. `ErrorCodeKey` 타입이 자동으로 새 키를 포함 (별도 수정 불필요)
3. 서비스 코드에서 `throw new ApiException('NEW_ERROR_KEY')` 사용
