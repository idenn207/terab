import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface TrustedDeviceLike {
  id: string;
  userAgent?: string;
  createdAt: string;
}

const { mockUseList, mockListState } = vi.hoisted(() => ({
  mockUseList: vi.fn(),
  mockListState: {
    devices: [] as TrustedDeviceLike[],
    isLoading: false,
    error: null as Error | null,
  },
}));

vi.mock('../model/useTrustedDeviceList', () => ({
  useTrustedDeviceList: () => mockUseList(),
}));

vi.mock('./TrustedDeviceRevokeDialog', () => ({
  TrustedDeviceRevokeDialog: ({ device, open, onClose }: { device: TrustedDeviceLike | null; open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="revoke-dialog" data-device-id={device?.id ?? ''}>
        <button type="button" onClick={onClose}>
          닫기
        </button>
      </div>
    ) : null,
}));

import { TrustedDeviceSection } from './TrustedDeviceSection';

beforeEach(() => {
  vi.clearAllMocks();
  mockListState.devices = [];
  mockListState.isLoading = false;
  mockListState.error = null;
  mockUseList.mockImplementation(() => ({ ...mockListState }));
});

describe('TrustedDeviceSection', () => {
  it('section heading 이 항상 노출된다', () => {
    render(<TrustedDeviceSection />);
    expect(screen.getByRole('heading', { name: '신뢰된 기기', level: 2 })).toBeInTheDocument();
  });

  it('isLoading 이면 "불러오는 중..." 메시지가 노출된다', () => {
    mockListState.isLoading = true;
    render(<TrustedDeviceSection />);

    expect(screen.getByText('불러오는 중...')).toBeInTheDocument();
  });

  it('devices 가 비어 있으면 empty 메시지가 노출된다', () => {
    render(<TrustedDeviceSection />);

    expect(screen.getByText('등록된 신뢰기기가 없습니다.')).toBeInTheDocument();
  });

  it('devices 가 있으면 각 기기 행에 user-agent 와 등록일이 노출된다', () => {
    mockListState.devices = [
      { id: 'd1', userAgent: 'Pixel 9 / Chrome 134', createdAt: '2026-05-01T09:00:00.000Z' },
      { id: 'd2', createdAt: '2026-05-15T10:30:00.000Z' },
    ];
    render(<TrustedDeviceSection />);

    expect(screen.getByText('Pixel 9 / Chrome 134')).toBeInTheDocument();
    expect(screen.getByText('알 수 없는 기기')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /신뢰기기 해제/ })).toHaveLength(2);
  });

  it('해제 버튼 클릭 시 revoke dialog 가 open=true + 해당 device id 와 함께 렌더된다', async () => {
    const user = userEvent.setup();
    mockListState.devices = [{ id: 'd1', userAgent: 'Pixel 9', createdAt: '2026-05-01T09:00:00.000Z' }];
    render(<TrustedDeviceSection />);

    expect(screen.queryByTestId('revoke-dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Pixel 9 신뢰기기 해제/ }));

    const dialog = await screen.findByTestId('revoke-dialog');
    expect(dialog).toHaveAttribute('data-device-id', 'd1');
  });

  it('dialog 의 onClose 호출 후 dialog 가 사라진다', async () => {
    const user = userEvent.setup();
    mockListState.devices = [{ id: 'd1', userAgent: 'Pixel 9', createdAt: '2026-05-01T09:00:00.000Z' }];
    render(<TrustedDeviceSection />);

    await user.click(screen.getByRole('button', { name: /Pixel 9 신뢰기기 해제/ }));
    expect(screen.getByTestId('revoke-dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByTestId('revoke-dialog')).not.toBeInTheDocument();
  });
});
