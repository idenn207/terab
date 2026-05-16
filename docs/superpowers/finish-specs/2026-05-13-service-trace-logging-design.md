# Service Trace Logging — 운영 재현 가능한 자동 로깅 설계

- **작성일**: 2026-05-13
- **대상 서비스**: `services/api`
- **상태**: Draft (사용자 리뷰 대기)

---

## 0. 배경과 목표

현재 API는 `nestjs-pino` 기반 로깅을 사용하지만, 비즈니스 로직에 로거가 거의 깔려 있지 않다 (`@InjectPinoLogger` 실사용 3개 파일). 결과적으로 운영 중 오류가 발생하면 "오류가 났다"는 사실(`ApiExceptionFilter`)과 일부 부수 효과(MinIO 호출) 정도만 추적되고, **그 직전 비즈니스 분기·입력 컨텍스트가 사실상 사라진다.**

본 설계는 다음을 달성한다.

1. service 레이어 메서드 호출/응답을 **자동**으로 trace 한다 (수동 logger 호출 없이).
2. Drizzle SQL을 같은 요청 컨텍스트로 묶어 함께 기록한다.
3. 오류가 발생한 요청은 입력값·SQL 파라미터까지 포함된 상세 trace를 별도 라인으로 남겨 **운영 재현이 가능하도록** 한다.
4. 일반 요청은 가벼운 메타데이터만 남겨 디스크/IO 부담을 최소화한다.
5. 로그 파일은 **JSON Lines** 포맷으로 외부 분석 서비스가 공동 자원처럼 소비한다 (이 API의 어드민에서 직접 조회하지 않는다).

## 1. 핵심 아키텍처

```
HTTP 요청
  │
  ▼
[pino-http] reqId 부여 → AsyncLocalStorage(CLS) 시작
  │
  ▼
Controller (변경 없음)
  │
  ▼
TraceInterceptor (글로벌)
  ├─ 요청 trace 컨테이너를 CLS에 생성
  └─ try → 정상이면 메타 한 줄 flush
     catch → 메타 + 상세 trace 통째 flush (err 레벨)
  │
  ▼
ServiceMethodWrapper (자동 trace span 누적)
  ├─ ServiceCore 자손 클래스의 public 메서드를 onModuleInit 시점에 wrap
  ├─ @LogReplay() 메서드는 입력 페이로드도 캡처 (상세에만 포함)
  └─ 각 호출마다 CLS 컨테이너에 span push
  │
  ▼
DrizzleQueryLogger
  └─ 매 SQL 실행을 CLS 컨테이너의 같은 trace에 SQL span으로 push
       (params는 마스킹 후 보관)
  │
  ▼
[pino transport] pino-roll → /app/logs/app-YYYY-MM-DD.jsonl
```

### 1.1 핵심 구성 요소

