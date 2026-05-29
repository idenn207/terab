import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUsePolling, mockUseTrusted, mockResend, mockNavigate } = vi.hoisted(() => ({
  mockUsePolling: vi.fn(),
  mockUseTrusted: vi.fn(),
  mockResend: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('../model/useTwoFactorPolling', () => ({
  useTwoFactorPolling: () => mockUsePolling(),
}));

vi.mock('@/features/trusted-device', () => ({
  useTrustedDevice: () => mockUseTrusted(),
  TrustThisDeviceCheckbox: ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <label>
      <input type="checkbox" aria-label="이 기기를 신뢰" checked={checked} onChange={(e) => onChange(e.target.checked)} />이 기기를 신뢰
    </label>
  ),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import { TwoFactorWaiting } from './TwoFactorWaiting';

function renderWaiting() {
  return render(
    <MemoryRouter initialEntries={['/login/2fa?id=ch-1']}>
      <TwoFactorWaiting />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUsePolling.mockReturnValue({
    options: ['12', '34', '56'],
    correctNum: '34',
    remainingSeconds: 125,
    resend: mockResend,
  });
  mockUseTrusted.mockReturnValue({ register: vi.fn() });
});

describe('TwoFactorWaiting', () => {
  it('Heading + 안내 + 승인 번호 + 남은 시간을 모두 렌더링한다', () => {
    renderWaiting();

    expect(screen.getByRole('heading', { level: 1, name: 'Push 2FA' })).toBeInTheDocument();
    expect(screen.getByText('모바일 기기에서 아래 숫자를 선택해 주세요.')).toBeInTheDocument();
    expect(screen.getByLabelText('승인 번호 34')).toHaveTextContent('34');
    expect(screen.getByText('남은 시간 02:05')).toBeInTheDocument();
  });

  it('남은 시간 0초는 "00:00" 으로 padding 된다', () => {
    mockUsePolling.mockReturnValue({
      options: [],
      correctNum: '00',
      remainingSeconds: 0,
      resend: mockResend,
    });

    renderWaiting();

    expect(screen.getByText('남은 시간 00:00')).toBeInTheDocument();
  });

  it('"재전송" 클릭 시 polling 훅의 resend 가 호출된다', async () => {
    renderWaiting();

    await userEvent.click(screen.getByRole('button', { name: '재전송' }));

    expect(mockResend).toHaveBeenCalledTimes(1);
  });

  it('"백업 코드 사용" 클릭 시 /login/backup 으로 이동한다', async () => {
    renderWaiting();

    await userEvent.click(screen.getByRole('button', { name: '백업 코드 사용' }));

    expect(mockNavigate).toHaveBeenCalledWith('/login/backup');
  });

  it('키보드 Tab navigation 순서: 신뢰 체크박스 → 재전송 → 백업 코드 사용', async () => {
    renderWaiting();
    const user = userEvent.setup();

    await user.tab();
    expect(screen.getByRole('checkbox', { name: '이 기기를 신뢰' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: '재전송' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: '백업 코드 사용' })).toHaveFocus();
  });
});
