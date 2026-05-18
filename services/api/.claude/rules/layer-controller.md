---
description: NestJS Controller 작성 패턴 (@nestjs/swagger 기반)
globs:
  - "src/**/*.controller.ts"
alwaysApply: false
---

# Controller 작성 패턴

NestJS controller는 표준 `@Controller` + HTTP 메서드 데코레이터 + DTO 기반으로 작성한다. 본 문서는 `services/api/CLAUDE.md`의 "Swagger / DTO 컨벤션"을 controller 시점에서 요약한다.

## 기본 구조

```ts
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiError, Public } from '@terab/common';
import { LoginRequestDto, LoginResponseDto } from './dto';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '이메일/비밀번호 로그인' })
  @ApiResponse({ status: HttpStatus.OK, type: LoginResponseDto })
  @ApiError('AUTH_INVALID_CREDENTIALS')
  async login(@Body() body: LoginRequestDto): Promise<LoginResponseDto> {
    return this.authService.login(body);
  }
}
```

- 경로 prefix: `@Controller('domain')` — kebab/단수형
- 그룹 태그: `@ApiTags('Domain')` — PascalCase 단수형
- 반환은 DTO 인스턴스 (또는 plain object) — 글로벌 `ClassSerializerInterceptor`가 직렬화한다

## 메서드 데코레이터 순서 (고정)

```
@Public() / @RequirePermission()
@Throttle(...)
@Post / @Get / @Patch / @Delete
@HttpCode(...)
@ApiOperation({ summary: '한글 요약' })
@ApiExtraModels(...)         // discriminated union 등 필요 시
@ApiResponse({ status, type/schema })
@ApiError('KEY1', 'KEY2')
```

위 순서를 어기는 PR은 review reject 대상.

## HttpCode

| 메서드 | 기본 | 명시 필수 |
|---|---|---|
| GET | 200 | 거의 없음 |
| POST | 201 | **200 응답 시 `@HttpCode(HttpStatus.OK)`** |
| DELETE | 200 | **204 응답 시 `@HttpCode(HttpStatus.NO_CONTENT)`** |

`@Post()` + 200 응답을 의도하면서 `@HttpCode`를 생략하면 NestJS는 201을 반환한다 (계약 불일치). 반드시 명시.

## 응답 표현

```ts
// 단일 DTO
@ApiResponse({ status: HttpStatus.OK, type: UserDto })
// 배열
@ApiResponse({ status: HttpStatus.OK, type: UserDto, isArray: true })
// 빈 응답
@ApiResponse({ status: HttpStatus.NO_CONTENT })
// Discriminated union — 3종 세트 필수
@ApiExtraModels(SuccessDto, ChallengeDto)
@ApiResponse({
  status: HttpStatus.OK,
  schema: {
    oneOf: [{ $ref: getSchemaPath(SuccessDto) }, { $ref: getSchemaPath(ChallengeDto) }],
    discriminator: {
      propertyName: 'status',
      mapping: {
        AUTHENTICATED: getSchemaPath(SuccessDto),
        CHALLENGE_REQUIRED: getSchemaPath(ChallengeDto),
      },
    },
  },
})
```

union 응답은 `@ApiExtraModels + oneOf + discriminator.mapping` 3종 세트 누락 시 web codegen narrowing이 깨진다.

## 인증·권한 데코레이터

```ts
@Public()                                            // 로그인 없이 접근 가능 (로그인·회원가입·refresh 등)
@Throttle({ default: { ttl: 60000, limit: 5 } })     // 속도 제한 재정의 (기본: 60req/min)
@RequirePermission('resource:action')                // 특정 권한 필요 (permission guard 검사)
@Post('login')
async handleLogin() { ... }
```

`@Public()`은 OpenAPI security를 자동으로 비움 (composed decorator 내부에서 `ApiSecurity({})` 합성). web의 `PUBLIC_PATHS`도 codegen이 자동 갱신한다.

## 파라미터 데코레이터

```ts
handleMe(
  @CurrentUser() user: AuthUser,              // JWT에서 추출한 현재 사용자
  @Param('id', ParseUUIDPipe) id: string,     // path UUID는 ParseUUIDPipe 필수
  @Body() body: CreateXxxDto,                 // request body — class-validator 적용
  @Query() query: ListXxxQueryDto,            // query — class-validator 적용
  @Cookies('cookieName') value: string,       // 쿠키 값 읽기
  @Req() req: Request,                        // 전체 요청 객체 (쿠키 직접 접근 시)
  @Res({ passthrough: true }) res: Response,  // 응답 객체 (쿠키 쓰기 시 passthrough 필수)
  @Headers('user-agent') ua: string,          // 헤더 값 읽기
) { ... }
```

- `AuthUser` 타입 import: `import type { AuthUser } from '../auth/types/auth-user.type'`
- 모든 body / query DTO는 class-validator/class-transformer 데코레이터를 갖추고 글로벌 `ValidationPipe`로 검증된다 — 자세한 규칙은 `services/api/CLAUDE.md` "Request DTO 검증 원칙" 참조

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

## 오류 응답

```ts
@ApiError('AUTH_INVALID_CREDENTIALS', 'AUTH_USER_NOT_FOUND')
```

- `@ApiError(...keys: ErrorCodeKey[])` 헬퍼만 사용 — ErrorCode 키 기반
- 직접 `@ApiResponse({ status: 4xx, type: ErrorResponseDto })` 작성 금지 (보일러플레이트 + ErrorCode와 drift)
- 서비스 코드는 `throw new ApiException('KEY')` — 자세한 오류 추가 절차는 `.claude/rules/error-handling.md` 참조

## 핵심 규칙

- **컨트롤러에 비즈니스 로직 없음** — 서비스로 위임. 컨트롤러는 HTTP 레이어(요청 파싱, 응답 직렬화, 쿠키 처리)만 담당
- DTO는 반드시 `src/{domain}/dto/` 또는 `src/common/dto/`에 정의 — controller는 import만
- swagger plugin이 자동 처리하는 단순 필드는 `@ApiProperty()` 직접 부착 금지 (validator의 메타데이터로 자동 합성)
- 메서드 데코레이터 순서 고정
- `@Public()`은 가드 우회 + OpenAPI security 비움을 동시 처리하는 composed decorator
