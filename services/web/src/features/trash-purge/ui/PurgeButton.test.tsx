import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./PurgeConfirmDialog', () => ({
  PurgeConfirmDialog: ({ open, itemName }: { open: boolean; onClose: () => void; itemName: string }) =>
    open ? <div role="dialog" aria-label={`${itemName} 영구 삭제 확인`} /> : null,
}));

import { PurgeButton } from './PurgeButton';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PurgeButton', () => {
  it('초기 상태에서는 confirm 다이얼로그가 노출되지 않는다', () => {
    render(<PurgeButton itemId="t-1" itemType="file" itemName="문서.pdf" />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('영구 삭제 클릭 시 confirm 다이얼로그가 노출된다', async () => {
    const user = userEvent.setup();
    render(<PurgeButton itemId="t-1" itemType="file" itemName="문서.pdf" />);

    await user.click(screen.getByRole('button', { name: '문서.pdf 영구 삭제' }));

    expect(screen.getByRole('dialog', { name: '문서.pdf 영구 삭제 확인' })).toBeInTheDocument();
  });
});
