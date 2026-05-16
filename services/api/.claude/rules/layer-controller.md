---
description: NestJS Controller 작성 패턴 (ts-rest 기반)
globs:
  - "src/**/*.controller.ts"
alwaysApply: false
---

# Controller 작성 패턴

## ts-rest 핸들러 구조

모든 엔드포인트는 `@TsRestHandler` + `tsRestHandler` 조합으로 작성한다.

```ts
@TsRestHandler(contract.domain.action)
handleAction() {
  return tsRestHandler(contract.domain.action, async ({ body, params, query }) => {
    const result = await this.service.doSomething(body);
    return { status: HttpStatus.OK, body: result };
  });
}
```

- 반환 형식: `{ status: HttpStatus.XXX, body: { ... } }` — ts-rest 계약의 응답 타입과 반드시 일치
- `@Controller()` 빈 인자 사용 — ts-rest가 경로를 관리하므로 컨트롤러 레벨 prefix 없음

## 인증·권한 데코레이터

```ts
@Public()                                            // 로그인 없이 접근 가능 (로그인·회원가입·refresh 등)
@Throttle({ default: { ttl: 60000, limit: 5 } })     // 속도 제한 재정의 (기본: 60req/min)
@RequirePermission('resource:action')                // 특정 권한 필요 (permission guard 검사)
@TsRestHandler(contract.auth.login)
handleLogin() { ... }
```

## 파라미터 데코레이터

```ts
handleMe(
  @CurrentUser() user: AuthUser,              // JWT에서 추출한 현재 사용자
  @Cookies('cookieName') value: string,       // 쿠키 값 읽기
  @Req() req: Request,                        // 전체 요청 객체 (쿠키 직접 접근 시)
  @Res({ passthrough: true }) res: Response,  // 응답 객체 (쿠키 쓰기 시 passthrough 필수)
  @Headers('user-agent') ua: string,          // 헤더 값 읽기
) { ... }
```

## 쿠키 처리

```ts
// 쓰기
res.cookie('refreshToken', rawToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: maxAgeMs,
  path: '/api/auth',
});

// 삭제
res.clearCookie('refreshToken', { httpOnly: true, secure: true, sameSite: 'strict', path: '/api/auth' });
```

## 핵심 규칙

- **컨트롤러에 비즈니스 로직 없음** — 서비스로 위임. 컨트롤러는 HTTP 레이어(요청 파싱, 응답 직렬화, 쿠키 처리)만 담당
- `AuthUser` 타입 import: `import type { AuthUser } from '../auth/types/auth-user.type'` (또는 해당 경로)
