import * as Headless from '@headlessui/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockMove, mockReset, mockState } = vi.hoisted(() => ({
  mockMove: vi.fn(),
  mockReset: vi.fn(),
  mockState: { isPending: false, error: null as Error | null },
}));

vi.mock('../model/useMoveFolder', () => ({
  useMoveFolder: () => ({
    move: mockMove,
    isPending: mockState.isPending,
    error: mockState.error,
    reset: mockReset,
  }),
}));

vi.mock('./FolderTreePicker', () => ({
  FolderTreePicker: ({
    excludedFolderId,
    selectedParentId,
    onSelect,
  }: {
    excludedFolderId: string;
    selectedParentId: string | null;
    onSelect: (id: string | null) => void;
  }) => (
    <div data-testid="folder-tree-picker" data-excluded={excludedFolderId} data-selected={selectedParentId ?? 'root'}>
      <button type="button" onClick={() => onSelect(null)}>
        루트 선택
      </button>
      <button type="button" onClick={() => onSelect('p-target')}>
        대상 폴더 선택
      </button>
    </div>
  ),
}));

import { MoveFolderDialog, MoveFolderMenuItem } from './MoveFolderMenuItem';

const folder = {
  id: 'f-1',
  name: '2026',
  parentId: 'p-old',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderTriggerInMenu(onOpen: () => void) {
  return render(
    <Headless.Menu>
      <Headless.MenuButton>열기</Headless.MenuButton>
      <Headless.MenuItems static>
        <MoveFolderMenuItem folder={folder} onOpen={onOpen} />
      </Headless.MenuItems>
    </Headless.Menu>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockState.isPending = false;
  mockState.error = null;
});

describe('MoveFolderMenuItem (trigger)', () => {
  it('이동 메뉴 클릭 시 onOpen 콜백을 호출한다', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    renderTriggerInMenu(onOpen);

    await user.click(screen.getByRole('menuitem', { name: /이동/ }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('MoveFolderDialog', () => {
  it('open=true 일 때 FolderTreePicker 에 자기 자신이 excluded 로 전달된다', () => {
    render(<MoveFolderDialog folder={folder} open={true} onClose={vi.fn()} />);

    const picker = screen.getByTestId('folder-tree-picker');
    expect(picker).toHaveAttribute('data-excluded', 'f-1');
  });

  it('초기 선택 상태는 현재 부모 폴더이다', () => {
    render(<MoveFolderDialog folder={folder} open={true} onClose={vi.fn()} />);

    const picker = screen.getByTestId('folder-tree-picker');
    expect(picker).toHaveAttribute('data-selected', 'p-old');
  });

  it('open=false 일 때 다이얼로그가 노출되지 않는다', () => {
    render(<MoveFolderDialog folder={folder} open={false} onClose={vi.fn()} />);

    expect(screen.queryByTestId('folder-tree-picker')).not.toBeInTheDocument();
  });

  it('대상 선택 후 이동 클릭 시 move({ id, targetParentId }) 호출 + onClose 호출', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockMove.mockResolvedValue({ id: 'f-1', name: '2026', parentId: 'p-target' });

    render(<MoveFolderDialog folder={folder} open={true} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: '대상 폴더 선택' }));
    await user.click(screen.getByRole('button', { name: '이동' }));

    await waitFor(() => {
      expect(mockMove).toHaveBeenCalledWith({ id: 'f-1', targetParentId: 'p-target' });
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('현재 부모와 동일한 위치 선택 시 mutation 미호출 + 안내 메시지', async () => {
    const user = userEvent.setup();
    render(<MoveFolderDialog folder={folder} open={true} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '이동' }));

    expect(mockMove).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/현재 위치와 동일/);
  });

  it('INVALID_MOVE_TARGET 응답 시 에러 메시지가 표시된다', async () => {
    const user = userEvent.setup();
    const axiosError = new AxiosError('invalid target', undefined, undefined, undefined, {
      data: { code: 'INVALID_MOVE_TARGET', message: '자기 자신 또는 자손 폴더로는 이동할 수 없습니다.' },
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    mockMove.mockRejectedValue(axiosError);

    render(<MoveFolderDialog folder={folder} open={true} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '대상 폴더 선택' }));
    await user.click(screen.getByRole('button', { name: '이동' }));

    expect(await screen.findByText('자기 자신 또는 자손 폴더로는 이동할 수 없습니다.')).toBeInTheDocument();
  });
});
