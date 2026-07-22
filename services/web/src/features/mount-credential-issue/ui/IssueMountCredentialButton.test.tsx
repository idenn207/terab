import { renderWithProviders } from '@/__tests__/wrappers';
import type { IssuedMountCredential } from '@/entities';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IssueMountCredentialButton } from './IssueMountCredentialButton';

interface IssueHookValue {
  issue: (driveId?: string) => Promise<unknown>;
  issued: IssuedMountCredential | null;
  clearIssued: () => void;
  isIssuing: boolean;
  error: Error | null;
}

const { mockIssue, mockClearIssued, mockUseIssue } = vi.hoisted(() => {
  const issue = vi.fn();
  const clearIssued = vi.fn();
  return {
    mockIssue: issue,
    mockClearIssued: clearIssued,
    mockUseIssue: vi.fn(),
  };
});

vi.mock('../model/useIssueMountCredential', () => ({
  useIssueMountCredential: mockUseIssue,
}));

const SAMPLE_IQN = 'iqn.2026-05.com.terab:drive-1';
const sampleIssued = {
  id: 'cred-1',
  driveId: 'drive-1',
  protocol: 'iscsi' as const,
  iqn: SAMPLE_IQN,
  password: 'abc-XYZ_pwd-123',
  script: '# powershell mount script',
  osUsername: 'terab-cred-1',
  portalHost: '192.168.0.5',
  portalPort: 3260,
  createdAt: '2026-05-30T00:00:00.000Z',
} satisfies IssuedMountCredential;

function buildHookValue(overrides: Partial<IssueHookValue> = {}): IssueHookValue {
  return {
    issue: mockIssue as IssueHookValue['issue'],
    issued: null,
    clearIssued: mockClearIssued,
    isIssuing: false,
    error: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseIssue.mockReturnValue(buildHookValue());
});

describe('IssueMountCredentialButton', () => {
  it('"마운트 발급" 버튼 클릭 시 driveId 와 함께 issue 가 호출된다', () => {
    renderWithProviders(<IssueMountCredentialButton driveId="drive-1" />);

    fireEvent.click(screen.getByRole('button', { name: '마운트 자격증명 발급' }));

    expect(mockIssue).toHaveBeenCalledWith('drive-1');
  });

  it('issued 가 채워지면 다이얼로그 + 자격증명 + 경고 메시지를 노출한다', () => {
    mockUseIssue.mockReturnValueOnce(buildHookValue({ issued: sampleIssued }));

    renderWithProviders(<IssueMountCredentialButton />);

    expect(screen.getByText('마운트 자격증명이 발급되었습니다')).toBeInTheDocument();
    expect(screen.getByText(/비밀번호는 지금 한 번만 표시됩니다/)).toBeInTheDocument();
    expect(screen.getByText(sampleIssued.osUsername)).toBeInTheDocument();
    expect(screen.getByText(SAMPLE_IQN)).toBeInTheDocument();
  });

  it('비밀번호는 기본 마스킹, "보기" 토글 시 평문 노출 + aria-pressed 갱신', () => {
    mockUseIssue.mockReturnValue(buildHookValue({ issued: sampleIssued }));

    renderWithProviders(<IssueMountCredentialButton />);

    expect(screen.queryByText(sampleIssued.password)).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: '비밀번호 보기' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(toggle);

    expect(screen.getByText(sampleIssued.password)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '비밀번호 숨기기' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('"Windows .ps1 다운로드" 클릭 시 anchor click + Blob URL 생성/해제 가 수행된다', () => {
    mockUseIssue.mockReturnValueOnce(buildHookValue({ issued: sampleIssued }));

    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });

    const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderWithProviders(<IssueMountCredentialButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Windows .ps1 다운로드' }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    anchorClickSpy.mockRestore();
  });

  it('"닫기" 클릭 시 clearIssued 가 호출된다', () => {
    mockUseIssue.mockReturnValueOnce(buildHookValue({ issued: sampleIssued }));

    renderWithProviders(<IssueMountCredentialButton />);

    fireEvent.click(screen.getByRole('button', { name: /닫기/ }));

    expect(mockClearIssued).toHaveBeenCalled();
  });

  it('error 가 있으면 role="alert" 로 메시지를 노출한다', () => {
    mockUseIssue.mockReturnValueOnce(buildHookValue({ error: new Error('STORAGE_AGENT_UNAVAILABLE') }));

    renderWithProviders(<IssueMountCredentialButton />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('isIssuing 동안 버튼은 loading 상태 (aria-busy)', () => {
    mockUseIssue.mockReturnValueOnce(buildHookValue({ isIssuing: true }));

    renderWithProviders(<IssueMountCredentialButton />);

    const btn = screen.getByRole('button', { name: '마운트 자격증명 발급' });
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('컴포넌트 unmount 시 clearIssued cleanup 이 호출된다', async () => {
    const { unmount } = renderWithProviders(<IssueMountCredentialButton />);
    unmount();
    await waitFor(() => expect(mockClearIssued).toHaveBeenCalled());
  });
});
