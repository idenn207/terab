---
description: Jest 단위 테스트 작성 패턴
globs:
  - "src/**/*.spec.ts"
alwaysApply: false
---

# 테스트 작성 패턴

## describe > it 필수 구조

최상위에 단독 `it`을 사용해서는 안 된다. 모든 `it`은 반드시 `describe` 블록 안에 위치해야 한다.

```ts
// ❌ 단독 it — 금지
it('인스턴스가 생성된다', () => { ... });

// ✅ describe > it — 필수
describe('TargetRepository', () => {
  it('인스턴스가 생성된다', () => { ... });
});
```

메서드별 케이스가 여럿일 때는 중첩 `describe`로 계층을 구분한다.

```ts
describe('TargetService', () => {
  describe('findById', () => {
    it('존재하는 id면 항목을 반환한다', async () => { ... });
    it('존재하지 않는 id면 null을 반환한다', async () => { ... });
  });

  describe('create', () => {
    it('유효한 입력이면 생성된 항목을 반환한다', async () => { ... });
    it('중복된 이름이면 DUPLICATE_NAME 예외를 던진다', async () => { ... });
  });
});
```

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

describe('TargetRepository', () => {
  describe('findById', () => {
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
  });
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
describe('UserService', () => {
  describe('getUser', () => {
    it('사용자 id를 반환한다', async () => {
      mockAuthRepository.findUserWithPermissionsById.mockResolvedValue({ id: mockUser.id });

      const result = await service.getUser(mockUser.id);

      expect(result.id).toBe(mockUser.id);
    });
  });
});
```

**실패(fail) 케이스**: 조회 결과가 없거나 조건을 만족하지 못하는 경우, mock은 `null`·`[]`·`false` 등 plain 값으로 설정하고 결과 검증도 단순하게 작성한다. fixture 속성을 참조할 필요가 없다.

```ts
describe('AuthRepository', () => {
  describe('findUserById', () => {
    it('userId에 해당하는 사용자가 없으면 null을 반환한다', async () => {
      mockAuthRepository.findUserWithPermissionsById.mockResolvedValue(null);

      const result = await repo.findUserById('ghost-id');

      expect(result).toBeNull();
    });
  });
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

## 실패 케이스 우선 작성

테스트 케이스는 **실패·예외 경로를 먼저, 더 많이** 작성한다. 성공 경로는 최소한으로만 작성한다.

### throw 케이스

서비스에서 `throw new ApiException(...)` 이 발생해야 하는 조건을 반드시 검증한다.

```ts
describe('FileService', () => {
  describe('getFile', () => {
    it('파일이 존재하지 않으면 FILE_NOT_FOUND 예외를 던진다', async () => {
      mockFileRepository.findById.mockResolvedValue(null);

      await expect(service.getFile('ghost-id', mockAuthUser)).rejects.toThrow(ApiException);
      await expect(service.getFile('ghost-id', mockAuthUser)).rejects.toMatchObject({
        errorCode: 'FILE_NOT_FOUND',
      });
    });
  });
});
```

### false / null / 빈 결과 케이스

조건 불충족·조회 실패 경로를 명시적으로 검증한다.

```ts
describe('FileRepository', () => {
  describe('findById', () => {
    it('일치하는 파일이 없으면 null을 반환한다', async () => {
      mockDbLimit.mockResolvedValue([]);

      const result = await repo.findById('ghost-id');

      expect(result).toBeNull();
    });
  });
});

describe('FileService', () => {
  describe('hasAccess', () => {
    it('권한이 없으면 false를 반환한다', async () => {
      mockPermissionRepository.findByUserAndFile.mockResolvedValue(null);

      const result = await service.hasAccess(mockAuthUser.id, 'file-id');

      expect(result).toBe(false);
    });
  });
});
```

### 케이스 작성 순서

각 메서드/핸들러에 대해 아래 순서로 케이스를 작성한다.

1. **입력 없음·빈 값** — null, [], 빈 문자열 등 경계 입력
2. **조회 실패** — 존재하지 않는 id, 삭제된 리소스 등
3. **권한·상태 불일치** — 권한 없음, 만료, 비활성 등
4. **성공** — 정상 경로 (위 케이스를 모두 다룬 뒤 마지막에 작성)

## 주의사항

### jest.clearAllMocks()는 구현을 초기화하지 않는다

`jest.clearAllMocks()`는 mock 호출 기록(`calls`, `instances`, `results`)만 초기화한다. `mockResolvedValue`·`mockRejectedValue`·`mockReturnValue` 등으로 설정한 **구현(implementation)은 그대로 남는다.**

이 때문에 이전 테스트에서 설정한 mock 반환값이 다음 테스트로 의도치 않게 전달(누출)될 수 있다.

```ts
describe('UploadSessionService', () => {
  describe('cleanupExpired', () => {
    // ❌ 위험 — 이전 테스트의 구현이 남아 있으면 통과하고, 없으면 실패
    it('abortMultipartUpload + removeObject를 호출한다', async () => {
      // abortMultipartUpload에 구현을 설정하지 않음
      // → jest.fn() 기본 반환값 undefined
      // → undefined.catch(...) → TypeError 발생
      // → 외부 try/catch에서 잡혀 removeObject가 호출되지 않음
      const stats = await service.cleanupExpired(500);
      expect(mockMinioService.removeObject).toHaveBeenCalled(); // 실패
    });

    // ✅ 각 테스트에서 사용할 mock을 명시적으로 선언
    it('abortMultipartUpload + removeObject를 호출한다', async () => {
      mockMinioService.abortMultipartUpload.mockResolvedValue(undefined);
      mockMinioService.removeObject.mockResolvedValue(undefined);

      const stats = await service.cleanupExpired(500);
      expect(mockMinioService.removeObject).toHaveBeenCalled(); // 통과
    });
  });
});
```

**규칙**: 테스트에서 호출될 외부 의존성(MinIO, 외부 서비스 등)의 mock은 **해당 테스트 안에서 반드시 명시적으로 선언**한다. 이전 테스트에서 설정된 구현에 의존하지 않는다.

## Pino 로거 Mock

로거를 주입받는 클래스를 테스트할 때 `createPinoLoggerProvider`를 사용한다.

```ts
import { createPinoLoggerProvider } from '@terab/test';

describe('ExampleService', () => {
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ExampleService,
        createPinoLoggerProvider(ExampleService.name),
      ],
    }).compile();
  });
});
```

- `createPinoLoggerProvider(ClassName.name)` — `@InjectPinoLogger` 토큰에 `mockPinoLogger` 바인딩
- `mockPinoLogger`는 `debug`/`info`/`warn`/`error` 모두 `jest.fn()`으로 구성
- 로거 호출 여부는 일반적으로 assert 대상이 아니다 — 로거는 부수 효과이므로 비즈니스 결과를 검증하는 데 집중한다

## 핵심 규칙

- **`describe > it` 구조 필수** — 최상위에 단독 `it` 사용 금지. 모든 `it`은 `describe` 블록 안에 위치해야 한다
- 테스트 설명(`describe`/`it`)은 한글로 작성
- **실패 케이스가 성공 케이스보다 많아야 한다** — 성공 경로는 최소한으로, 실패·예외 경로는 빠짐없이 작성
- `setupMockDbSelectChain()`은 `jest.clearAllMocks()` 호출 직후 실행 (순서 바꾸면 mock 체인 깨짐)
- Mock 유틸 import: `@terab/test` 패키지 (`mockDatabaseService`, `setupMockDbSelectChain`, `mockDbLimit` 등)
- 첫 번째 테스트는 항상 `it('인스턴스가 생성된다', () => { expect(target).toBeDefined(); })`
- DB 레이어 테스트는 `mockDatabaseService`로 주입 — 실제 DB 연결 없음
