import * as Headless from '@headlessui/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRename, mockReset, mockState } = vi.hoisted(() => ({
  mockRename: vi.fn(),
  mockReset: vi.fn(),
  mockState: { isPending: false, error: null as Error | null },
}));

vi.mock('../model/useRenameFolder', () => ({
  useRenameFolder: () => ({
    rename: mockRename,
    isPending: mockState.isPending,
    error: mockState.error,
    reset: mockReset,
  }),
}));

import { RenameFolderDialog, RenameFolderMenuItem } from './RenameFolderMenuItem';

const folder = {
  id: 'f-1',
  name: '사진',
  parentId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderTriggerInMenu(onOpen: () => void) {
  return render(
    <Headless.Menu>
      <Headless.MenuButton>열기</Headless.MenuButton>
      <Headless.MenuItems static>
        <RenameFolderMenuItem folder={folder} onOpen={onOpen} />
      </Headless.MenuItems>
    </Headless.Menu>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockState.isPending = false;
  mockState.error = null;
});

describe('RenameFolderMenuItem (trigger)', () => {
  it('메뉴 항목 클릭 시 onOpen 콜백을 호출한다', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    renderTriggerInMenu(onOpen);

    await user.click(screen.getByRole('menuitem', { name: /이름 변경/ }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('RenameFolderDialog', () => {
  it('open=true 일 때 현재 폴더 이름이 채워진 채로 다이얼로그가 노출된다', () => {
    render(<RenameFolderDialog folder={folder} open={true} onClose={vi.fn()} />);

    expect(screen.getByLabelText('새 이름')).toHaveValue('사진');
  });

  it('open=false 일 때는 다이얼로그가 노출되지 않는다', () => {
    render(<RenameFolderDialog folder={folder} open={false} onClose={vi.fn()} />);

    expect(screen.queryByLabelText('새 이름')).not.toBeInTheDocument();
  });

  it('변경 후 제출 시 rename({ id, newName }) 호출 + onClose 호출', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockRename.mockResolvedValue({ id: 'f-1', name: '추억', parentId: null });

    render(<RenameFolderDialog folder={folder} open={true} onClose={onClose} />);

    const input = screen.getByLabelText('새 이름');
    await user.clear(input);
    await user.type(input, '추억');
    await user.click(screen.getByRole('button', { name: '변경' }));

    await waitFor(() => {
      expect(mockRename).toHaveBeenCalledWith({ id: 'f-1', newName: '추억' });
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('이름이 변경되지 않았으면 mutation 을 호출하지 않고 닫는다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<RenameFolderDialog folder={folder} open={true} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: '변경' }));

    expect(mockRename).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('빈 이름은 차단되고 안내 메시지가 표시된다', async () => {
    const user = userEvent.setup();
    render(<RenameFolderDialog folder={folder} open={true} onClose={vi.fn()} />);

    const input = screen.getByLabelText('새 이름');
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: '변경' }));

    expect(mockRename).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('폴더 이름을 입력해주세요.');
  });
});
