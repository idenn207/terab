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

## 핵심 규칙

- 테스트 설명(`describe`/`it`)은 한글로 작성
- `setupMockDbSelectChain()`은 `jest.clearAllMocks()` 호출 직후 실행 (순서 바꾸면 mock 체인 깨짐)
- Mock 유틸 import: `@terab/test` 패키지 (`mockDatabaseService`, `setupMockDbSelectChain`, `mockDbLimit` 등)
- 첫 번째 테스트는 항상 `it('인스턴스가 생성된다', () => { expect(target).toBeDefined(); })`
- DB 레이어 테스트는 `mockDatabaseService`로 주입 — 실제 DB 연결 없음
