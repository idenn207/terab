---
description: NestJS Service 작성 패턴 (비즈니스 로직)
globs:
  - "src/**/*.service.ts"
alwaysApply: false
---

# Service 작성 패턴

## 클래스 구조

```ts
@Injectable()
export class ExampleService {
  private readonly SOME_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 상수는 클래스 최상단

  constructor(
    private readonly exampleRepository: ExampleRepository,
    private readonly tokenService: TokenService,
  ) {}

  async doSomething(input: string): Promise<ResultType> {
    const item = await this.exampleRepository.findById(input);
    if (!item) throw new ApiException('ITEM_NOT_FOUND');
    return item;
  }
}
```

## 예외 처리

```ts
// ✅ 도메인 예외 — ErrorCode에 등록된 키 사용 (타입 안전)
throw new ApiException('ERROR_CODE_KEY');

// ❌ 서비스에서 직접 DB 접근 금지
await this.database.db.select()...
```

## 핵심 규칙

- DB 직접 접근 금지 — 항상 Repository 경유
- 트랜잭션이 필요한 경우 Repository에 전용 메서드 위임 (서비스에서 `database.db.transaction` 호출 금지)
- 상수·헬퍼 함수는 클래스 내부에 (`private readonly` / `private` 메서드) — `class-patterns.md` 참조
- `ApiException` import: `import { ApiException } from '@terab/common'`
