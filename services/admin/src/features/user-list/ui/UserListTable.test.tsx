import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AdminUser } from '@/entities';
import { UserListTable } from './UserListTable';

const sampleUser: AdminUser = {
  id: '11111111-1111-1111-1111-111111111111',
  username: 'admin01',
  nickname: '관리자',
  createdAt: '2026-05-29T10:00:00.000Z',
  roleNames: ['admin', 'user'],
};

describe('UserListTable', () => {
  it('헤더와 사용자 행을 렌더링한다', () => {
    render(<UserListTable users={[sampleUser]} />);
    expect(screen.getByRole('columnheader', { name: '아이디' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '닉네임' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '역할' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '가입일' })).toBeInTheDocument();
    expect(screen.getByText('admin01')).toBeInTheDocument();
    expect(screen.getByText('관리자')).toBeInTheDocument();
  });

  it('roleNames 가 비어있으면 — 으로 표시한다', () => {
    render(<UserListTable users={[{ ...sampleUser, roleNames: [] }]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('여러 사용자 행을 모두 렌더링한다', () => {
    const second: AdminUser = { ...sampleUser, id: 'b', username: 'user02', nickname: '두번째' };
    render(<UserListTable users={[sampleUser, second]} />);
    expect(screen.getByText('admin01')).toBeInTheDocument();
    expect(screen.getByText('user02')).toBeInTheDocument();
  });
});