| 구성 요소                                          | 책임                                                                                                                                                                                                      |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RequestTraceContext` (CLS / `AsyncLocalStorage`)  | `reqId`, `userId`, `route`, `spans[]`, `startedAt`을 한 요청 동안 보관. service wrapper와 drizzle logger가 같은 컨테이너에 누적                                                                           |
| `ServiceMethodWrapper`                             | `ServiceCore` 자손 클래스의 `public` 메서드를 자동 wrap. NestJS `DiscoveryService`로 부팅 시 모든 provider를 순회하면서 대상 클래스의 prototype 메서드를 wrap 함수로 교체. 진입/완료/예외를 span으로 push |
| `@AutoTrace()` 클래스 데코레이터                   | `ServiceCore`를 extends하지 않은 service의 자동 wrap 옵트인                                                                                                                                               |
| `@LogReplay({ captureResult? })` 메서드 데코레이터 | A 레벨 표기. 입력 페이로드(옵션: 결과값)까지 캡처                                                                                                                                                         |
| `@SkipTrace()` 메서드 데코레이터                   | 자동 wrap에서 제외                                                                                                                                                                                        |
| `TraceInterceptor`                                 | 글로벌 NestJS 인터셉터. CLS 컨테이너 생성/플러시 담당                                                                                                                                                     |
| `TraceFlusher`                                     | meta/detail 직렬화 후 pino logger에 위임                                                                                                                                                                  |
| `PiiMasker`                                        | 키 이름 블랙리스트 기반 자동 마스킹                                                                                                                                                                       |
| `DrizzleQueryLogger`                               | drizzle `logger.logQuery` 콜백 → CLS 컨테이너에 SQL span push                                                                                                                                             |

### 1.2 자동 wrap 트리거 정책

- **기본 (자동)**: `ServiceCore`를 extends한 클래스. 트랜잭션 boundary == trace boundary == 의미 있는 비즈니스 단위라는 도메인적 진실을 활용.
- **옵트인**: `ServiceCore` 미사용 단순 조회 service에 `@AutoTrace()` 클래스 데코레이터.
- **공통 제외**:
  - `private` 메서드 (span 폭증 방지)
  - `@SkipTrace()` 표기 메서드
  - NestJS 라이프사이클 훅 (`onModuleInit`, `onApplicationBootstrap` 등) — 수동 스킵 리스트로 관리
  - 생성자

## 2. JSON Lines 레코드 스키마 (분석 서비스와의 계약)

같은 요청에서 **최대 두 줄**이 출력된다. 정상 요청은 `meta` 한 줄, 오류 요청은 `meta` + `detail` 두 줄. 둘은 같은 `reqId`로 조인된다.

### 2.1 공통 필드

| 필드      | 타입                               | 비고                                                   |
| --------- | ---------------------------------- | ------------------------------------------------------ |
| `time`    | number                             | pino 기본 epoch ms                                     |
| `level`   | number                             | pino 기본 (info=30, error=50)                          |
| `event`   | `'trace.meta'` \| `'trace.detail'` | 분석 서비스가 이 키로 분기                             |
| `reqId`   | string                             | pino-http `genReqId` (X-Request-Id 또는 UUID)          |
| `service` | string                             | 항상 `'api'` (향후 mq 서비스도 같은 포맷을 쓸 수 있음) |

### 2.2 `trace.meta` (모든 요청에 1회, level=info)

```json
{
  "time": 1747120000123,
  "level": 30,
  "event": "trace.meta",
  "reqId": "01J9...",
  "service": "api",
  "userId": "uuid|null",
  "route": "POST /api/files/upload-init",
  "status": 200,
  "durationMs": 142,
  "outcome": "ok",
  "spanCounts": { "service": 3, "sql": 7 },
  "hasDetail": false
}
```

- `outcome`: `'ok'` | `'api_exception'` | `'unhandled'`
- `hasDetail`: 같은 `reqId`로 `trace.detail` 라인이 곧 따라옴을 분석 서비스에 알림

### 2.3 `trace.detail` (오류 발생 시에만, level=error)

```json
{
  "time": 1747120000125,
  "level": 50,
  "event": "trace.detail",
  "reqId": "01J9...",
  "service": "api",
  "error": {
    "kind": "ApiException",
    "code": "FILE_NOT_FOUND",
    "message": "...",
    "stack": "..."
  },
  "spans": [
    {
      "kind": "service",
      "class": "FileService",
      "method": "getFile",
      "startedAt": 1747120000010,
      "durationMs": 12,
      "replay": false,
      "args": null,
      "result": null,
      "error": null
    },
    {
      "kind": "service",
      "class": "FolderService",
      "method": "moveFile",
      "startedAt": 1747120000023,
      "durationMs": 87,
      "replay": true,
      "args": { "fileId": "...", "targetFolderId": "...", "password": "***" },
      "result": null,
      "error": { "code": "FILE_NOT_FOUND" }
    },
    {
      "kind": "sql",
      "sql": "select \"files\".* from \"files\" where ...",
      "params": ["uuid-1"],
      "startedAt": 1747120000028,
      "durationMs": null,
      "rowCount": null
    }
  ]
}
```

- `spans[]`는 호출 순서대로 push (시간순). 부모-자식 트리 X — 분석 서비스가 필요 시 `startedAt`으로 정렬.
- `replay: true`인 service span만 `args` 채움. 미표기 service span은 `args: null`.
- `result`는 기본 `null`. `@LogReplay({ captureResult: true })` 명시 시에만 채움.
- 모든 span의 `args`/`result`/`sql.params`는 **마스킹 후** 저장.
- SQL span의 `durationMs`/`rowCount`는 Drizzle이 기본 logger에서 제공하지 않아 1차 구현에서는 `null`. 후속 작업으로 client wrapper를 두면 채울 수 있음.

### 2.4 `outcome` 별 detail 플러시 정책

| outcome               | 정의                                  | detail 플러시? |
| --------------------- | ------------------------------------- | -------------- |
| `ok`                  | 정상 응답                             | ❌ (meta만)    |
| `api_exception` (4xx) | `ApiException` — 예상된 사용자 오류   | ❌ (소음 회피) |
| `api_exception` (5xx) | `ApiException`인데 `HttpStatus`가 5xx | ✅             |
| `unhandled`           | 비-`ApiException`, 예상치 못한 throw  | ✅             |

`ApiException` 4xx는 사용자 입력 오류가 대다수로 운영 재현 가치가 낮다. 5xx로 등록된 `ApiException`과 catch되지 않은 일반 예외만 detail로 보낸다.

## 3. 데이터 흐름 · 동기/비동기 · 버퍼 한계

### 3.1 요청 라이프사이클

```
1. pino-http 미들웨어: reqId 부여
2. 글로벌 TraceInterceptor:
     CLS.run({ reqId, userId, route, spans:[], startedAt }) → next.handle()
