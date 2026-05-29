import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRestore, mockReset, mockState } = vi.hoisted(() => ({
  mockRestore: vi.fn(),
  mockReset: vi.fn(),
  mockState: { isPending: false, error: null as Error | null },
}));

vi.mock('../model/useRestoreTrashItem', () => ({
  useRestoreTrashItem: () => ({
    restore: mockRestore,
    isPending: mockState.isPending,
    error: mockState.error,
    reset: mockReset,
  }),
}));

import { RestoreButton } from './RestoreButton';

beforeEach(() => {
  vi.clearAllMocks();
  mockState.isPending = false;
  mockState.error = null;
});

describe('RestoreButton', () => {
  it('클릭 시 restore({ id, type }) 가 호출된다', async () => {
    const user = userEvent.setup();
    mockRestore.mockResolvedValue(undefined);

    render(<RestoreButton itemId="t-1" itemType="file" itemName="report.pdf" />);
    await user.click(screen.getByRole('button', { name: 'report.pdf 복원' }));

    await waitFor(() => {
      expect(mockRestore).toHaveBeenCalledWith({ id: 't-1', type: 'file' });
    });
  });

  it('폴더 항목 복원 시 type=folder 를 전달한다', async () => {
    const user = userEvent.setup();
    mockRestore.mockResolvedValue(undefined);

    render(<RestoreButton itemId="t-2" itemType="folder" itemName="문서" />);
    await user.click(screen.getByRole('button', { name: '문서 복원' }));

    await waitFor(() => {
      expect(mockRestore).toHaveBeenCalledWith({ id: 't-2', type: 'folder' });
    });
  });

  it('mutation 에러 발생 시 inline 에러 메시지가 표시된다', async () => {
    const user = userEvent.setup();
    const axiosError = new AxiosError('not found', undefined, undefined, undefined, {
      data: { code: 'FILE_NOT_FOUND', message: '파일을 찾을 수 없습니다.' },
      status: 404,
      statusText: 'Not Found',
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    mockRestore.mockRejectedValue(axiosError);

    render(<RestoreButton itemId="t-1" itemType="file" itemName="report.pdf" />);
    await user.click(screen.getByRole('button', { name: 'report.pdf 복원' }));

    expect(await screen.findByText('파일을 찾을 수 없습니다.')).toBeInTheDocument();
  });

  it('PARENT_IN_TRASH 응답 시 부모 가드 메시지가 노출된다 (defense-in-depth)', async () => {
    const user = userEvent.setup();
    const axiosError = new AxiosError('bad request', undefined, undefined, undefined, {
      data: {
        code: 'PARENT_IN_TRASH',
        message: '부모 항목이 휴지통에 있어 단독으로 처리할 수 없습니다.',
      },
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    mockRestore.mockRejectedValue(axiosError);

    render(<RestoreButton itemId="t-1" itemType="file" itemName="report.pdf" />);
    await user.click(screen.getByRole('button', { name: 'report.pdf 복원' }));

    expect(await screen.findByText('부모 항목이 휴지통에 있어 단독으로 처리할 수 없습니다.')).toBeInTheDocument();
  });
});
