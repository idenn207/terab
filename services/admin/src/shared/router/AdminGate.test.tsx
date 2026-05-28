import { useUserStore } from '@/entities';
import { render, screen, waitFor } from '@testing-library/react';
import { server } from '@tests/mocks';
import { makeRouterWrapper } from '@tests/wrappers';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminGate } from './AdminGate';

vi.mock('@/shared/lib', async () => {
  const actual = await vi.importActual<typeof import('@/shared/lib')>('@/shared/lib');
  return {
    ...actual,
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    },
  };
});

const { logger } = await import('@/shared/lib');

function renderWithGate(initialEntries: string[] = ['/admin']) {
  return render(
    <Routes>
      <Route
        path="/admin"
        element={
          <AdminGate>
            <div>admin-content</div>
          </AdminGate>
        }
      />
      <Route path="/login" element={<div>login-page</div>} />
    </Routes>,
    { wrapper: makeRouterWrapper({ initialEntries }) },
  );
}

describe('AdminGate', () => {
  beforeEach(() => {
    vi.mocked(logger.error).mockClear();
  });

  afterEach(() => {
    useUserStore.getState().clearAuth();
  });

  it('로딩 중에는 children 도 redirect 도 렌더하지 않는다', () => {
    // /api/auth/me 응답을 지연시켜 isLoading 상태 유지
    server.use(http.get('/api/auth/me', () => new Promise(() => {})));
    useUserStore.getState().setAuth('token', { id: 'u-1', username: 'u', nickname: 'u', permissions: [] });

    renderWithGate();

    expect(screen.queryByText('admin-content')).not.toBeInTheDocument();
    expect(screen.queryByText('login-page')).not.toBeInTheDocument();
  });

  it('user:manage permission 보유 시 children 을 렌더한다', async () => {
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json({
          id: 'u-1',
          username: 'admin',
          nickname: '관리자',
          permissions: ['file:read', 'user:manage'],
        }),
      ),
    );
    useUserStore.getState().setAuth('token', { id: 'u-1', username: 'admin', nickname: '관리자', permissions: [] });

    renderWithGate();

    expect(await screen.findByText('admin-content')).toBeInTheDocument();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('user:manage 미보유 시 /login?error=not_admin 으로 리다이렉트하고 clearAuth 한다', async () => {
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json({
          id: 'u-2',
          username: 'user',
          nickname: '사용자',
          permissions: ['file:read'],
        }),
      ),
    );
    useUserStore.getState().setAuth('token', { id: 'u-2', username: 'user', nickname: '사용자', permissions: [] });

    renderWithGate();

    await waitFor(() => {
      expect(screen.queryByText('admin-content')).not.toBeInTheDocument();
      expect(screen.getByText('login-page')).toBeInTheDocument();
    });
    expect(useUserStore.getState().accessToken).toBeNull();
    // 유효한 array 지만 미보유 케이스 — 진단 로그는 띄우지 않는다
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('H5 — permissions 가 빈 array → redirect, 진단 로그는 미발생', async () => {
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json({
          id: 'u-3',
          username: 'noperm',
          nickname: '권한 없음',
          permissions: [],
        }),
      ),
    );
    useUserStore.getState().setAuth('token', { id: 'u-3', username: 'noperm', nickname: '권한 없음', permissions: [] });

    renderWithGate();

    await waitFor(() => expect(screen.getByText('login-page')).toBeInTheDocument());
    expect(useUserStore.getState().accessToken).toBeNull();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('H5 — permissions: null → redirect + 진단 로그 발생 (keys 만)', async () => {
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json({
          id: 'u-4',
          username: 'broken',
          nickname: '깨짐',
          permissions: null,
        }),
      ),
    );
    useUserStore.getState().setAuth('token', { id: 'u-4', username: 'broken', nickname: '깨짐', permissions: [] });

    renderWithGate();

    await waitFor(() => expect(screen.getByText('login-page')).toBeInTheDocument());
    expect(useUserStore.getState().accessToken).toBeNull();
    expect(logger.error).toHaveBeenCalledTimes(1);
    const [payload, message] = vi.mocked(logger.error).mock.calls[0];
    expect(message).toMatch(/permissions field/);
    // PII 보호 — payload 는 key 목록만 포함, data 본문은 노출 금지
    expect(payload).toEqual({ keys: expect.arrayContaining(['permissions', 'id', 'username']) });
  });

  it('H5 — permissions 필드 누락 → redirect + 진단 로그 발생', async () => {
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json({
          id: 'u-5',
          username: 'missing',
          nickname: '필드없음',
          // permissions 필드 자체 누락
        }),
      ),
    );
    useUserStore.getState().setAuth('token', { id: 'u-5', username: 'missing', nickname: '필드없음', permissions: [] });

    renderWithGate();

    await waitFor(() => expect(screen.getByText('login-page')).toBeInTheDocument());
    expect(useUserStore.getState().accessToken).toBeNull();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('H5 — permissions 가 non-array 객체 → redirect + 진단 로그 발생', async () => {
    server.use(
      http.get('/api/auth/me', () =>
        HttpResponse.json({
          id: 'u-6',
          username: 'object',
          nickname: '객체타입',
          permissions: { foo: 'bar' },
        }),
      ),
    );
    useUserStore.getState().setAuth('token', { id: 'u-6', username: 'object', nickname: '객체타입', permissions: [] });

    renderWithGate();

    await waitFor(() => expect(screen.getByText('login-page')).toBeInTheDocument());
    expect(useUserStore.getState().accessToken).toBeNull();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