3. Service 메서드 호출:
     ServiceMethodWrapper가 span push → 원본 호출 → span에 durationMs/error 채움
4. Drizzle SQL 실행:
     drizzle.logger 콜백 → 같은 CLS 컨테이너에 sql span push
5. 정상 종료:
     TraceInterceptor의 tap(next) → 메타 한 줄 logger.info({ event: 'trace.meta', ... })
6. 오류 종료:
     TraceInterceptor의 catchError → 메타 한 줄 + 상세 한 줄 logger.error({ event: 'trace.detail', ... })
7. ApiExceptionFilter는 변경 없음 — 응답 직렬화만 담당
```

### 3.2 동기/비동기

- **응답 경로는 절대 블로킹하지 않는다.** pino는 본디 비동기 직렬화. 추가로 `pino.transport`(`pino-roll`)는 worker thread에서 동작 → 디스크 I/O가 응답 지연에 영향 없음.
- TraceInterceptor의 flush는 `logger.info/error` 호출 1회뿐 — 실제 직렬화는 transport worker가 처리.

### 3.3 버퍼 한계 (메모리 보호)

| 항목                             | 한계  | 초과 시 동작                                               |
| -------------------------------- | ----- | ---------------------------------------------------------- |
| `spans.length`                   | 1000  | 이후 span은 `dropped` 카운터만 증가                        |
| 단일 `args`/`result` 직렬화 크기 | 8KB   | `"<truncated:size=12345>"` 문자열로 치환                   |
| `sql.params` 항목당 크기         | 1KB   | 동일 truncate                                              |
| 한 trace.detail 총 크기          | 256KB | 초과 시 spans 앞에서부터 잘라내고 `truncated: true` 플래그 |

상수는 `src/logger/trace.limits.ts`에 분리한다.

### 3.4 Drizzle logger 통합 지점

```ts
drizzle(client, {
  schema,
  logger: {
    logQuery: (query, params) => {
      const ctx = RequestTraceContext.current();
      if (!ctx) return; // 요청 컨텍스트 밖(마이그레이션, 워커)에서는 무시
      ctx.pushSqlSpan({ sql: query, params: maskParams(params) });
    },
  },
});
```

Drizzle `logger.logQuery`는 duration/rowCount를 제공하지 않아 1차 구현은 `null`로 둔다. 필요 시 client wrapper로 후속 보강.

## 4. PII 마스킹

두 단계로 적용한다.

### 4.1 1단계: pino `redact` (path 기반, 최후의 안전망)

```ts
pinoHttp: {
  redact: {
    paths: [
      '*.password', '*.token', '*.refreshToken', '*.accessToken', '*.secret',
      'spans[*].args.password', 'spans[*].args.token',
    ],
    censor: '***',
  },
}
```

직렬화 직전 적용. 알려진 경로는 여기서 한 번 더 잡힌다.

### 4.2 2단계: `PiiMasker` 객체 (값 캡처 시점, 주력)

`ServiceMethodWrapper`가 `args`/`result`를 캡처할 때 호출한다.

```ts
private static readonly MASK_KEYS = new Set([
  'password', 'currentPassword', 'newPassword',
  'token', 'accessToken', 'refreshToken',
  'secret', 'apiKey', 'authorization',
  'totpSecret', 'otp',
]);
```

- 대소문자 무시 매칭 (`key.toLowerCase()`)
- 중첩 객체는 재귀, 배열은 인덱스 순회
- 순환 참조 방지 (`WeakSet`)
- 최대 깊이 10 (그 이후는 `'<deep>'`)
- 클래스 인스턴스는 `toJSON`이 있으면 그 결과를 마스킹, 없으면 enumerable 키만

### 4.3 정책

- 새 민감 키가 발견되면 **`MASK_KEYS` 추가가 유일한 작업**.
- `@LogReplay()` 메서드라도 마스킹은 동일 적용.
- 마스킹 누락 사고를 막기 위해 본 spec의 §7.2-E를 PR 리뷰 항목으로 본다.

## 5. 테스트 전략

| 테스트 대상                | 방법                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| `RequestTraceContext`      | 단위: `als.run()` 안팎에서 `current()` 결과 검증                                                 |
| `ServiceMethodWrapper`     | 단위: 더미 `ServiceCore` 자손 클래스를 wrap 후 호출 → span이 CLS에 push됐는지 검증               |
| `@LogReplay()` 동작        | 단위: replay 표기 메서드는 `args` 캡처, 미표기는 `null`                                          |
| `@SkipTrace()` 동작        | 단위: span이 push되지 않음                                                                       |
| `PiiMasker`                | 단위: 키 매칭, 중첩, 순환, depth, truncate (실패 케이스 위주)                                    |
| Drizzle logger 통합        | 단위: CLS 없는 상태에서 `logQuery` 호출 → 예외 없이 무시                                         |
| TraceInterceptor 정상 경로 | 통합: 더미 controller + service 등록, request 1회 → `logger.info`가 `trace.meta`로 1회 호출      |
| TraceInterceptor 오류 경로 | 통합: service에서 `ApiException` 5xx throw → `logger.info`(meta) + `logger.error`(detail) 각 1회 |
| 4xx ApiException 정책      | 통합: 4xx throw → meta만, detail 호출 0                                                          |
| 버퍼 한계                  | 단위: 1001번 span push → 1000개에서 멈추고 `dropped`=1                                           |

- 테스트는 `createPinoLoggerProvider`로 pino를 mock — 실제 파일 I/O 없음.
- 본 시스템은 logger 호출 인자 검증이 의미를 갖는 **유일한 예외**다 (`event: 'trace.meta'` 등). `testing.md`에 후속 한 줄 추가.

## 6. 로깅 외 대안 검토

| 방향                                    | 평가                                                                                                                                                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **OpenTelemetry (OTLP) + Jaeger/Tempo** | 표준 분산 트레이싱. 강력하지만 self-hosted NAS에 인덱서·UI·콜렉터 추가 필요. 본 설계의 JSON Lines 구조가 OTel "span" 개념과 1:1 호환이라, 분석 서비스가 OTel 포맷으로 변환만 하면 표준 도구를 붙일 수 있음. **지금은 부적합, 미래 호환만 유지.** |
| **Sentry self-hosted**                  | 오류 추적 특화. 입력 페이로드/SQL trace 캡처 가능. 단점: self-host 인프라가 무거움 (PG + ClickHouse + Redis + Kafka). NAS 부담 큼.                                                                                                               |
| **APM (Elastic APM)**                   | OTel과 유사. 인프라 부담 동일.                                                                                                                                                                                                                   |
| **PostgreSQL Audit log**                | "재현"보다 "감사" 영역. 필요 시 별도 레이어로 추가 가능.                                                                                                                                                                                         |
| **결정한 방안**                         | 구조화된 JSON Lines + CLS 기반 trace 컨텍스트 + 자가 분석 서비스 = **self-hosted lightweight distributed tracing**. NAS에서 가장 가벼우면서, 분석 서비스가 §0의 (2) 전체 검색까지 흡수 가능. OTel 호환 포맷으로 미래 표준화 경로 유지.           |

## 7. 사용 가이드

### 7.1 한 줄 요약

> **`ServiceCore`를 extends한 service의 public 메서드는 자동으로 trace된다. 페이로드까지 캡처하고 싶으면 `@LogReplay()`, 빼고 싶으면 `@SkipTrace()`.**

### 7.2 시나리오별 레시피

#### A. 새 service 추가

별도 작업 없음. `ServiceCore` extends만 하면 자동.

```ts
@Injectable()
export class FileService extends ServiceCore {
  async getFile(id: string) { ... } // 자동 trace 대상
}
```

#### B. 트랜잭션 불필요 단순 조회 service (`ServiceCore` 미사용)

`@AutoTrace()` 클래스 데코레이터 명시.

```ts
@Injectable()
@AutoTrace()
export class FileQueryService {
  async listByOwner(userId: string) { ... }
}
```

#### C. 입력값까지 운영 재현용으로 남기기

`@LogReplay()` 메서드 데코레이터.

```ts
@LogReplay()
async moveFile(fileId: string, targetFolderId: string) { ... }

