import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRevoke, mockReset, mockState } = vi.hoisted(() => ({
  mockRevoke: vi.fn(),
  mockReset: vi.fn(),
  mockState: { isPending: false, error: null as Error | null },
}));

vi.mock('../model/useRevokeTrustedDevice', () => ({
  useRevokeTrustedDevice: () => ({
    revoke: mockRevoke,
    isPending: mockState.isPending,
    error: mockState.error,
    reset: mockReset,
  }),
}));

import { TrustedDeviceRevokeDialog } from './TrustedDeviceRevokeDialog';

const device = { id: 'd-1', userAgent: 'Pixel 9 / Chrome 134', createdAt: '2026-05-01T09:00:00.000Z' };

beforeEach(() => {
  vi.clearAllMocks();
  mockState.isPending = false;
  mockState.error = null;
});

describe('TrustedDeviceRevokeDialog', () => {
  it('open=true + device 가 있으면 다이얼로그가 노출되고 device label 이 본문에 포함된다', () => {
    render(<TrustedDeviceRevokeDialog device={device} open={true} onClose={vi.fn()} />);

    expect(screen.getByText('신뢰기기 해제')).toBeInTheDocument();
    expect(screen.getByText(/Pixel 9 \/ Chrome 134/)).toBeInTheDocument();
  });

  it('device 가 null 이면 open 이 true 라도 본문이 노출되지 않는다', () => {
    render(<TrustedDeviceRevokeDialog device={null} open={true} onClose={vi.fn()} />);

    expect(screen.queryByText('신뢰기기 해제')).not.toBeInTheDocument();
  });

  it('open=false 일 때 본문이 노출되지 않는다', () => {
    render(<TrustedDeviceRevokeDialog device={device} open={false} onClose={vi.fn()} />);

    expect(screen.queryByText('신뢰기기 해제')).not.toBeInTheDocument();
  });

  it('해제 클릭 시 revoke({ id }) 호출 + onClose 호출', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    mockRevoke.mockResolvedValue(undefined);

    render(<TrustedDeviceRevokeDialog device={device} open={true} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: '해제' }));

    await waitFor(() => expect(mockRevoke).toHaveBeenCalledWith({ id: 'd-1' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('취소 시 revoke 가 호출되지 않고 onClose 만 호출된다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TrustedDeviceRevokeDialog device={device} open={true} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(mockRevoke).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('TRUSTED_DEVICE_NOT_FOUND 응답 시 메시지가 표시되고 dialog 는 닫히지 않는다', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const axiosError = new AxiosError('not found', undefined, undefined, undefined, {
      data: { code: 'TRUSTED_DEVICE_NOT_FOUND', message: '신뢰기기를 찾을 수 없습니다.' },
      status: 404,
      statusText: 'Not Found',
      headers: {},
      config: { headers: new AxiosHeaders() },
    });
    mockRevoke.mockRejectedValue(axiosError);

    render(<TrustedDeviceRevokeDialog device={device} open={true} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: '해제' }));

    expect(await screen.findByText('신뢰기기를 찾을 수 없습니다.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('isPending 이면 해제/취소 버튼이 disabled 가 된다', () => {
    mockState.isPending = true;
    render(<TrustedDeviceRevokeDialog device={device} open={true} onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: /해제 중/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
  });
});
