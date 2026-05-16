# NestJS 클래스 패턴

NestJS는 클래스 기반 TypeScript를 사용한다. Express처럼 파일 최상단에 상수·헬퍼 함수를 선언하지 않는다.

## 상수

```ts
// ❌ 클래스 외부 (Express 스타일)
const MAX_RETRY = 3;
const DEFAULT_PAGE_SIZE = 20;

@Injectable()
export class ExampleService {
  // ...
}

// ✅ 클래스 내부 — private readonly 또는 private static readonly
@Injectable()
export class ExampleService {
  private readonly MAX_RETRY = 3;
  private static readonly DEFAULT_PAGE_SIZE = 20; // 인스턴스 상태와 무관한 경우
}
```

- 상수는 클래스 최상단(생성자 위)에 선언
- 인스턴스마다 달라지지 않는 단순 리터럴도 `private readonly`로 클래스 내부에 둔다
- `static readonly`는 인스턴스 상태와 완전히 무관한 경우에만 사용

## 헬퍼 함수

```ts
// ❌ 클래스 외부 standalone 함수
function buildWhereClause(userId: string) { ... }
function formatResponse(row: Row) { ... }

// ✅ 클래스 내부 private 메서드
@Injectable()
export class ExampleRepository {
  private buildWhereClause(userId: string) { ... }
  private formatResponse(row: Row) { ... }
}
```

- 특정 클래스에서만 쓰이는 함수는 반드시 해당 클래스의 `private` 메서드로 작성
- 여러 클래스에서 공유해야 한다면 별도 `@Injectable()` 유틸 서비스로 추출하고 DI로 주입

## 타입·인터페이스

클래스 내부에 들어갈 수 없는 타입·인터페이스는 파일 최상단 선언이 허용된다.

```ts
// ✅ 허용 — 타입은 클래스 멤버가 될 수 없으므로 외부 선언
interface RawRow {
  id: string;
  name: string;
}

@Injectable()
export class ExampleRepository {
  private aggregate(rows: RawRow[]) { ... }
}
```

## 요약

| 대상 | 위치 |
|---|---|
| 상수 (리터럴, 계산식) | 클래스 내 `private readonly` |
| 헬퍼 함수 | 클래스 내 `private` 메서드 |
| 공유 유틸 | 별도 `@Injectable()` 서비스로 추출 |
| 타입·인터페이스 | 파일 최상단 허용 |
