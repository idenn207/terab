import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { ServiceCore } from '@terab/db';
import { LogReplayOptions } from './decorators/log-replay.decorator';
import { PiiMasker } from './pii-masker';
import { RequestTraceContext } from './request-trace-context';
import { TRACE_LIMITS } from './trace.limits';
import { AUTO_TRACE_METADATA, LOG_REPLAY_METADATA, SKIP_TRACE_METADATA } from './trace.metadata';
import { ServiceSpan } from './trace.type';

const TRACE_WRAPPED_MARKER = Symbol.for('terab.traceWrapped');

// eslint-disable-next-line
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
              return value as unknown;
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
