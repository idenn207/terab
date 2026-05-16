import { Injectable } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ServiceCore } from '@terab/db';
import { AutoTrace } from './decorators/auto-trace.decorator';
import { LogReplay } from './decorators/log-replay.decorator';
import { SkipTrace } from './decorators/skip-trace.decorator';
import { PiiMasker } from './pii-masker';
import { RequestTraceContext } from './request-trace-context';
import { ServiceMethodWrapper } from './service-method-wrapper';

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
