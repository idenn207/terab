import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@tests/mocks';
import { makeQueryWrapper } from '@tests/wrappers';
import { UserListSection } from './UserListSection';

const handlerUrl = '/api/admin/users';

const sampleResponse = {
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

describe('UserListSection', () => {
  it('성공 응답에서 사용자 표를 표시한다', async () => {
    server.use(http.get(handlerUrl, () => HttpResponse.json(sampleResponse)));
    const Wrapper = makeQueryWrapper();
    render(<UserListSection />, { wrapper: Wrapper });
    expect(await screen.findByText('admin01')).toBeInTheDocument();
  });

  it('빈 응답에서 Empty 안내를 표시한다', async () => {
    server.use(http.get(handlerUrl, () => HttpResponse.json({ items: [], total: 0, limit: 50, offset: 0 })));
    const Wrapper = makeQueryWrapper();
    render(<UserListSection />, { wrapper: Wrapper });
    expect(await screen.findByText('아직 등록된 사용자가 없습니다.')).toBeInTheDocument();
  });

  it('오류 응답에서 Error 안내를 표시한다', async () => {
    server.use(http.get(handlerUrl, () => new HttpResponse(null, { status: 500 })));
    const Wrapper = makeQueryWrapper();
    render(<UserListSection />, { wrapper: Wrapper });
    expect(await screen.findByRole('alert')).toHaveTextContent('사용자 목록을 불러오지 못했습니다.');
  });
});
