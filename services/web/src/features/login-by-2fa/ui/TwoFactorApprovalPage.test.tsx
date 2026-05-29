import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockUseRespond, mockRespond } = vi.hoisted(() => ({
  mockUseRespond: vi.fn(),
  mockRespond: vi.fn(),
}));

vi.mock('../model/useTwoFactorRespond', () => ({
  useTwoFactorRespond: () => mockUseRespond(),
}));

import { TwoFactorApprovalPage } from './TwoFactorApprovalPage';

function renderApprovalPage() {
  return render(
    <MemoryRouter initialEntries={['/2fa/ch-1']}>
      <Routes>
        <Route path="/2fa/:id" element={<TwoFactorApprovalPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TwoFactorApprovalPage', () => {
  it('loading 상태: aria-live polite 메시지 노출', () => {
    mockUseRespond.mockReturnValue({ options: [], respondStatus: 'loading', respond: mockRespond });
    renderApprovalPage();

    const loadingNode = screen.getByText('불러오는 중...');
    expect(loadingNode).toHaveAttribute('aria-live', 'polite');
  });

  it('expired 상태: 만료 안내 + role=alert 메시지', () => {
    mockUseRespond.mockReturnValue({ options: [], respondStatus: 'expired', respond: mockRespond });
    renderApprovalPage();

    expect(screen.getByRole('heading', { level: 1, name: '요청이 만료되었습니다' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('PC 에서 다시 로그인을 시도해 주세요.');
  });

  it('done 상태: role=status 메시지로 완료 통지', () => {
    mockUseRespond.mockReturnValue({ options: [], respondStatus: 'done', respond: mockRespond });
    renderApprovalPage();

    expect(screen.getByRole('status')).toHaveTextContent('선택 완료');
    expect(screen.getByText('PC 화면에서 결과를 확인하세요.')).toBeInTheDocument();
  });

  it('selecting 상태: heading + 옵션 3개 button + group role', () => {
    mockUseRespond.mockReturnValue({
      options: ['11', '22', '33'],
      respondStatus: 'selecting',
      respond: mockRespond,
    });
    renderApprovalPage();

    expect(screen.getByRole('heading', { level: 1, name: '로그인 승인' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '승인 번호 선택' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '11' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '22' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '33' })).toBeInTheDocument();
  });

  it('selecting 상태에서 옵션 클릭 시 respond 가 선택값으로 호출된다', async () => {
    mockUseRespond.mockReturnValue({
      options: ['11', '22', '33'],
      respondStatus: 'selecting',
      respond: mockRespond,
    });
    renderApprovalPage();

    await userEvent.click(screen.getByRole('button', { name: '22' }));

    expect(mockRespond).toHaveBeenCalledWith('22');
  });

  it('selecting 상태에서 키보드 Tab 으로 모든 옵션에 도달 가능', async () => {
    mockUseRespond.mockReturnValue({
      options: ['11', '22', '33'],
      respondStatus: 'selecting',
      respond: mockRespond,
    });
    renderApprovalPage();
    const user = userEvent.setup();

    await user.tab();
    expect(screen.getByRole('button', { name: '11' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: '22' })).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: '33' })).toHaveFocus();
  });
});
