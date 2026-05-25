# Service Trace Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `services/api`에 service 메서드 자동 trace + Drizzle SQL trace를 도입하여, 오류 발생 시 입력값·SQL 파라미터까지 포함된 JSON Lines 로그를 남겨 운영 재현을 가능하게 한다.

**Architecture:** AsyncLocalStorage(CLS) 기반 요청 컨텍스트에 service span과 SQL span을 누적, 글로벌 NestJS 인터셉터가 정상/오류 시점에 meta·detail 로그를 pino로 flush. 자동 wrap은 NestJS `DiscoveryService`로 부팅 시 `ServiceCore` 자손 클래스의 prototype 메서드를 교체.

**Tech Stack:** NestJS 11, nestjs-pino, pino-roll, `node:async_hooks` AsyncLocalStorage, Drizzle ORM, jest.

**Spec:** [docs/superpowers/specs/2026-05-13-service-trace-logging-design.md](../specs/2026-05-13-service-trace-logging-design.md)

---

## 사전 합의 사항

- 모든 파일은 `services/api/src/logger/` 평면 구조 (sub-folder 없음).
- 모든 신규 코드의 줄바꿈은 CRLF (Windows 개발 환경). docker/CI 대상 아님.
- 커밋 메시지는 한글, Conventional Commits. `Co-Authored-By` 태그 금지.
- 신규 클래스는 `private readonly` 상수 클래스 내부 선언 규칙 준수 ([class-patterns.md](../../../services/api/.claude/rules/class-patterns.md)).
- TDD: 각 컴포넌트 단위 테스트 → 구현 → 테스트 통과 → 커밋.

---

## Task 1: 타입 정의 + 한계 상수

**Files:**

- Create: `services/api/src/logger/trace.types.ts`
- Create: `services/api/src/logger/trace.limits.ts`

- [ ] **Step 1: 타입 파일 작성**

`services/api/src/logger/trace.types.ts`:

```ts
export type TraceOutcome = 'ok' | 'api_exception' | 'unhandled';

export interface ServiceSpan {
  kind: 'service';
  class: string;
  method: string;
  startedAt: number;
  durationMs: number | null;
  replay: boolean;
  args: unknown;
  result: unknown;
  error: { code?: string; message?: string } | null;
}

export interface SqlSpan {
  kind: 'sql';
  sql: string;
  params: unknown[];
  startedAt: number;
  durationMs: number | null;
  rowCount: number | null;
}

export type Span = ServiceSpan | SqlSpan;

export interface TraceContext {
  reqId: string;
  userId: string | null;
  route: string;
  spans: Span[];
  startedAt: number;
  droppedSpans: number;
}

export interface TraceMetaRecord {
  event: 'trace.meta';
  reqId: string;
  service: 'api';
  userId: string | null;
  route: string;
  status: number;
  durationMs: number;
  outcome: TraceOutcome;
  spanCounts: { service: number; sql: number };
  hasDetail: boolean;
  droppedSpans?: number;
}

export interface TraceDetailRecord {
  event: 'trace.detail';
  reqId: string;
  service: 'api';
  error: {
    kind: string;
    code?: string;
    message?: string;
    stack?: string;
  };
  spans: Span[];
  truncated?: true;
}
```

- [ ] **Step 2: 한계 상수 작성**

`services/api/src/logger/trace.limits.ts`:

```ts
export const TRACE_LIMITS = {
  MAX_SPANS: 1000,
  MAX_ARG_SIZE_BYTES: 8 * 1024,
  MAX_SQL_PARAM_SIZE_BYTES: 1024,
  MAX_DETAIL_SIZE_BYTES: 256 * 1024,
  MAX_MASK_DEPTH: 10,
} as const;
```

- [ ] **Step 3: 커밋**

```bash
git add services/api/src/logger/trace.types.ts services/api/src/logger/trace.limits.ts
git commit -m "feat(api): trace 타입 및 한계 상수 추가"
```

---

## Task 2: PiiMasker

**Files:**

- Create: `services/api/src/logger/pii-masker.ts`
- Test: `services/api/src/logger/pii-masker.spec.ts`

- [ ] **Step 1: 실패 테스트 작성**

`services/api/src/logger/pii-masker.spec.ts`:

```ts
import { PiiMasker } from './pii-masker';
import { TRACE_LIMITS } from './trace.limits';

describe('PiiMasker', () => {
  let masker: PiiMasker;

  beforeEach(() => {
    masker = new PiiMasker();
  });

  it('인스턴스가 생성된다', () => {
    expect(masker).toBeDefined();
  });

  describe('maskValue', () => {
    it('블랙리스트 키의 값을 *** 로 치환한다', () => {
      const result = masker.maskValue({ password: 'secret', name: 'kim' }, TRACE_LIMITS.MAX_ARG_SIZE_BYTES);
      expect(result).toEqual({ password: '***', name: 'kim' });
    });

    it('대소문자를 무시하고 마스킹한다', () => {
      const result = masker.maskValue({ Password: 'a', ACCESSTOKEN: 'b' }, TRACE_LIMITS.MAX_ARG_SIZE_BYTES);
      expect(result).toEqual({ Password: '***', ACCESSTOKEN: '***' });
    });

    it('중첩 객체도 마스킹한다', () => {
      const result = masker.maskValue({ user: { password: 'p' } }, TRACE_LIMITS.MAX_ARG_SIZE_BYTES);
      expect(result).toEqual({ user: { password: '***' } });
    });

    it('배열 안의 객체도 마스킹한다', () => {
      const result = masker.maskValue([{ token: 't' }, { token: 'u' }], TRACE_LIMITS.MAX_ARG_SIZE_BYTES);
      expect(result).toEqual([{ token: '***' }, { token: '***' }]);
    });

    it('순환 참조가 있어도 무한 루프에 빠지지 않는다', () => {
      const a: Record<string, unknown> = { name: 'a' };
      a.self = a;
      const result = masker.maskValue(a, TRACE_LIMITS.MAX_ARG_SIZE_BYTES) as Record<string, unknown>;
      expect(result.name).toBe('a');
      expect(result.self).toBe('<circular>');
    });

    it('최대 깊이를 초과하면 <deep>로 치환한다', () => {
      let nested: Record<string, unknown> = { leaf: 1 };
      for (let i = 0; i < 15; i++) nested = { child: nested };
      const result = masker.maskValue(nested, TRACE_LIMITS.MAX_ARG_SIZE_BYTES);
      const json = JSON.stringify(result);
      expect(json).toContain('<deep>');
    });

    it('직렬화 크기가 한계를 넘으면 <truncated:size=...>로 치환한다', () => {
      const big = { data: 'x'.repeat(10 * 1024) };
      const result = masker.maskValue(big, TRACE_LIMITS.MAX_ARG_SIZE_BYTES);
      expect(typeof result).toBe('string');
      expect(result as string).toMatch(/^<truncated:size=\d+>$/);
    });

    it('null/undefined/primitive는 그대로 반환한다', () => {
      expect(masker.maskValue(null, TRACE_LIMITS.MAX_ARG_SIZE_BYTES)).toBeNull();
      expect(masker.maskValue(undefined, TRACE_LIMITS.MAX_ARG_SIZE_BYTES)).toBeUndefined();
      expect(masker.maskValue(42, TRACE_LIMITS.MAX_ARG_SIZE_BYTES)).toBe(42);
      expect(masker.maskValue('hello', TRACE_LIMITS.MAX_ARG_SIZE_BYTES)).toBe('hello');
    });

    it('toJSON이 있는 객체는 그 결과를 마스킹한다', () => {
      const obj = {
        toJSON: () => ({ password: 'p', name: 'kim' }),
      };
      const result = masker.maskValue(obj, TRACE_LIMITS.MAX_ARG_SIZE_BYTES);
      expect(result).toEqual({ password: '***', name: 'kim' });
    });
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd services/api && npm test -- pii-masker.spec.ts`
Expected: FAIL — `Cannot find module './pii-masker'`

- [ ] **Step 3: PiiMasker 구현**

