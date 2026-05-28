import * as Headless from '@headlessui/react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRemove, mockReset, mockState } = vi.hoisted(() => ({
  mockRemove: vi.fn(),
  mockReset: vi.fn(),
  mockState: { isPending: false, error: null as Error | null },
}));

vi.mock('../model/useDeleteFolder', () => ({
  useDeleteFolder: () => ({
    remove: mockRemove,
    isPending: mockState.isPending,
    error: mockState.error,
    reset: mockReset,
  }),
}));

import { DeleteFolderDialog, DeleteFolderMenuItem } from './DeleteFolderMenuItem';

const folder = {
  id: 'f-1',
  name: '오래된폴더',
  parentId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderTriggerInMenu(onOpen: () => void) {
  return render(
    <Headless.Menu>
      <Headless.MenuButton>열기</Headless.MenuButton>
      <Headless.MenuItems static>
        <DeleteFolderMenuItem folder={folder} onOpen={onOpen} />
      </Headless.MenuItems>
    </Headless.Menu>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockState.isPending = false;
  mockState.error = null;
});

describe('DeleteFolderMenuItem (trigger)', () => {
  it('삭제 메뉴 클릭 시 onOpen 콜백을 호출한다', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    renderTriggerInMenu(onOpen);

    await user.click(screen.getByRole('menuitem', { name: /삭제/ }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('DeleteFolderDialog', () => {
  it('open=true 일 때 confirm 다이얼로그가 노출되고 폴더명이 본문에 포함된다', () => {
    render(<DeleteFolderDialog folder={folder} open={true} onClose={vi.fn()} />);

    expect(screen.getByText('이 폴더를 휴지통으로 이동')).toBeInTheDocument();
    expect(screen.getByText(/오래된폴더/)).toBeInTheDocument();
  });

  it('open=false 일 때 다이얼로그가 노출되지 않는다', () => {
    render(<DeleteFolderDialog folder={folder} open={false} onClose={vi.fn()} />);

    expect(screen.queryByText('이 폴더를 휴지통으로 이동')).not.toBeInTheDocument();
  });

  it('휴지통으로 이동 클릭 시 remove({ id }) 호출 + onClose 호출', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockRemove.mockResolvedValue(undefined);

    render(<DeleteFolderDialog folder={folder} open={true} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: '휴지통으로 이동' }));

    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalledWith({ id: 'f-1' });
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('취소 시 remove 가 호출되지 않고 onClose 만 호출된다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DeleteFolderDialog folder={folder} open={true} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(mockRemove).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('FOLDER_NOT_FOUND 응답 시 메시지가 표시된다', async () => {
    const user = userEvent.setup();
    const axiosError = new AxiosError('not found', undefined, undefined, undefined, {
      data: { code: 'FOLDER_NOT_FOUND', message: '폴더를 찾을 수 없습니다.' },
      status: 404,
      statusText: 'Not Found',
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    mockRemove.mockRejectedValue(axiosError);

    render(<DeleteFolderDialog folder={folder} open={true} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '휴지통으로 이동' }));

    expect(await screen.findByText('폴더를 찾을 수 없습니다.')).toBeInTheDocument();
  });
});
