import 'reflect-metadata';
import { AUTO_TRACE_METADATA, AutoTrace } from './auto-trace.decorator';
import { LOG_REPLAY_METADATA, LogReplay, LogReplayOptions } from './log-replay.decorator';
import { SKIP_TRACE_METADATA, SkipTrace } from './skip-trace.decorator';

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