`services/api/src/logger/pii-masker.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { TRACE_LIMITS } from './trace.limits';

@Injectable()
export class PiiMasker {
  private static readonly MASK_KEYS = new Set<string>([
    'password',
    'currentpassword',
    'newpassword',
    'token',
    'accesstoken',
    'refreshtoken',
    'secret',
    'apikey',
    'authorization',
    'totpsecret',
    'otp',
  ]);

  private readonly CIRCULAR = '<circular>';
  private readonly DEEP = '<deep>';
  private readonly MASK = '***';

  maskValue(value: unknown, sizeLimitBytes: number): unknown {
    const seen = new WeakSet<object>();
    const masked = this.walk(value, 0, seen);
    const json = this.safeStringify(masked);
    if (json !== null && Buffer.byteLength(json, 'utf8') > sizeLimitBytes) {
      return `<truncated:size=${Buffer.byteLength(json, 'utf8')}>`;
    }
    return masked;
  }

  private walk(value: unknown, depth: number, seen: WeakSet<object>): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'object') return value;

    if (depth >= TRACE_LIMITS.MAX_MASK_DEPTH) return this.DEEP;

    if (seen.has(value as object)) return this.CIRCULAR;
    seen.add(value as object);

    if (Array.isArray(value)) {
      return value.map((item) => this.walk(item, depth + 1, seen));
    }

    const source = this.unwrapToJSON(value);
    if (source === null || typeof source !== 'object') {
      return this.walk(source, depth, seen);
    }

    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source)) {
      const childValue = (source as Record<string, unknown>)[key];
      if (PiiMasker.MASK_KEYS.has(key.toLowerCase())) {
        result[key] = this.MASK;
      } else {
        result[key] = this.walk(childValue, depth + 1, seen);
      }
    }
    return result;
  }

  private unwrapToJSON(value: object): unknown {
    const toJSON = (value as { toJSON?: () => unknown }).toJSON;
    if (typeof toJSON === 'function') {
      return toJSON.call(value);
    }
    return value;
  }

  private safeStringify(value: unknown): string | null {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd services/api && npm test -- pii-masker.spec.ts`
Expected: PASS — 모든 케이스

- [ ] **Step 5: 커밋**

```bash
git add services/api/src/logger/pii-masker.ts services/api/src/logger/pii-masker.spec.ts
git commit -m "feat(api): PiiMasker 추가 (키 블랙리스트 + 깊이/순환/크기 보호)"
```

---

## Task 3: RequestTraceContext (CLS)

**Files:**

- Create: `services/api/src/logger/request-trace-context.ts`
- Test: `services/api/src/logger/request-trace-context.spec.ts`

- [ ] **Step 1: 실패 테스트 작성**

`services/api/src/logger/request-trace-context.spec.ts`:

```ts
import { RequestTraceContext } from './request-trace-context';
import { TRACE_LIMITS } from './trace.limits';

describe('RequestTraceContext', () => {
  it('run() 밖에서는 current()가 null을 반환한다', () => {
    expect(RequestTraceContext.current()).toBeNull();
  });

  it('run() 안에서는 current()가 컨테이너를 반환한다', async () => {
    let observed: ReturnType<typeof RequestTraceContext.current> = null;
    await RequestTraceContext.run(
      { reqId: 'r1', userId: 'u1', route: 'GET /x', spans: [], startedAt: 0, droppedSpans: 0 },
      async () => {
        observed = RequestTraceContext.current();
      },
    );
    expect(observed).not.toBeNull();
    expect(observed!.reqId).toBe('r1');
  });

  it('컨테이너는 비동기 경계를 가로질러 유지된다', async () => {
    let observedAfterAwait: string | null = null;
    await RequestTraceContext.run(
      { reqId: 'r2', userId: null, route: 'GET /y', spans: [], startedAt: 0, droppedSpans: 0 },
      async () => {
        await Promise.resolve();
        observedAfterAwait = RequestTraceContext.current()?.reqId ?? null;
      },
    );
    expect(observedAfterAwait).toBe('r2');
  });

  it('pushServiceSpan은 컨테이너에 service span을 추가한다', async () => {
    await RequestTraceContext.run(
      { reqId: 'r3', userId: null, route: '', spans: [], startedAt: 0, droppedSpans: 0 },
      async () => {
        RequestTraceContext.pushServiceSpan({
          kind: 'service',
          class: 'X',
          method: 'm',
          startedAt: 1,
          durationMs: 2,
          replay: false,
          args: null,
          result: null,
          error: null,
        });
        expect(RequestTraceContext.current()!.spans).toHaveLength(1);
      },
    );
  });

  it('span 수가 MAX_SPANS에 도달하면 이후 push는 droppedSpans만 증가시킨다', async () => {
    await RequestTraceContext.run(
      { reqId: 'r4', userId: null, route: '', spans: [], startedAt: 0, droppedSpans: 0 },
      async () => {
        for (let i = 0; i < TRACE_LIMITS.MAX_SPANS + 5; i++) {
          RequestTraceContext.pushServiceSpan({
            kind: 'service',
            class: 'X',
            method: 'm',
            startedAt: i,
            durationMs: 0,
            replay: false,
            args: null,
            result: null,
            error: null,
          });
        }
        const ctx = RequestTraceContext.current()!;
        expect(ctx.spans).toHaveLength(TRACE_LIMITS.MAX_SPANS);
        expect(ctx.droppedSpans).toBe(5);
      },
    );
  });

  it('컨테이너 밖에서 push 호출하면 무시한다', () => {
    expect(() =>
      RequestTraceContext.pushServiceSpan({
        kind: 'service',
        class: 'X',
        method: 'm',
        startedAt: 0,
        durationMs: 0,
        replay: false,
        args: null,
        result: null,
        error: null,
      }),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd services/api && npm test -- request-trace-context.spec.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

`services/api/src/logger/request-trace-context.ts`:

```ts
import { AsyncLocalStorage } from 'node:async_hooks';
import { ServiceSpan, Span, SqlSpan, TraceContext } from './trace.types';
import { TRACE_LIMITS } from './trace.limits';

export class RequestTraceContext {
  private static readonly als = new AsyncLocalStorage<TraceContext>();

  static run<T>(ctx: TraceContext, fn: () => Promise<T>): Promise<T> {
    return RequestTraceContext.als.run(ctx, fn);
  }

  static current(): TraceContext | null {
    return RequestTraceContext.als.getStore() ?? null;
  }

  static pushServiceSpan(span: ServiceSpan): void {
    RequestTraceContext.pushSpan(span);
  }

  static pushSqlSpan(span: SqlSpan): void {
    RequestTraceContext.pushSpan(span);
  }

