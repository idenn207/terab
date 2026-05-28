import { useUserStore } from '@/entities';
import { render, screen, waitFor } from '@testing-library/react';
import { server } from '@tests/mocks';
import { makeRouterWrapper } from '@tests/wrappers';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { AdminGate } from './AdminGate';

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
  });
});
