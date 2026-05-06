---
description: Jest 단위 테스트 작성 패턴
globs:
  - "src/**/*.spec.ts"
alwaysApply: false
---

# 테스트 작성 패턴

## 기본 구조

```ts
import { Test } from '@nestjs/testing';
import { DatabaseService } from '@terab/db';
import { mockDatabaseService, setupMockDbSelectChain } from '@terab/test';
import { TargetRepository } from './target.repository';

describe('TargetRepository', () => {
  let repo: TargetRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TargetRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    repo = module.get(TargetRepository);
    jest.clearAllMocks();
    setupMockDbSelectChain(); // clearAllMocks() 후 반드시 호출 — select 체인 재구성
  });

  it('인스턴스가 생성된다', () => {
    expect(repo).toBeDefined();
  });
});
```

## Mock 패턴

```ts
import { mockDbLimit, setupMockDbSelectChain } from '@terab/test';

it('유효한 id로 조회하면 행을 반환한다', async () => {
  const expected = { id: 'uuid-1', name: 'test' };
  mockDbLimit.mockResolvedValue([expected]);  // 단건 조회 결과 모킹

  const result = await repo.findById('uuid-1');

  expect(result).toEqual(expected);
});

it('일치하는 행이 없으면 null을 반환한다', async () => {
  mockDbLimit.mockResolvedValue([]);

  const result = await repo.findById('non-existent');

  expect(result).toBeNull();
});
```

## User Fixture 선택 기준

`@CurrentUser` 데코레이터로 주입되는 사용자(JWT 페이로드)와 Repository가 DB에서 조회하는 사용자(전체 row)는 타입이 다르므로 fixture를 구분해서 사용한다.

| 상황 | 일반 사용자 | 관리자 |
|---|---|---|
| `@CurrentUser() user: AuthUser` 파라미터 mock | `mockAuthUser` | `mockAuthAdmin` |
| Repository 조회 결과 mock (`findUserById` 등) | `mockUser` | `mockAdmin` |

```ts
import { mockAuthUser, mockUser } from '@terab/test';

// ✅ @CurrentUser로 받는 경우 — AuthUser 타입
mockSomeService.doSomething.mockResolvedValue(mockAuthUser);

// ✅ Repository 조회 결과 — DB row 타입
mockAuthRepository.findUserWithPermissionsById.mockResolvedValue(mockUser);
```

## 검증 스타일

**값 일치(eq) 테스트**: fixture 속성을 직접 참조한다. magic string 대신 `mockUser.id`처럼 사용하면 fixture 변경 시 테스트도 자동으로 따라간다.

```ts
it('사용자 id를 반환한다', async () => {
  mockAuthRepository.findUserWithPermissionsById.mockResolvedValue({ id: mockUser.id });

  const result = await service.getUser(mockUser.id);

  expect(result.id).toBe(mockUser.id);
});
```

**실패(fail) 케이스**: 조회 결과가 없거나 조건을 만족하지 못하는 경우, mock은 `null`·`[]`·`false` 등 plain 값으로 설정하고 결과 검증도 단순하게 작성한다. fixture 속성을 참조할 필요가 없다.

```ts
it('userId에 해당하는 사용자가 없으면 null을 반환한다', async () => {
  mockAuthRepository.findUserWithPermissionsById.mockResolvedValue(null);

  const result = await repo.findUserById('ghost-id');

  expect(result).toBeNull();
});
```

## Fixture 파일 관리

테스트에 필요한 mock 데이터는 `src/test/fixtures/` 아래에 도메인별로 분리하여 관리한다.

```
src/test/fixtures/
  auth.fixtures.ts    # mockUser, mockAdmin, mockAuthUser, mockAuthAdmin
  file.fixtures.ts    # mockFile 등 파일 도메인 fixture
  index.ts            # 전체 re-export
```

- 새 도메인의 fixture가 필요하면 `src/test/fixtures/{domain}.fixtures.ts` 파일을 생성하고 `index.ts`에 re-export 추가
- 모든 fixture는 `@terab/test`로 import (`import { mockUser } from '@terab/test'`)
- fixture 값은 실제 제약조건(uuid 형식, 길이 등)을 지키되 단순하게 유지

## 핵심 규칙

- 테스트 설명(`describe`/`it`)은 한글로 작성
- `setupMockDbSelectChain()`은 `jest.clearAllMocks()` 호출 직후 실행 (순서 바꾸면 mock 체인 깨짐)
- Mock 유틸 import: `@terab/test` 패키지 (`mockDatabaseService`, `setupMockDbSelectChain`, `mockDbLimit` 등)
- 첫 번째 테스트는 항상 `it('인스턴스가 생성된다', () => { expect(target).toBeDefined(); })`
- DB 레이어 테스트는 `mockDatabaseService`로 주입 — 실제 DB 연결 없음
