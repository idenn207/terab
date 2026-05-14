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

    if (seen.has(value)) return this.CIRCULAR;
    seen.add(value);

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
      if (PiiMasker.MASK_KEYS.has(key.toLocaleLowerCase())) {
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
    if (value === undefined) return null;
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }
}
