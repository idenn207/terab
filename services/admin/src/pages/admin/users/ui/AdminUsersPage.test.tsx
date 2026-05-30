import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeAll, describe, expect, it } from 'vitest';
import { server } from '@tests/mocks';
import { makeRouterWrapper } from '@tests/wrappers';
import { AdminUsersPage } from './AdminUsersPage';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});

const sampleUserResponse = {
  items: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      username: 'admin01',
      nickname: '관리자',
      createdAt: '2026-05-29T10:00:00.000Z',
      roleNames: ['admin'],
    },
  ],
  total: 1,
  limit: 50,
  offset: 0,
};

describe('AdminUsersPage', () => {
  it('사용자 목록과 초대 버튼을 표시한다', async () => {
    server.use(http.get('/api/admin/users', () => HttpResponse.json(sampleUserResponse)));
    const Wrapper = makeRouterWrapper({ initialEntries: ['/admin/users'] });
    render(<AdminUsersPage />, { wrapper: Wrapper });
    expect(await screen.findByText('admin01')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '사용자 초대' })).toBeInTheDocument();
  });

  it('초대 버튼 클릭 시 InviteDialog 가 열린다', async () => {
    server.use(http.get('/api/admin/users', () => HttpResponse.json(sampleUserResponse)));
    const user = userEvent.setup();
    const Wrapper = makeRouterWrapper({ initialEntries: ['/admin/users'] });
    render(<AdminUsersPage />, { wrapper: Wrapper });

    await screen.findByText('admin01');
    await user.click(screen.getByRole('button', { name: '사용자 초대' }));
    expect(await screen.findByLabelText('만료 기간 (일)')).toBeInTheDocument();
  });
});