@LogReplay({ captureResult: true })
async computeBilling(input: BillingInput): Promise<BillingResult> { ... }
```

#### D. 자동 wrap에서 특정 메서드 제외

`@SkipTrace()` — 너무 자주 호출되거나 민감한 경로.

```ts
@SkipTrace()
async refreshAccessToken(refreshToken: string) { ... }
```

#### E. 새 민감 키 추가

`PiiMasker.MASK_KEYS` 한 곳만 추가.

```ts
// src/logger/pii-masker.ts
private static readonly MASK_KEYS = new Set([
  ...,
  'newSensitiveField', // 추가
]);
```

#### F. private 메서드 wrap 여부

wrap 안 됨. `public` 메서드만 대상. private 호출은 호출한 public 메서드의 duration에 흡수.

#### G. 워커/cron 같이 HTTP 요청 밖에서 호출

`RequestTraceContext.current()`가 `null`이라 자동 trace 무시. 워커에서 trace가 필요하면 직접 컨텍스트를 연다.

```ts
await RequestTraceContext.run({ reqId: workerJobId, userId: null, route: 'worker:cleanup', spans: [], startedAt: Date.now() }, async () => {
  await uploadSessionService.cleanupExpired();
});
```

후속으로 `upload-session.cleanup.worker.ts`에 적용 검토.

### 7.3 로그 확인 방법

- 파일 경로: `/app/logs/app-YYYY-MM-DD.jsonl` (개발 환경은 stdout pretty)
- 한 요청 trace 보기: `grep '"reqId":"<id>"' app-*.jsonl` → 최대 두 줄 (meta + detail)
- 분석 서비스는 이 파일을 tail-following 또는 일별 배치로 소비. 이 API의 책임 밖.

### 7.4 FAQ (자주 빠지는 함정)

| 상황                                           | 원인                                          | 해결                                                      |
| ---------------------------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| 메서드를 만들었는데 trace가 안 찍힌다          | `ServiceCore` 미extends + `@AutoTrace()` 누락 | 둘 중 하나 적용                                           |
| `@LogReplay()` 붙였는데 args가 `null`로 찍힌다 | private 메서드에 붙임                         | public 메서드로 옮기거나 호출하는 public 메서드에 붙이기  |
| Drizzle SQL이 trace에 안 보인다                | 요청 컨텍스트 밖(워커·마이그레이션) 호출      | 워커는 `RequestTraceContext.run()`으로 직접 컨텍스트 열기 |
| 입력값이 `'<truncated:size=...>'`로 찍힌다     | 8KB 초과                                      | 의도된 동작. 페이로드 축소 또는 요약 필드만 캡처          |
| 비밀번호가 평문으로 보인다                     | 키 이름이 마스킹 블랙리스트에 없음            | `PiiMasker.MASK_KEYS`에 추가 + 즉시 핫픽스                |
| 4xx ApiException의 detail이 필요하다           | 정책상 4xx는 detail flush 안 함               | 본 spec에는 미포함. 필요 시 후속 `@ForceDetail()` 검토    |

### 7.5 `.claude/rules/logging.md` 갱신 (Claude 작업 일관성)

본 시스템 도입과 함께 룰 파일에 다음을 추가한다.

- service 메서드의 진입/완료/실패는 자동 trace된다 — `this.logger.debug('메서드 진입')` 같은 수동 호출은 작성하지 않는다.
- 여전히 `this.logger.info/warn/error`로 명시적으로 남길 가치가 있는 비즈니스 이벤트(파일 업로드 완료 등)는 그대로 둔다.
- 민감 키 추가는 `PiiMasker.MASK_KEYS`에서만 관리한다.

### 7.6 운영 시 점검 체크리스트

- [ ] `/app/logs/` 볼륨이 30일치 용량을 감당하는가? (pino-roll `count: 30` 설정)
- [ ] `trace.meta` 라인이 실제 요청 수와 비슷한가? (누락 모니터링)
- [ ] `trace.detail`이 발생한 reqId가 nginx access log에 같이 보이는가? (X-Request-Id 일관성 검증)
- [ ] 새로 추가된 service 클래스가 `ServiceCore` extends 또는 `@AutoTrace()` 중 하나를 따랐는가? (PR 리뷰 항목)

## 8. 영향 범위 / 신규·변경 파일

### 8.1 신규

| 경로                                            | 역할                           |
| ----------------------------------------------- | ------------------------------ |
| `src/logger/request-trace-context.ts`           | CLS 기반 요청 컨텍스트         |
| `src/logger/service-method-wrapper.ts`          | `ServiceCore` 자손 자동 wrap   |
| `src/logger/trace.interceptor.ts`               | 글로벌 NestJS 인터셉터         |
| `src/logger/trace.flusher.ts`                   | meta/detail 직렬화 + pino 위임 |
| `src/logger/trace.limits.ts`                    | 버퍼 한계 상수                 |
| `src/logger/auto-trace.decorator.ts`            | `@AutoTrace()`                 |
| `src/logger/log-replay.decorator.ts`            | `@LogReplay()`                 |
| `src/logger/skip-trace.decorator.ts`            | `@SkipTrace()`                 |
| `src/logger/pii-masker.ts`                      | 키 블랙리스트 마스킹           |
| `src/logger/drizzle-query-logger.ts`            | drizzle `logger.logQuery` 콜백 |
| `src/logger/*.spec.ts`                          | 각 컴포넌트 단위 테스트        |
| `test/trace.e2e-spec.ts` (또는 기존 e2e에 추가) | 정상/오류 경로 통합 검증       |

### 8.2 변경

| 경로                               | 변경 내용                                               |
| ---------------------------------- | ------------------------------------------------------- |
| `src/logger/logger.config.ts`      | pino `redact` 옵션 추가                                 |
| `src/logger/logger.module.ts`      | `TraceInterceptor`/`ServiceMethodWrapper` provider 등록 |
| `src/database/database.service.ts` | drizzle `logger` 옵션에 `DrizzleQueryLogger` 연결       |
| `src/app.module.ts`                | `TraceInterceptor`를 `APP_INTERCEPTOR`로 등록           |
| `.claude/rules/logging.md`         | §7.5 항목 반영                                          |
| `services/api/CLAUDE.md`           | "로거 사용" 절에 자동 trace 안내 추가                   |

### 8.3 손대지 않는 곳

- `ApiExceptionFilter` (응답 직렬화만 담당, 본 시스템과 분리)
- Controller / `@TsRestHandler` (HTTP는 nginx access log로 대체)
- Repository (Drizzle logger가 SQL 담당)

## 9. 후속 작업 (본 spec 범위 외)

- SQL span의 `durationMs`/`rowCount`를 채우는 drizzle client wrapper
- BullMQ 워커들에 `RequestTraceContext.run()` 적용 (특히 `upload-session.cleanup.worker.ts`)
- 분석 서비스 구축 (별도 프로젝트)
- 향후 mq 서비스가 같은 JSON Lines 포맷 채택
- 필요 시 `@ForceDetail()` 데코레이터 (4xx인데 detail이 필요한 케이스)
