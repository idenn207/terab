import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UserListEmpty } from './UserListEmpty';

describe('UserListEmpty', () => {
  it('빈 상태 안내 문구를 표시한다', () => {
    render(<UserListEmpty />);
    expect(screen.getByText('아직 등록된 사용자가 없습니다.')).toBeInTheDocument();
  });

  it('onInviteClick 가 주어지면 초대 버튼을 노출하고 클릭 시 호출된다', async () => {
    const onInviteClick = vi.fn();
    const user = userEvent.setup();
    render(<UserListEmpty onInviteClick={onInviteClick} />);
    await user.click(screen.getByRole('button', { name: '사용자 초대' }));
    expect(onInviteClick).toHaveBeenCalledTimes(1);
  });

  it('onInviteClick 가 없으면 초대 버튼을 표시하지 않는다', () => {
    render(<UserListEmpty />);
    expect(screen.queryByRole('button', { name: '사용자 초대' })).not.toBeInTheDocument();
  });
});