  private static pushSpan(span: Span): void {
    const ctx = RequestTraceContext.als.getStore();
    if (!ctx) return;
    if (ctx.spans.length >= TRACE_LIMITS.MAX_SPANS) {
      ctx.droppedSpans++;
      return;
    }
    ctx.spans.push(span);
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd services/api && npm test -- request-trace-context.spec.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add services/api/src/logger/request-trace-context.ts services/api/src/logger/request-trace-context.spec.ts
git commit -m "feat(api): RequestTraceContext (AsyncLocalStorage 기반 요청 컨텍스트) 추가"
```

---

## Task 4: 데코레이터 3종 (`@AutoTrace` / `@LogReplay` / `@SkipTrace`)

**Files:**

- Create: `services/api/src/logger/auto-trace.decorator.ts`
- Create: `services/api/src/logger/log-replay.decorator.ts`
- Create: `services/api/src/logger/skip-trace.decorator.ts`
- Create: `services/api/src/logger/trace.metadata.ts`
- Test: `services/api/src/logger/decorators.spec.ts`

- [ ] **Step 1: 실패 테스트 작성**

`services/api/src/logger/decorators.spec.ts`:

```ts
import 'reflect-metadata';
import { AutoTrace, AUTO_TRACE_METADATA } from './auto-trace.decorator';
import { LogReplay, LOG_REPLAY_METADATA, LogReplayOptions } from './log-replay.decorator';
import { SkipTrace, SKIP_TRACE_METADATA } from './skip-trace.decorator';

describe('AutoTrace 데코레이터', () => {
  it('클래스에 메타데이터를 부착한다', () => {
    @AutoTrace()
    class Example {}
    expect(Reflect.getMetadata(AUTO_TRACE_METADATA, Example)).toBe(true);
  });

  it('붙이지 않은 클래스에는 메타데이터가 없다', () => {
    class Bare {}
    expect(Reflect.getMetadata(AUTO_TRACE_METADATA, Bare)).toBeUndefined();
  });
});

describe('LogReplay 데코레이터', () => {
  it('메서드에 옵션 메타데이터를 부착한다', () => {
    class Example {
      @LogReplay()
      a() {}
      @LogReplay({ captureResult: true })
      b() {}
    }
    const a = Reflect.getMetadata(LOG_REPLAY_METADATA, Example.prototype, 'a') as LogReplayOptions;
    const b = Reflect.getMetadata(LOG_REPLAY_METADATA, Example.prototype, 'b') as LogReplayOptions;
    expect(a).toEqual({ captureResult: false });
    expect(b).toEqual({ captureResult: true });
  });

  it('붙이지 않은 메서드에는 메타데이터가 없다', () => {
    class Example {
      a() {}
    }
    expect(Reflect.getMetadata(LOG_REPLAY_METADATA, Example.prototype, 'a')).toBeUndefined();
  });
});

describe('SkipTrace 데코레이터', () => {
  it('메서드에 메타데이터를 부착한다', () => {
    class Example {
      @SkipTrace()
      a() {}
    }
    expect(Reflect.getMetadata(SKIP_TRACE_METADATA, Example.prototype, 'a')).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd services/api && npm test -- decorators.spec.ts`
Expected: FAIL

- [ ] **Step 3: 메타데이터 키 + 데코레이터 구현**

`services/api/src/logger/trace.metadata.ts`:

```ts
export const AUTO_TRACE_METADATA = 'terab:auto-trace';
export const LOG_REPLAY_METADATA = 'terab:log-replay';
export const SKIP_TRACE_METADATA = 'terab:skip-trace';
```

`services/api/src/logger/auto-trace.decorator.ts`:

```ts
import 'reflect-metadata';
import { AUTO_TRACE_METADATA } from './trace.metadata';

export { AUTO_TRACE_METADATA };

export function AutoTrace(): ClassDecorator {
  return (target: object) => {
    Reflect.defineMetadata(AUTO_TRACE_METADATA, true, target);
  };
}
```

`services/api/src/logger/log-replay.decorator.ts`:

```ts
import 'reflect-metadata';
import { LOG_REPLAY_METADATA } from './trace.metadata';

export { LOG_REPLAY_METADATA };

export interface LogReplayOptions {
  captureResult?: boolean;
}

export function LogReplay(options: LogReplayOptions = {}): MethodDecorator {
  const normalized: Required<LogReplayOptions> = {
    captureResult: options.captureResult ?? false,
  };
  return (target: object, propertyKey: string | symbol) => {
    Reflect.defineMetadata(LOG_REPLAY_METADATA, normalized, target, propertyKey);
  };
}
```

`services/api/src/logger/skip-trace.decorator.ts`:

```ts
import 'reflect-metadata';
import { SKIP_TRACE_METADATA } from './trace.metadata';

export { SKIP_TRACE_METADATA };

export function SkipTrace(): MethodDecorator {
  return (target: object, propertyKey: string | symbol) => {
    Reflect.defineMetadata(SKIP_TRACE_METADATA, true, target, propertyKey);
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd services/api && npm test -- decorators.spec.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add services/api/src/logger/auto-trace.decorator.ts services/api/src/logger/log-replay.decorator.ts services/api/src/logger/skip-trace.decorator.ts services/api/src/logger/trace.metadata.ts services/api/src/logger/decorators.spec.ts
git commit -m "feat(api): @AutoTrace/@LogReplay/@SkipTrace 데코레이터 추가"
```

---

## Task 5: ServiceMethodWrapper

**Files:**

- Create: `services/api/src/logger/service-method-wrapper.ts`
- Test: `services/api/src/logger/service-method-wrapper.spec.ts`

본 클래스는 NestJS `DiscoveryService`로 부팅 시 모든 provider를 순회하여, `ServiceCore` 자손이거나 `@AutoTrace()` 표기 클래스의 prototype 메서드를 wrap 함수로 교체한다.

- [ ] **Step 1: 실패 테스트 작성**

`services/api/src/logger/service-method-wrapper.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { Injectable } from '@nestjs/common';
import { ServiceCore } from '@terab/db';
import { ServiceMethodWrapper } from './service-method-wrapper';
import { PiiMasker } from './pii-masker';
import { RequestTraceContext } from './request-trace-context';
import { AutoTrace } from './auto-trace.decorator';
import { LogReplay } from './log-replay.decorator';
import { SkipTrace } from './skip-trace.decorator';

@Injectable()
class DummyService extends (ServiceCore as unknown as new (...args: unknown[]) => object) {
  constructor() {
    super({} as never, {} as never);
  }

  async normal(a: number): Promise<number> {
    return a + 1;
  }

  @LogReplay()
  async replayed(secret: string): Promise<string> {
    return `ok:${secret}`;
  }

  @SkipTrace()
  async skipped(): Promise<void> {
    return;
  }

  async willFail(): Promise<void> {
    throw new Error('boom');
  }
}

@Injectable()
@AutoTrace()
class OptedInService {
  async listSomething(): Promise<number[]> {
    return [1, 2, 3];
  }
}

@Injectable()
class UntaggedService {
  async willNotWrap(): Promise<string> {
    return 'untouched';
  }
}

describe('ServiceMethodWrapper', () => {
  let dummy: DummyService;
  let optedIn: OptedInService;
  let untagged: UntaggedService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [DiscoveryModule],
      providers: [PiiMasker, ServiceMethodWrapper, DummyService, OptedInService, UntaggedService],
    }).compile();
    await module.init();
    dummy = module.get(DummyService);
    optedIn = module.get(OptedInService);
    untagged = module.get(UntaggedService);
  });

  describe('ServiceCore 자손 메서드', () => {
    it('정상 호출 시 span을 push한다', async () => {
      await RequestTraceContext.run(
        { reqId: 'r', userId: null, route: '', spans: [], startedAt: 0, droppedSpans: 0 },
        async () => {
          const result = await dummy.normal(1);
          expect(result).toBe(2);
          const ctx = RequestTraceContext.current()!;
          expect(ctx.spans).toHaveLength(1);
          const span = ctx.spans[0];
          expect(span.kind).toBe('service');
          if (span.kind === 'service') {
            expect(span.class).toBe('DummyService');
            expect(span.method).toBe('normal');
            expect(span.replay).toBe(false);
            expect(span.args).toBeNull();
            expect(span.error).toBeNull();
          }
        },
      );
    });

    it('@LogReplay 표기 메서드는 args를 캡처하고 마스킹한다', async () => {
      await RequestTraceContext.run(
        { reqId: 'r', userId: null, route: '', spans: [], startedAt: 0, droppedSpans: 0 },
        async () => {
          await dummy.replayed('top');
          const span = RequestTraceContext.current()!.spans[0];
          if (span.kind === 'service') {
            expect(span.replay).toBe(true);
            expect(span.args).toEqual(['top']);
          }
        },
      );
    });

    it('@SkipTrace 메서드는 span을 push하지 않는다', async () => {
      await RequestTraceContext.run(
        { reqId: 'r', userId: null, route: '', spans: [], startedAt: 0, droppedSpans: 0 },
        async () => {
          await dummy.skipped();
          expect(RequestTraceContext.current()!.spans).toHaveLength(0);
        },
      );
    });

    it('예외가 발생해도 span은 push되고 예외는 전파된다', async () => {
      await RequestTraceContext.run(
        { reqId: 'r', userId: null, route: '', spans: [], startedAt: 0, droppedSpans: 0 },
        async () => {
          await expect(dummy.willFail()).rejects.toThrow('boom');
          const span = RequestTraceContext.current()!.spans[0];
          if (span.kind === 'service') {
            expect(span.method).toBe('willFail');
            expect(span.error).not.toBeNull();
          }
        },
      );
    });

    it('컨테이너 밖에서 호출하면 wrap이 동작은 하되 무시한다', async () => {
      const result = await dummy.normal(5);
      expect(result).toBe(6);
    });
  });

  describe('@AutoTrace 표기 클래스', () => {
    it('ServiceCore 미상속이어도 자동 wrap된다', async () => {
      await RequestTraceContext.run(
        { reqId: 'r', userId: null, route: '', spans: [], startedAt: 0, droppedSpans: 0 },
        async () => {
          await optedIn.listSomething();
          expect(RequestTraceContext.current()!.spans).toHaveLength(1);
        },
      );
    });
  });

  describe('태그 없는 일반 @Injectable', () => {
    it('wrap되지 않는다', async () => {
      await RequestTraceContext.run(
        { reqId: 'r', userId: null, route: '', spans: [], startedAt: 0, droppedSpans: 0 },
        async () => {
          await untagged.willNotWrap();
          expect(RequestTraceContext.current()!.spans).toHaveLength(0);
        },
      );
    });
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd services/api && npm test -- service-method-wrapper.spec.ts`
Expected: FAIL — `Cannot find module './service-method-wrapper'`

- [ ] **Step 3: 구현**

`services/api/src/logger/service-method-wrapper.ts`:

```ts
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { ServiceCore } from '@terab/db';
import { PiiMasker } from './pii-masker';
import { RequestTraceContext } from './request-trace-context';
import { ServiceSpan } from './trace.types';
import { TRACE_LIMITS } from './trace.limits';
import { AUTO_TRACE_METADATA } from './auto-trace.decorator';
import { LOG_REPLAY_METADATA, LogReplayOptions } from './log-replay.decorator';
import { SKIP_TRACE_METADATA } from './skip-trace.decorator';

const TRACE_WRAPPED_MARKER = Symbol.for('terab.traceWrapped');

interface PossiblyWrappedFn extends Function {
  [TRACE_WRAPPED_MARKER]?: true;
}

@Injectable()
export class ServiceMethodWrapper implements OnApplicationBootstrap {
  private static readonly LIFECYCLE_METHODS = new Set<string>([
    'onModuleInit',
    'onApplicationBootstrap',
    'onModuleDestroy',
    'onApplicationShutdown',
    'beforeApplicationShutdown',
  ]);

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly masker: PiiMasker,
  ) {}

  onApplicationBootstrap(): void {
    const providers = this.discovery.getProviders();
    for (const wrapper of providers) {
      const instance = wrapper.instance as object | undefined;
      if (!instance || typeof instance !== 'object') continue;
      if (!this.isEligible(instance)) continue;
      this.wrapInstance(instance);
    }
  }

  private isEligible(instance: object): boolean {
    if (instance instanceof ServiceCore) return true;
    const ctor = instance.constructor;
    if (ctor && Reflect.getMetadata(AUTO_TRACE_METADATA, ctor) === true) return true;
    return false;
  }

  private wrapInstance(instance: object): void {
    const proto = Object.getPrototypeOf(instance) as object;
    const className = instance.constructor?.name ?? 'Unknown';
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === 'constructor') continue;
      if (key.startsWith('_')) continue;
      if (ServiceMethodWrapper.LIFECYCLE_METHODS.has(key)) continue;

      const descriptor = Object.getOwnPropertyDescriptor(proto, key);
      if (!descriptor || typeof descriptor.value !== 'function') continue;
      if (Reflect.getMetadata(SKIP_TRACE_METADATA, proto, key) === true) continue;

      const original = descriptor.value as PossiblyWrappedFn;
      if (original[TRACE_WRAPPED_MARKER] === true) continue; // 멱등성 보장

      const replayOptions = Reflect.getMetadata(LOG_REPLAY_METADATA, proto, key) as
        | Required<LogReplayOptions>
        | undefined;
      const wrapped = this.buildWrappedFunction(
        original as (...args: unknown[]) => unknown,
        className,
        key,
        replayOptions,
      ) as PossiblyWrappedFn;
      wrapped[TRACE_WRAPPED_MARKER] = true;
      Object.defineProperty(proto, key, { ...descriptor, value: wrapped });
    }
  }

  private buildWrappedFunction(
    original: (...args: unknown[]) => unknown,
    className: string,
    methodName: string,
    replay: Required<LogReplayOptions> | undefined,
  ): (...args: unknown[]) => unknown {
    const masker = this.masker;
    return function wrappedTraceMethod(this: unknown, ...args: unknown[]) {
      const ctx = RequestTraceContext.current();
      if (!ctx) {
        return original.apply(this, args);
      }

      const span: ServiceSpan = {
        kind: 'service',
        class: className,
        method: methodName,
        startedAt: Date.now(),
        durationMs: null,
        replay: replay !== undefined,
        args: replay ? masker.maskValue(args, TRACE_LIMITS.MAX_ARG_SIZE_BYTES) : null,
        result: null,
        error: null,
      };
      RequestTraceContext.pushServiceSpan(span);

      const finalize = (error: unknown, result: unknown) => {
        span.durationMs = Date.now() - span.startedAt;
        if (error) {
          span.error = ServiceMethodWrapper.toSpanError(error);
        } else if (replay?.captureResult) {
          span.result = masker.maskValue(result, TRACE_LIMITS.MAX_ARG_SIZE_BYTES);
        }
      };

      try {
        const out = original.apply(this, args);
        if (out instanceof Promise) {
          return out.then(
            (value) => {
              finalize(null, value);
              return value;
            },
            (err) => {
              finalize(err, null);
              throw err;
            },
          );
        }
        finalize(null, out);
        return out;
      } catch (err) {
        finalize(err, null);
        throw err;
      }
    };
  }

  private static toSpanError(err: unknown): { code?: string; message?: string } {
    if (err && typeof err === 'object') {
      const e = err as { code?: string; message?: string };
      return { code: e.code, message: e.message };
    }
    return { message: String(err) };
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd services/api && npm test -- service-method-wrapper.spec.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add services/api/src/logger/service-method-wrapper.ts services/api/src/logger/service-method-wrapper.spec.ts
git commit -m "feat(api): ServiceMethodWrapper로 ServiceCore 자손 메서드 자동 wrap"
```

---

## Task 6: TraceFlusher

**Files:**

- Create: `services/api/src/logger/trace.flusher.ts`
- Test: `services/api/src/logger/trace.flusher.spec.ts`

- [ ] **Step 1: 실패 테스트 작성**

`services/api/src/logger/trace.flusher.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { ApiException, ErrorCode } from '@terab/common';
import { createPinoLoggerProvider, mockPinoLogger } from '@terab/test';
import { TraceFlusher } from './trace.flusher';
import { TraceContext } from './trace.types';

const codeRecord = ErrorCode as unknown as Record<
  string,
  { message: string; status: HttpStatus }
>;
const errorCode4xx = Object.entries(codeRecord).find(([, def]) => def.status < 500)?.[0] ?? 'UNKNOWN';
const errorCode5xx = Object.entries(codeRecord).find(([, def]) => def.status >= 500)?.[0];

describe('TraceFlusher', () => {
  let flusher: TraceFlusher;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TraceFlusher, createPinoLoggerProvider(TraceFlusher.name)],
    }).compile();
    flusher = module.get(TraceFlusher);
    jest.clearAllMocks();
  });

  const buildCtx = (): TraceContext => ({
    reqId: 'r1',
    userId: 'u1',
    route: 'GET /x',
    spans: [],
    startedAt: Date.now() - 50,
    droppedSpans: 0,
  });

  describe('flushOk', () => {
    it('meta 한 줄만 info로 flush한다', () => {
      flusher.flushOk(buildCtx(), 200);
      expect(mockPinoLogger.info).toHaveBeenCalledTimes(1);
      expect(mockPinoLogger.error).not.toHaveBeenCalled();
      const payload = mockPinoLogger.info.mock.calls[0][0];
      expect(payload).toMatchObject({
        event: 'trace.meta',
        outcome: 'ok',
        status: 200,
        hasDetail: false,
      });
    });
  });

  describe('flushError', () => {
    it('ApiException 4xx면 meta만 flush한다', () => {
      const err = new ApiException(errorCode4xx);
      flusher.flushError(buildCtx(), err);
      expect(mockPinoLogger.info).toHaveBeenCalledTimes(1);
      expect(mockPinoLogger.error).not.toHaveBeenCalled();
      const payload = mockPinoLogger.info.mock.calls[0][0];
      expect(payload).toMatchObject({
        event: 'trace.meta',
        outcome: 'api_exception',
        hasDetail: false,
      });
    });

    it('ApiException 5xx면 meta + detail 둘 다 flush한다', () => {
      if (!errorCode5xx) {
        return;
      }
      const err = new ApiException(errorCode5xx);
      flusher.flushError(buildCtx(), err);
      expect(mockPinoLogger.info).toHaveBeenCalledTimes(1);
      expect(mockPinoLogger.error).toHaveBeenCalledTimes(1);
      expect(mockPinoLogger.info.mock.calls[0][0]).toMatchObject({
        outcome: 'api_exception',
        hasDetail: true,
      });
      expect(mockPinoLogger.error.mock.calls[0][0]).toMatchObject({
        event: 'trace.detail',
      });
    });

    it('알 수 없는 예외면 outcome=unhandled로 meta + detail flush한다', () => {
      flusher.flushError(buildCtx(), new Error('boom'));
      expect(mockPinoLogger.info).toHaveBeenCalledTimes(1);
      expect(mockPinoLogger.error).toHaveBeenCalledTimes(1);
      expect(mockPinoLogger.info.mock.calls[0][0]).toMatchObject({
        outcome: 'unhandled',
        status: 500,
        hasDetail: true,
      });
    });

    it('detail 직렬화가 256KB를 초과하면 spans를 잘라낸다', () => {
      if (!errorCode5xx) return;
      const ctx = buildCtx();
      for (let i = 0; i < 200; i++) {
        ctx.spans.push({
          kind: 'service',
          class: 'X',
          method: 'm',
          startedAt: i,
          durationMs: 0,
          replay: true,
          args: { blob: 'y'.repeat(2000) },
          result: null,
          error: null,
        });
      }
      flusher.flushError(ctx, new ApiException(errorCode5xx));
      const detail = mockPinoLogger.error.mock.calls[0][0] as {
        spans: unknown[];
        truncated?: boolean;
      };
      expect(detail.truncated).toBe(true);
      expect(detail.spans.length).toBeLessThan(200);
    });
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd services/api && npm test -- trace.flusher.spec.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

`services/api/src/logger/trace.flusher.ts`:

```ts
import { HttpStatus, Injectable } from '@nestjs/common';
import { ApiException } from '@terab/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Span, TraceContext, TraceDetailRecord, TraceMetaRecord, TraceOutcome } from './trace.types';
import { TRACE_LIMITS } from './trace.limits';

interface ErrorInfo {
  status: number;
  outcome: TraceOutcome;
  errorRecord: TraceDetailRecord['error'];
  needsDetail: boolean;
}

@Injectable()
export class TraceFlusher {
  constructor(@InjectPinoLogger(TraceFlusher.name) private readonly logger: PinoLogger) {}

  flushOk(ctx: TraceContext, status: number): void {
    const meta = this.buildMeta(ctx, status, 'ok', false);
    this.logger.info(meta);
  }

  flushError(ctx: TraceContext, err: unknown): void {
    const info = this.classifyError(err);
    const meta = this.buildMeta(ctx, info.status, info.outcome, info.needsDetail);
    this.logger.info(meta);
    if (info.needsDetail) {
      const detail = this.buildDetail(ctx, info.errorRecord);
      this.logger.error(detail);
    }
  }

  private classifyError(err: unknown): ErrorInfo {
    if (err instanceof ApiException) {
      const status = err.getStatus();
      const needsDetail = status >= HttpStatus.INTERNAL_SERVER_ERROR;
      return {
        status,
        outcome: 'api_exception',
        errorRecord: {
          kind: 'ApiException',
          code: err.code,
          message: err.message,
          stack: err.stack,
        },
        needsDetail,
      };
    }
    const e = err as { message?: string; stack?: string };
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      outcome: 'unhandled',
      errorRecord: {
        kind: err && typeof err === 'object' ? err.constructor.name : typeof err,
        message: e?.message,
        stack: e?.stack,
      },
      needsDetail: true,
    };
  }

  private buildMeta(
    ctx: TraceContext,
    status: number,
    outcome: TraceOutcome,
    hasDetail: boolean,
  ): TraceMetaRecord {
    const counts = ctx.spans.reduce(
      (acc, span) => {
        if (span.kind === 'service') acc.service++;
        else acc.sql++;
        return acc;
      },
      { service: 0, sql: 0 },
    );
    const meta: TraceMetaRecord = {
      event: 'trace.meta',
      reqId: ctx.reqId,
      service: 'api',
      userId: ctx.userId,
      route: ctx.route,
      status,
      durationMs: Date.now() - ctx.startedAt,
      outcome,
      spanCounts: counts,
      hasDetail,
    };
    if (ctx.droppedSpans > 0) meta.droppedSpans = ctx.droppedSpans;
    return meta;
  }

  private buildDetail(ctx: TraceContext, error: TraceDetailRecord['error']): TraceDetailRecord {
    const detail: TraceDetailRecord = {
      event: 'trace.detail',
      reqId: ctx.reqId,
      service: 'api',
      error,
      spans: ctx.spans,
    };
    const limit = TRACE_LIMITS.MAX_DETAIL_SIZE_BYTES;
    let serialized = TraceFlusher.safeSize(detail);
    if (serialized <= limit) return detail;

    const trimmed: Span[] = ctx.spans.slice();
    while (trimmed.length > 0 && serialized > limit) {
      trimmed.shift();
      detail.spans = trimmed;
      detail.truncated = true;
      serialized = TraceFlusher.safeSize(detail);
    }
    return detail;
  }

  private static safeSize(record: object): number {
    try {
      return Buffer.byteLength(JSON.stringify(record), 'utf8');
    } catch {
      return 0;
    }
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd services/api && npm test -- trace.flusher.spec.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add services/api/src/logger/trace.flusher.ts services/api/src/logger/trace.flusher.spec.ts
git commit -m "feat(api): TraceFlusher로 meta/detail 로그 분리 및 256KB 한계 적용"
```

---

## Task 7: TraceInterceptor

**Files:**

- Create: `services/api/src/logger/trace.interceptor.ts`
- Test: `services/api/src/logger/trace.interceptor.spec.ts`

- [ ] **Step 1: 실패 테스트 작성**

`services/api/src/logger/trace.interceptor.spec.ts`:

```ts
import { CallHandler, ExecutionContext, HttpStatus } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { ApiException, ErrorCode } from '@terab/common';
import { TraceInterceptor } from './trace.interceptor';
import { TraceFlusher } from './trace.flusher';
import { RequestTraceContext } from './request-trace-context';

const codeRecord = ErrorCode as unknown as Record<
  string,
  { message: string; status: HttpStatus }
>;
const errorCode4xx = Object.entries(codeRecord).find(([, d]) => d.status < 500)?.[0] ?? 'UNKNOWN';

const flushOk = jest.fn();
const flushError = jest.fn();

const flusher = { flushOk, flushError } as unknown as TraceFlusher;

const buildExecutionContext = (
  options: { method?: string; path?: string; reqId?: string; userId?: string | null; statusCode?: number } = {},
): ExecutionContext => {
  const request = {
    id: options.reqId ?? 'rq-1',
    method: options.method ?? 'GET',
    url: options.path ?? '/api/x',
    route: { path: options.path ?? '/api/x' },
    user: options.userId === null ? undefined : { id: options.userId ?? 'u-1' },
  };
  const response = { statusCode: options.statusCode ?? 200 };
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
};

describe('TraceInterceptor', () => {
  let interceptor: TraceInterceptor;

  beforeEach(() => {
    interceptor = new TraceInterceptor(flusher);
    jest.clearAllMocks();
  });

  it('정상 경로에서 flushOk를 호출하고 결과를 전파한다', async () => {
    const handler: CallHandler = { handle: () => of('ok') };
    const out = await firstValueFrom(interceptor.intercept(buildExecutionContext(), handler));
    expect(out).toBe('ok');
    expect(flushOk).toHaveBeenCalledTimes(1);
    expect(flushError).not.toHaveBeenCalled();
  });

  it('오류 경로에서 flushError를 호출하고 예외를 전파한다', async () => {
    const err = new ApiException(errorCode4xx);
    const handler: CallHandler = { handle: () => throwError(() => err) };
    await expect(
      firstValueFrom(interceptor.intercept(buildExecutionContext(), handler)),
    ).rejects.toBe(err);
    expect(flushError).toHaveBeenCalledTimes(1);
    expect(flushOk).not.toHaveBeenCalled();
  });

  it('handler 안에서 RequestTraceContext.current()가 컨테이너를 반환한다', async () => {
    let observedReqId: string | null = null;
    const handler: CallHandler = {
      handle: () => {
        observedReqId = RequestTraceContext.current()?.reqId ?? null;
        return of(null);
      },
    };
    await firstValueFrom(interceptor.intercept(buildExecutionContext({ reqId: 'abc' }), handler));
    expect(observedReqId).toBe('abc');
  });

  it('user가 없으면 userId는 null이다', async () => {
    let observedUserId: string | null | undefined;
    const handler: CallHandler = {
      handle: () => {
        observedUserId = RequestTraceContext.current()?.userId;
        return of(null);
      },
    };
    await firstValueFrom(interceptor.intercept(buildExecutionContext({ userId: null }), handler));
    expect(observedUserId).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd services/api && npm test -- trace.interceptor.spec.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

`services/api/src/logger/trace.interceptor.ts`:

```ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request, Response } from 'express';
import { RequestTraceContext } from './request-trace-context';
import { TraceFlusher } from './trace.flusher';
import { TraceContext } from './trace.types';

interface AuthenticatedRequest extends Request {
  id?: string;
  user?: { id?: string };
}

@Injectable()
export class TraceInterceptor implements NestInterceptor {
  constructor(private readonly flusher: TraceFlusher) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<Response>();

    const traceContext: TraceContext = {
      reqId: typeof request.id === 'string' ? request.id : 'unknown',
      userId: request.user?.id ?? null,
      route: this.formatRoute(request),
      spans: [],
      startedAt: Date.now(),
      droppedSpans: 0,
    };

    return new Observable<unknown>((subscriber) => {
      const flusher = this.flusher;
      void RequestTraceContext.run(traceContext, () => {
        return new Promise<void>((resolve) => {
          next.handle().subscribe({
            next: (value) => subscriber.next(value),
            error: (err) => {
              flusher.flushError(traceContext, err);
              subscriber.error(err);
              resolve();
            },
            complete: () => {
              flusher.flushOk(traceContext, response.statusCode);
              subscriber.complete();
              resolve();
            },
          });
        });
      });
    });
  }

  private formatRoute(request: AuthenticatedRequest): string {
    const method = request.method ?? 'UNKNOWN';
    const path = (request.route as { path?: string } | undefined)?.path ?? request.url ?? '';
    return `${method} ${path}`;
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd services/api && npm test -- trace.interceptor.spec.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add services/api/src/logger/trace.interceptor.ts services/api/src/logger/trace.interceptor.spec.ts
git commit -m "feat(api): TraceInterceptor로 요청 컨텍스트 생성 및 flush 트리거"
```

---

## Task 8: DrizzleQueryLogger

**Files:**

- Create: `services/api/src/logger/drizzle-query-logger.ts`
- Test: `services/api/src/logger/drizzle-query-logger.spec.ts`

- [ ] **Step 1: 실패 테스트 작성**

`services/api/src/logger/drizzle-query-logger.spec.ts`:

```ts
import { DrizzleQueryLogger } from './drizzle-query-logger';
import { PiiMasker } from './pii-masker';
import { RequestTraceContext } from './request-trace-context';
import { TRACE_LIMITS } from './trace.limits';

describe('DrizzleQueryLogger', () => {
  let logger: DrizzleQueryLogger;

  beforeEach(() => {
    logger = new DrizzleQueryLogger(new PiiMasker());
  });

  it('컨테이너 밖에서 호출하면 예외 없이 무시한다', () => {
    expect(() => logger.logQuery('select 1', [])).not.toThrow();
  });

  it('컨테이너 안에서 호출하면 sql span을 push한다', async () => {
    await RequestTraceContext.run(
      { reqId: 'r', userId: null, route: '', spans: [], startedAt: 0, droppedSpans: 0 },
      async () => {
        logger.logQuery('select $1', ['v']);
        const ctx = RequestTraceContext.current()!;
        expect(ctx.spans).toHaveLength(1);
        const span = ctx.spans[0];
        expect(span.kind).toBe('sql');
        if (span.kind === 'sql') {
          expect(span.sql).toBe('select $1');
          expect(span.params).toEqual(['v']);
          expect(span.durationMs).toBeNull();
          expect(span.rowCount).toBeNull();
        }
      },
    );
  });

  it('params 항목 크기가 1KB를 넘으면 <truncated...>로 치환한다', async () => {
    await RequestTraceContext.run(
      { reqId: 'r', userId: null, route: '', spans: [], startedAt: 0, droppedSpans: 0 },
      async () => {
        logger.logQuery('select $1', ['x'.repeat(TRACE_LIMITS.MAX_SQL_PARAM_SIZE_BYTES + 100)]);
        const span = RequestTraceContext.current()!.spans[0];
        if (span.kind === 'sql') {
          expect(span.params[0] as string).toMatch(/^<truncated:size=\d+>$/);
        }
      },
    );
  });

  it('MAX_SPANS 초과 시 push하지 않고 droppedSpans만 증가시킨다', async () => {
    await RequestTraceContext.run(
      { reqId: 'r', userId: null, route: '', spans: [], startedAt: 0, droppedSpans: 0 },
      async () => {
        for (let i = 0; i < TRACE_LIMITS.MAX_SPANS + 3; i++) {
          logger.logQuery('select 1', []);
        }
        const ctx = RequestTraceContext.current()!;
        expect(ctx.spans).toHaveLength(TRACE_LIMITS.MAX_SPANS);
        expect(ctx.droppedSpans).toBe(3);
      },
    );
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd services/api && npm test -- drizzle-query-logger.spec.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

`services/api/src/logger/drizzle-query-logger.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PiiMasker } from './pii-masker';
import { RequestTraceContext } from './request-trace-context';
import { TRACE_LIMITS } from './trace.limits';

@Injectable()
export class DrizzleQueryLogger {
  constructor(private readonly masker: PiiMasker) {}

  logQuery(query: string, params: unknown[]): void {
    const ctx = RequestTraceContext.current();
    if (!ctx) return;
    const maskedParams = params.map((p) =>
      this.masker.maskValue(p, TRACE_LIMITS.MAX_SQL_PARAM_SIZE_BYTES),
    );
    RequestTraceContext.pushSqlSpan({
      kind: 'sql',
      sql: query,
      params: maskedParams,
      startedAt: Date.now(),
      durationMs: null,
      rowCount: null,
    });
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd services/api && npm test -- drizzle-query-logger.spec.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add services/api/src/logger/drizzle-query-logger.ts services/api/src/logger/drizzle-query-logger.spec.ts
git commit -m "feat(api): DrizzleQueryLogger로 SQL span을 요청 컨텍스트에 push"
```

---

## Task 9: LoggerModule 와이어링 + pino redact

**Files:**

- Modify: `services/api/src/logger/logger.config.ts`
- Modify: `services/api/src/logger/logger.module.ts`

- [ ] **Step 1: `logger.config.ts`에 redact 옵션만 추가**

기존 `buildLoggerParams` 함수의 `pinoHttp` 옵션에 `redact`만 새로 추가한다. **transport 설정(파일명·롤링 정책)은 손대지 않는다** — 기존 운영 설정을 보존한다.

`services/api/src/logger/logger.config.ts` 전체를 다음으로 교체:

```ts
import type { Params } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';

export function buildLoggerParams(env: string, logMaxFiles: number): Params {
  const isDev = env === 'dev';

  return {
    pinoHttp: {
      level: isDev ? 'debug' : 'warn',
      autoLogging: false,
      genReqId: (req: IncomingMessage) => {
        const existing = req.headers['x-request-id'];
        if (typeof existing === 'string' && existing) return existing;
        return randomUUID();
      },
      redact: {
        paths: [
          '*.password',
          '*.token',
          '*.refreshToken',
          '*.accessToken',
          '*.secret',
          '*.apiKey',
          '*.authorization',
          'spans[*].args.password',
          'spans[*].args.token',
          'spans[*].args.accessToken',
          'spans[*].args.refreshToken',
        ],
        censor: '***',
      },
      transport: isDev
        ? {
            target: 'pino-pretty',
            options: { colorize: true, singleLine: false },
          }
        : {
            target: 'pino-roll',
            options: {
              files: '/app/logs/app.log',
              frequency: 'daily',
              mkdir: true,
              limit: { count: logMaxFiles },
            },
          },
    },
  };
}
```

> 파일 내용 자체는 pino 기본 JSON 출력이므로 `.log` 확장자여도 NDJSON으로 사용된다. 파일명 변경은 분석 서비스 구축 단계에서 별도로 결정.

- [ ] **Step 2: 기존 `logger.config.spec.ts`가 깨지는지 확인**

Run: `cd services/api && npm test -- logger.config.spec.ts`
Expected: 기존 테스트가 redact/transport 파일명 변경을 확인하지 않으면 그대로 PASS

- [ ] **Step 3: `LoggerModule`에 신규 provider 등록**

`services/api/src/logger/logger.module.ts` 전체를 다음으로 교체:

```ts
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { buildLoggerParams } from './logger.config';
import { PiiMasker } from './pii-masker';
import { ServiceMethodWrapper } from './service-method-wrapper';
import { TraceFlusher } from './trace.flusher';
import { TraceInterceptor } from './trace.interceptor';
import { DrizzleQueryLogger } from './drizzle-query-logger';

@Global()
@Module({
  imports: [
    DiscoveryModule,
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const env = config.get<string>('NODE_ENV') ?? 'prod';
        const logMaxFiles = config.get<number>('LOG_MAX_FILES') ?? 30;
        return buildLoggerParams(env, logMaxFiles);
      },
    }),
  ],
  providers: [PiiMasker, ServiceMethodWrapper, TraceFlusher, TraceInterceptor, DrizzleQueryLogger],
  exports: [PinoLoggerModule, DrizzleQueryLogger, TraceInterceptor],
})
export class LoggerModule {}
```

- [ ] **Step 4: 전체 빌드 검증**

Run: `cd services/api && npm run build`
Expected: 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add services/api/src/logger/logger.config.ts services/api/src/logger/logger.module.ts
git commit -m "feat(api): LoggerModule에 trace provider 등록 + pino redact 설정 + jsonl 출력"
```

---

## Task 10: DatabaseService에 DrizzleQueryLogger 연결

**Files:**

- Modify: `services/api/src/database/database.service.ts`

- [ ] **Step 1: DrizzleQueryLogger 주입**

기존 파일을 다음으로 교체:

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'path';
import { Pool } from 'pg';
import { DrizzleQueryLogger } from '../logger/drizzle-query-logger';
import * as schema from './schema';
import { seedRbac } from './seed';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  readonly db: NodePgDatabase<typeof schema>;
  private readonly pool: Pool;

  constructor(
    private readonly configService: ConfigService,
    private readonly queryLogger: DrizzleQueryLogger,
  ) {
    this.pool = new Pool({
      connectionString: this.configService.getOrThrow<string>('DATABASE_URL'),
      max: 5,
      idleTimeoutMillis: 60000,
    });
    this.db = drizzle(this.pool, {
      schema,
      casing: 'snake_case',
      logger: this.queryLogger,
    });
  }

  async onModuleInit(): Promise<void> {
    const migrationsFolder = join(__dirname, '../..', 'drizzle');
    const maxRetries = 10;
    const retryDelayMs = 3000;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await migrate(this.db, { migrationsFolder });
        await this.seed();
        return;
      } catch (error) {
        if (attempt === maxRetries) throw error;
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  private async seed(): Promise<void> {
    await seedRbac(this.db);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
```

- [ ] **Step 2: 기존 DatabaseService 단위 테스트 확인**

Run: `cd services/api && npm test -- database.service.spec.ts`
Expected: 신규 의존성으로 인해 mock 추가 필요할 수 있음

기존 테스트에서 `Test.createTestingModule({ providers: [DatabaseService, { provide: ConfigService, useValue: ... }] })` 형태였다면, `DrizzleQueryLogger`를 mock으로 추가:

```ts
{ provide: DrizzleQueryLogger, useValue: { logQuery: jest.fn() } }
```

테스트가 통과할 때까지 mock을 추가한다.

- [ ] **Step 3: 빌드 검증**

Run: `cd services/api && npm run build`
Expected: 성공

- [ ] **Step 4: 커밋**

```bash
git add services/api/src/database/database.service.ts services/api/src/database/database.service.spec.ts
git commit -m "feat(api): DatabaseService에 DrizzleQueryLogger 연결"
```

---

## Task 11: AppModule에 TraceInterceptor 전역 등록

**Files:**

- Modify: `services/api/src/app.module.ts`

- [ ] **Step 1: APP_INTERCEPTOR 등록 추가**

기존 `app.module.ts`의 `providers` 배열에 다음 항목을 추가한다 (`APP_GUARD` 블록 다음, `APP_FILTER` 앞):

```ts
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { TraceInterceptor } from './logger/trace.interceptor';
```

`providers` 배열에 추가:

```ts
{ provide: APP_INTERCEPTOR, useExisting: TraceInterceptor },
```

전체 providers 배열은 다음과 같이 된다:

```ts
providers: [
  { provide: APP_GUARD, useClass: ThrottlerGuard },
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_GUARD, useClass: PermissionGuard },
  { provide: APP_INTERCEPTOR, useExisting: TraceInterceptor },
  { provide: APP_FILTER, useClass: ApiExceptionFilter },
  {
    provide: APP_PIPE,
    useValue: new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  },
],
```

- [ ] **Step 2: 빌드 검증**

Run: `cd services/api && npm run build`
Expected: 성공

- [ ] **Step 3: 커밋**

```bash
git add services/api/src/app.module.ts
git commit -m "feat(api): AppModule에 TraceInterceptor 전역 등록"
```

---

## Task 12: e2e 통합 테스트 — 정상/오류 경로

**Files:**

- Create: `services/api/test/trace.e2e-spec.ts`

본 테스트는 실제 NestJS 인스턴스를 띄워 HTTP 요청을 보내고, mock된 pino logger의 호출을 확인한다.

- [ ] **Step 1: e2e 테스트 작성**

`services/api/test/trace.e2e-spec.ts`:

```ts
import { Controller, Get, HttpStatus, INestApplication, Injectable, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ApiException, ApiExceptionFilter, ErrorCode } from '@terab/common';
import { mockPinoLogger, createPinoLoggerProvider } from '@terab/test';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { PiiMasker } from '../src/logger/pii-masker';
import { ServiceMethodWrapper } from '../src/logger/service-method-wrapper';
import { TraceFlusher } from '../src/logger/trace.flusher';
import { TraceInterceptor } from '../src/logger/trace.interceptor';
import { AutoTrace } from '../src/logger/auto-trace.decorator';
import { LogReplay } from '../src/logger/log-replay.decorator';

const codeRecord = ErrorCode as unknown as Record<string, { message: string; status: HttpStatus }>;
const errorCode4xx = Object.entries(codeRecord).find(([, d]) => d.status < 500)?.[0] ?? 'UNKNOWN';
const errorCode5xx = Object.entries(codeRecord).find(([, d]) => d.status >= 500)?.[0];

@Injectable()
@AutoTrace()
class DummyService {
  async ok(): Promise<string> {
    return 'hello';
  }

  @LogReplay()
  async failWith4xx(_input: string): Promise<void> {
    throw new ApiException(errorCode4xx);
  }

  @LogReplay()
  async failWith5xx(_input: string): Promise<void> {
    if (!errorCode5xx) throw new Error('no 5xx code in ErrorCode');
    throw new ApiException(errorCode5xx);
  }

  async failWithUnhandled(): Promise<void> {
    throw new Error('boom');
  }
}

@Controller('trace-test')
class DummyController {
  constructor(private readonly svc: DummyService) {}

  @Get('ok')
  async ok() {
    return this.svc.ok();
  }

  @Get('fail4')
  async fail4() {
    return this.svc.failWith4xx('topsecret');
  }

  @Get('fail5')
  async fail5() {
    return this.svc.failWith5xx('topsecret');
  }

  @Get('boom')
  async boom() {
    return this.svc.failWithUnhandled();
  }
}

@Module({
  imports: [DiscoveryModule, PinoLoggerModule.forRoot({ pinoHttp: { enabled: false } })],
  controllers: [DummyController],
  providers: [
    PiiMasker,
    ServiceMethodWrapper,
    TraceFlusher,
    TraceInterceptor,
    DummyService,
    createPinoLoggerProvider(TraceFlusher.name),
    createPinoLoggerProvider(ApiExceptionFilter.name),
    { provide: APP_INTERCEPTOR, useExisting: TraceInterceptor },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
class TestModule {}

describe('Service Trace Logging (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({ imports: [TestModule] }).compile();
    app = module.createNestApplication();
    await app.init();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  it('정상 요청은 trace.meta(info)만 한 줄 남긴다', async () => {
    await request(app.getHttpServer()).get('/trace-test/ok').expect(200);
    expect(mockPinoLogger.info).toHaveBeenCalledTimes(1);
    expect(mockPinoLogger.error).not.toHaveBeenCalled();
    expect(mockPinoLogger.info.mock.calls[0][0]).toMatchObject({
      event: 'trace.meta',
      outcome: 'ok',
      hasDetail: false,
    });
  });

  it('4xx ApiException은 trace.meta만 남기고 detail은 남기지 않는다', async () => {
    await request(app.getHttpServer()).get('/trace-test/fail4');
    expect(mockPinoLogger.info).toHaveBeenCalledTimes(1);
    expect(mockPinoLogger.error).not.toHaveBeenCalled();
    expect(mockPinoLogger.info.mock.calls[0][0]).toMatchObject({
      event: 'trace.meta',
      outcome: 'api_exception',
      hasDetail: false,
    });
  });

  it('5xx ApiException은 trace.meta + trace.detail 둘 다 남긴다', async () => {
    if (!errorCode5xx) return;
    await request(app.getHttpServer()).get('/trace-test/fail5');
    expect(mockPinoLogger.info).toHaveBeenCalledTimes(1);
    expect(mockPinoLogger.error).toHaveBeenCalledTimes(1);
    expect(mockPinoLogger.error.mock.calls[0][0]).toMatchObject({ event: 'trace.detail' });
  });

  it('catch되지 않은 일반 예외는 outcome=unhandled로 meta+detail 남긴다', async () => {
    await request(app.getHttpServer()).get('/trace-test/boom');
    expect(mockPinoLogger.info).toHaveBeenCalledTimes(1);
    expect(mockPinoLogger.error).toHaveBeenCalledTimes(1);
    expect(mockPinoLogger.info.mock.calls[0][0]).toMatchObject({
      outcome: 'unhandled',
      hasDetail: true,
    });
  });
});
```

- [ ] **Step 2: 테스트 실행**

Run: `cd services/api && npm run test:e2e -- trace.e2e-spec.ts`
Expected: 4개 케이스 PASS

- [ ] **Step 3: 커밋**

```bash
git add services/api/test/trace.e2e-spec.ts
git commit -m "test(api): service trace logging e2e — 정상/4xx/5xx/unhandled 경로 검증"
```

---

## Task 13: 룰 파일 및 CLAUDE.md 갱신

**Files:**

- Modify: `services/api/.claude/rules/logging.md`
- Modify: `services/api/CLAUDE.md`

- [ ] **Step 1: `logging.md`에 자동 trace 안내 추가**

[services/api/.claude/rules/logging.md](../../services/api/.claude/rules/logging.md) 파일 최하단에 다음 섹션을 추가:

```markdown

## 자동 Trace (service 메서드)

`ServiceCore`를 extends한 service의 public 메서드는 부팅 시 자동 wrap되어, 호출/완료/예외가 `RequestTraceContext`에 span으로 누적된다. 별도 로그 호출이 필요 없다.

- `this.logger.debug('메서드 진입/완료')` 같은 수동 로그는 작성하지 않는다. 자동 trace가 대체한다.
- 비즈니스 이벤트(파일 업로드 완료, 회원 가입 완료 등)는 여전히 `this.logger.info`로 명시적으로 남긴다.
- 입력 페이로드까지 운영 재현 자료로 남기려면 메서드에 `@LogReplay()` 부착.
- 특정 메서드를 자동 wrap에서 빼려면 `@SkipTrace()`.
- `ServiceCore`를 extends하지 않는 service는 클래스에 `@AutoTrace()` 부착.
- 민감 키 추가는 `PiiMasker.MASK_KEYS`에서만 관리한다.
```

- [ ] **Step 2: `services/api/CLAUDE.md`의 "로거 사용" 절 갱신**

기존 "로거 사용" 절을 다음으로 교체:

```markdown
### 로거 사용

- `ServiceCore` 자손 service의 public 메서드는 자동 trace된다. 별도 로그 호출 불필요
- 비즈니스 이벤트는 `@InjectPinoLogger(ClassName.name)` 주입 후 `this.logger.info`로 명시 기록
- `LoggerModule`은 `@Global()` 선언이므로 도메인 모듈에서 별도 import 없이 주입 가능
- 호출 형식·레벨 기준, 자동 trace 정책은 `.claude/rules/logging.md` 참조
```

- [ ] **Step 3: 커밋**

```bash
git add services/api/.claude/rules/logging.md services/api/CLAUDE.md
git commit -m "docs(api): 자동 trace 시스템 도입에 따른 logging 룰 및 CLAUDE.md 갱신"
```

---

## 최종 검증

- [ ] **전체 테스트 실행**

Run: `cd services/api && npm test`
Expected: 모든 단위 테스트 통과 (기존 + 신규)

- [ ] **e2e 테스트 실행**

Run: `cd services/api && npm run test:e2e`
Expected: 신규 trace e2e + 기존 e2e 모두 통과

- [ ] **빌드 검증**

Run: `cd services/api && npm run build`
Expected: 성공

- [ ] **dev 서버 기동 후 한 번 호출 — 로그 확인**

```bash
cd services/api && npm run start:dev
# 다른 터미널
curl -s http://localhost:3000/api/health -H 'x-request-id: test-trace-1'
```

Expected: 콘솔에 `event: 'trace.meta'`, `reqId: 'test-trace-1'`이 포함된 pino-pretty 출력.

---

## 후속 작업 (본 plan 범위 외 — 별도 plan으로)

- SQL span의 `durationMs`/`rowCount`를 채우는 drizzle client wrapper
- BullMQ 워커들에 `RequestTraceContext.run()` 적용 (특히 `upload-session.cleanup.worker.ts`)
- 분석 서비스 구축 (별도 프로젝트)
- mq 서비스가 같은 JSON Lines 포맷 채택
