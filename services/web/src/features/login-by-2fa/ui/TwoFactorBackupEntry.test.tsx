import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TWO_FACTOR_ERROR_MESSAGES } from '../model/twoFactorErrors';

const { mockUseBackupLogin, mockLoginWithBackup, mockNavigate } = vi.hoisted(() => ({
  mockUseBackupLogin: vi.fn(),
  mockLoginWithBackup: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('../model/useBackupLogin', () => ({
  useBackupLogin: () => mockUseBackupLogin(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import { TwoFactorBackupEntry } from './TwoFactorBackupEntry';

function renderBackupEntry() {
  return render(
    <MemoryRouter>
      <TwoFactorBackupEntry />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseBackupLogin.mockReturnValue({
    loginWithBackup: mockLoginWithBackup,
    isLoading: false,
    apiError: null,
  });
});

describe('TwoFactorBackupEntry', () => {
  it('Label 과 Input 이 htmlFor / id 로 연결돼 있다 (a11y label association)', () => {
    renderBackupEntry();

    expect(screen.getByLabelText('아이디')).toBeInTheDocument();
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
    expect(screen.getByLabelText('백업코드')).toBeInTheDocument();
  });

  it('필수 누락 제출 시 알림 영역(role=alert)에 검증 메시지가 표시된다', async () => {
    renderBackupEntry();

    await userEvent.click(screen.getByRole('button', { name: '로그인' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(TWO_FACTOR_ERROR_MESSAGES.USERNAME_REQUIRED);
    expect(mockLoginWithBackup).not.toHaveBeenCalled();
  });

  it('apiError 가 있으면 error 메시지를 표시한다', () => {
    mockUseBackupLogin.mockReturnValue({
      loginWithBackup: mockLoginWithBackup,
      isLoading: false,
      apiError: { code: 'BACKUP_CODE_INVALID', message: '유효하지 않은 백업 코드입니다' },
    });

    renderBackupEntry();

    expect(screen.getByRole('alert')).toHaveTextContent('유효하지 않은 백업 코드입니다');
  });

  it('짧은(미완성) backupCode 제출 시 pattern 에러 메시지 표시 + login 호출 없음', async () => {
    renderBackupEntry();

    await userEvent.type(screen.getByLabelText('아이디'), 'testuser');
    await userEvent.type(screen.getByLabelText('비밀번호'), 'pass123');
    await userEvent.type(screen.getByLabelText('백업코드'), 'A1B');
    await userEvent.click(screen.getByRole('button', { name: '로그인' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(TWO_FACTOR_ERROR_MESSAGES.BACKUP_CODE_INVALID_PATTERN);
    expect(mockLoginWithBackup).not.toHaveBeenCalled();
  });

  it('isLoading 인 경우 제출 버튼이 disabled + "로그인 중..." 라벨', () => {
    mockUseBackupLogin.mockReturnValue({
      loginWithBackup: mockLoginWithBackup,
      isLoading: true,
      apiError: null,
    });

    renderBackupEntry();

    const button = screen.getByRole('button', { name: '로그인 중...' });
    expect(button).toBeDisabled();
  });

  it('"일반 로그인으로 돌아가기" 클릭 시 /login 으로 이동한다', async () => {
    renderBackupEntry();

    await userEvent.click(screen.getByRole('button', { name: '일반 로그인으로 돌아가기' }));

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});
