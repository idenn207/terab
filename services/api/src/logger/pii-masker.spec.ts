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
