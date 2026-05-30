import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UserListError } from './UserListError';

describe('UserListError', () => {
  it('role="alert" 컨테이너에 오류 메시지를 표시한다', () => {
    render(<UserListError />);
    expect(screen.getByRole('alert')).toHaveTextContent('사용자 목록을 불러오지 못했습니다.');
  });

  it('onRetry 가 주어지면 재시도 버튼이 호출된다', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<UserListError onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('isRetrying=true 면 버튼이 disabled 되고 라벨이 바뀐다', () => {
    render(<UserListError onRetry={() => {}} isRetrying />);
    const button = screen.getByRole('button', { name: '재시도 중...' });
    expect(button).toBeDisabled();
  });
});
