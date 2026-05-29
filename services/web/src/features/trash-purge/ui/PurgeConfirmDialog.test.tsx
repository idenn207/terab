import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPurge, mockReset, mockState } = vi.hoisted(() => ({
  mockPurge: vi.fn(),
  mockReset: vi.fn(),
  mockState: { isPending: false, error: null as Error | null },
}));

vi.mock('../model/usePurgeTrashItem', () => ({
  usePurgeTrashItem: () => ({
    purge: mockPurge,
    isPending: mockState.isPending,
    error: mockState.error,
    reset: mockReset,
  }),
}));

import { PurgeConfirmDialog } from './PurgeConfirmDialog';

beforeEach(() => {
  vi.clearAllMocks();
  mockState.isPending = false;
  mockState.error = null;
});

describe('PurgeConfirmDialog', () => {
  it('open=true 일 때 다이얼로그가 노출되고 항목명이 본문에 포함된다', () => {
    render(<PurgeConfirmDialog open={true} onClose={vi.fn()} itemId="t-1" itemType="file" itemName="오래된파일.pdf" />);

    expect(screen.getByText('이 항목을 영구 삭제')).toBeInTheDocument();
    expect(screen.getByText(/오래된파일\.pdf/)).toBeInTheDocument();
  });

  it('open=false 일 때 다이얼로그가 노출되지 않는다', () => {
    render(<PurgeConfirmDialog open={false} onClose={vi.fn()} itemId="t-1" itemType="file" itemName="오래된파일.pdf" />);

    expect(screen.queryByText('이 항목을 영구 삭제')).not.toBeInTheDocument();
  });

  it('영구 삭제 클릭 시 purge({ id, type }) 호출 + onClose 호출', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockPurge.mockResolvedValue(undefined);

    render(<PurgeConfirmDialog open={true} onClose={onClose} itemId="t-1" itemType="file" itemName="오래된파일.pdf" />);
    await user.click(screen.getByRole('button', { name: '영구 삭제' }));

    await waitFor(() => {
      expect(mockPurge).toHaveBeenCalledWith({ id: 't-1', type: 'file' });
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('취소 시 purge 가 호출되지 않고 onClose 만 호출된다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<PurgeConfirmDialog open={true} onClose={onClose} itemId="t-1" itemType="file" itemName="오래된파일.pdf" />);

    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(mockPurge).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('FILE_NOT_FOUND 응답 시 inline 에러 메시지가 표시된다', async () => {
    const user = userEvent.setup();
    const axiosError = new AxiosError('not found', undefined, undefined, undefined, {
      data: { code: 'FILE_NOT_FOUND', message: '파일을 찾을 수 없습니다.' },
      status: 404,
      statusText: 'Not Found',
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    mockPurge.mockRejectedValue(axiosError);

    render(<PurgeConfirmDialog open={true} onClose={vi.fn()} itemId="t-1" itemType="file" itemName="오래된파일.pdf" />);
    await user.click(screen.getByRole('button', { name: '영구 삭제' }));

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
    mockPurge.mockRejectedValue(axiosError);

    render(<PurgeConfirmDialog open={true} onClose={vi.fn()} itemId="t-1" itemType="file" itemName="오래된파일.pdf" />);
    await user.click(screen.getByRole('button', { name: '영구 삭제' }));

    expect(await screen.findByText('부모 항목이 휴지통에 있어 단독으로 처리할 수 없습니다.')).toBeInTheDocument();
  });
});
