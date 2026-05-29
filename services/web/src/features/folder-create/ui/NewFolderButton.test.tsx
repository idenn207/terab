import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreate, mockReset, mockState } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockReset: vi.fn(),
  mockState: { isPending: false, error: null as Error | null },
}));

vi.mock('../model/useCreateFolder', () => ({
  useCreateFolder: () => ({
    create: mockCreate,
    isPending: mockState.isPending,
    error: mockState.error,
    reset: mockReset,
  }),
}));

import { NewFolderButton } from './NewFolderButton';

beforeEach(() => {
  vi.clearAllMocks();
  mockState.isPending = false;
  mockState.error = null;
});

describe('NewFolderButton', () => {
  it('초기에는 다이얼로그가 닫혀 있고 트리거 버튼만 보인다', () => {
    render(<NewFolderButton parentId={null} />);

    expect(screen.getByRole('button', { name: '새 폴더' })).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: '새 폴더 만들기' })).not.toBeInTheDocument();
  });

  it('새 폴더 클릭 시 다이얼로그가 열린다', async () => {
    const user = userEvent.setup();
    render(<NewFolderButton parentId={null} />);

    await user.click(screen.getByRole('button', { name: '새 폴더' }));

    expect(await screen.findByRole('form', { name: '새 폴더 만들기' })).toBeInTheDocument();
  });

  it('폼 제출 시 create({ name, parentId }) 를 호출한다', async () => {
    const user = userEvent.setup();
    mockCreate.mockResolvedValue({ id: 'f-1', name: '이미지', parentId: null });
    render(<NewFolderButton parentId={null} />);

    await user.click(screen.getByRole('button', { name: '새 폴더' }));
    await user.type(await screen.findByLabelText('폴더 이름'), '이미지');
    await user.click(screen.getByRole('button', { name: '만들기' }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({ name: '이미지', parentId: null });
    });
  });

  it('parentId 가 전달되면 같은 값으로 create 가 호출된다', async () => {
    const user = userEvent.setup();
    mockCreate.mockResolvedValue({ id: 'f-2', name: '2026', parentId: 'p-1' });
    render(<NewFolderButton parentId="p-1" />);

    await user.click(screen.getByRole('button', { name: '새 폴더' }));
    await user.type(await screen.findByLabelText('폴더 이름'), '2026');
    await user.click(screen.getByRole('button', { name: '만들기' }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({ name: '2026', parentId: 'p-1' });
    });
  });

  it('빈 이름은 제출 시 차단되고 안내 메시지가 표시된다', async () => {
    const user = userEvent.setup();
    render(<NewFolderButton parentId={null} />);

    await user.click(screen.getByRole('button', { name: '새 폴더' }));
    await user.click(await screen.findByRole('button', { name: '만들기' }));

    expect(mockCreate).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('폴더 이름을 입력해주세요.');
  });

  it('FOLDER_DEPTH_EXCEEDED 응답 시 사용자에게 메시지를 보여준다', async () => {
    const user = userEvent.setup();
    const axiosError = new AxiosError('depth limit', undefined, undefined, undefined, {
      data: { code: 'FOLDER_DEPTH_EXCEEDED', message: '폴더 깊이 한도를 초과했습니다.' },
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    mockCreate.mockRejectedValue(axiosError);

    render(<NewFolderButton parentId="p-1" />);
    await user.click(screen.getByRole('button', { name: '새 폴더' }));
    await user.type(await screen.findByLabelText('폴더 이름'), '깊은폴더');
    await user.click(screen.getByRole('button', { name: '만들기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('폴더 깊이 한도를 초과했습니다.');
  });
});
