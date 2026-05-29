import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { http, HttpResponse } from 'msw';
import { AxiosError } from 'axios';
import { server } from '@tests/mocks';
import { axiosInstance } from './axiosInstance';
import { useUserStore } from '@/entities';

// 모듈 레벨 isRefreshing / failedQueue 는 정상 / 실패 경로 모두 finally·processQueue 가 자동 비운다.
// 따라서 케이스 간 격리는 zustand store reset + location.href stub 만으로 충분하다.

// jsdom 의 location.href 는 non-configurable 라 set spy 가 어렵다.
// 그러므로 window.location 자체를 configurable property 로 교체해 setter 만 가로챈다.
// origin / protocol 등은 MSW interceptor 의 toAbsoluteUrl 이 읽으므로 반드시 유지.
let capturedHref = '';
const originalLocation = window.location;
const stubLocation: Location = {
  ...originalLocation,
  get href() {
    return capturedHref || originalLocation.href;
  },
  set href(value: string) {
    capturedHref = value;
  },
  assign: () => {},
  replace: () => {},
  reload: () => {},
} as Location;

describe('axiosInstance', () => {
  beforeEach(() => {
    useUserStore.setState({ accessToken: 'initial-token', user: null });
    capturedHref = '';
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: stubLocation,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  test('단일 401 → refresh 200 → 원 요청 재시도 성공', async () => {
    let protectedCalls = 0;
    let refreshCalls = 0;
    server.use(
      http.get('/api/test-protected', () => {
        protectedCalls += 1;
        if (protectedCalls === 1) {
          return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json({ ok: true });
      }),
      http.post('/api/auth/refresh', () => {
        refreshCalls += 1;
        return HttpResponse.json({ accessToken: 'new-token' });
      }),
    );

    const res = await axiosInstance.get('/test-protected');

    expect(res.data).toEqual({ ok: true });
    expect(protectedCalls).toBe(2);
    expect(refreshCalls).toBe(1);
    expect(useUserStore.getState().accessToken).toBe('new-token');
  });

  test('동시 2개 401 → 단일 refresh → 양쪽 큐가 새 토큰으로 재시도', async () => {
    let protectedCalls = 0;
    let refreshCalls = 0;
    server.use(
      http.get('/api/test-protected', () => {
        protectedCalls += 1;
        if (protectedCalls <= 2) {
          return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json({ attempt: protectedCalls });
      }),
      http.post('/api/auth/refresh', async () => {
        refreshCalls += 1;
        // 두 401 요청이 모두 큐에 쌓일 시간을 주기 위해 짧은 delay
        await new Promise((resolve) => setTimeout(resolve, 10));
        return HttpResponse.json({ accessToken: 'shared-token' });
      }),
    );

    const [a, b] = await Promise.all([
      axiosInstance.get('/test-protected'),
      axiosInstance.get('/test-protected'),
    ]);

    // 핵심 invariant: 동시 401 → refresh 는 정확히 1회
    expect(refreshCalls).toBe(1);
    // 두 요청 모두 protected 재시도까지 성공 (총 4번 호출: 401×2 + 재시도×2)
    expect(protectedCalls).toBe(4);
    expect(a.data).toEqual({ attempt: 3 });
    expect(b.data).toEqual({ attempt: 4 });
    expect(useUserStore.getState().accessToken).toBe('shared-token');
  });

  test('refresh 응답이 401 → 큐 reject + clearAuth + /login redirect', async () => {
    server.use(
      http.get('/api/test-protected', () => new HttpResponse(null, { status: 401 })),
      http.post('/api/auth/refresh', () => new HttpResponse(null, { status: 401 })),
    );

    await expect(axiosInstance.get('/test-protected')).rejects.toThrow();

    // clearAuth 효과 — accessToken 이 null 로 reset 되었는지로 간접 검증
    expect(useUserStore.getState().accessToken).toBeNull();
    expect(capturedHref).toBe('/login');
  });

  test('H3 — error.config 가 undefined 인 AxiosError 는 즉시 throw, refresh 호출 0', async () => {
    let refreshCalled = false;
    server.use(
      http.post('/api/auth/refresh', () => {
        refreshCalled = true;
        return HttpResponse.json({ accessToken: 'should-not-be-used' });
      }),
    );

    // adapter 를 임시 교체 — config 가 undefined 인 AxiosError 를 강제로 throw
    const originalAdapter = axiosInstance.defaults.adapter;
    axiosInstance.defaults.adapter = (async () => {
      const err = new AxiosError('forced network error', 'ERR_NETWORK');
      // err.config 는 default undefined — H3 가드 검증을 위해 의도적으로 비워둠
      throw err;
    }) as never;

    try {
      await expect(axiosInstance.get('/test-protected')).rejects.toMatchObject({
        code: 'ERR_NETWORK',
      });
      expect(refreshCalled).toBe(false);
    } finally {
      axiosInstance.defaults.adapter = originalAdapter;
    }
  });

  test('H2 — refresh 200 인데 accessToken 누락 → 큐에 쌓인 동시 요청은 fallback 에러로 reject', async () => {
    server.use(
      http.get('/api/test-protected', ({ request }) => {
        // 재시도된 요청(헤더에 새 토큰 — 여기서는 "Bearer undefined") 은 단순히 200 으로 통과시켜도
        // 본 케이스의 invariant 는 "큐에 들어간 두 번째 요청이 H2 fallback 에러로 reject 되는가"
        const auth = request.headers.get('authorization');
        if (auth?.startsWith('Bearer initial-token')) {
          return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json({ ok: true });
      }),
      http.post('/api/auth/refresh', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return HttpResponse.json({}); // accessToken 누락
      }),
    );

    const results = await Promise.allSettled([
      axiosInstance.get('/test-protected'),
      axiosInstance.get('/test-protected'),
    ]);

    // 적어도 하나는 H2 fallback 에러로 reject 되어야 함
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(rejected.length).toBeGreaterThanOrEqual(1);
    const messages = rejected.map((r) =>
      r.status === 'rejected' ? String((r.reason as Error)?.message ?? r.reason) : '',
    );
    expect(messages.some((m) => m.includes('No token available in refresh response'))).toBe(true);
  });
});
