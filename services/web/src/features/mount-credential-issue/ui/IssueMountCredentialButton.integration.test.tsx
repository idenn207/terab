import { renderWithProviders } from '@/__tests__/wrappers';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IssueMountCredentialButton } from './IssueMountCredentialButton';

// 훅 전체가 아니라 api 경계만 mock — model↔ui 계약(effect 의존성, cleanup 시점)을 실제로 검증한다.
// 훅을 mock 하면 clearIssued 가 안정적인 no-op 이 되어 렌더 사이클 결함이 구조적으로 숨는다.
const { mockMutateAsync, mockReset } = vi.hoisted(() => ({
  mockMutateAsync: vi.fn(),
  mockReset: vi.fn(),
}));

vi.mock('../api/mutation', () => ({
  useIssueMountCredentialMutation: () => ({
    mutateAsync: mockMutateAsync,
    reset: mockReset,
    isPending: false,
    error: null,
  }),
}));

const issuedPayload = {
  id: 'cred-1',
  driveId: 'drive-1',
  protocol: 'iscsi',
  iqn: 'iqn.2026-05.com.terab:drive-1',
  password: 'abc-XYZ_pwd-123',
  script: '# powershell mount script',
  osUsername: 'terab-cred-1',
  portalHost: '192.168.0.5',
  portalPort: 3260,
  createdAt: '2026-05-30T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockMutateAsync.mockResolvedValue(issuedPayload);
});

function clickIssue() {
  fireEvent.click(screen.getByRole('button', { name: '마운트 자격증명 발급' }));
}

describe('IssueMountCredentialButton — 실제 model 훅 연동', () => {
  it('발급 성공 후 1회용 password 다이얼로그가 닫히지 않고 유지된다', async () => {
    renderWithProviders(<IssueMountCredentialButton driveId="drive-1" />);
    clickIssue();

    await waitFor(() =>
      expect(screen.getByText('마운트 자격증명이 발급되었습니다')).toBeInTheDocument(),
    );

    // 후속 렌더에서 cleanup 이 재실행돼 다이얼로그가 사라지지 않아야 한다
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 보기' }));
    expect(screen.getByText(issuedPayload.password)).toBeInTheDocument();
  });

  it('다이얼로그를 닫으면 mutation cache 도 reset 되어 password 가 잔존하지 않는다', async () => {
    renderWithProviders(<IssueMountCredentialButton driveId="drive-1" />);
    clickIssue();

    await waitFor(() =>
      expect(screen.getByText('마운트 자격증명이 발급되었습니다')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: '닫기 — 다시 표시되지 않습니다' }));

    await waitFor(() =>
      expect(screen.queryByText('마운트 자격증명이 발급되었습니다')).not.toBeInTheDocument(),
    );
    expect(mockReset).toHaveBeenCalled();
  });

  it('발급이 진행 중이면 연속 클릭이 중복 요청을 만들지 않는다', async () => {
    let resolveIssue: ((value: unknown) => void) | undefined;
    mockMutateAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveIssue = resolve;
        }),
    );

    renderWithProviders(<IssueMountCredentialButton driveId="drive-1" />);
    clickIssue();
    clickIssue();
    clickIssue();

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);

    resolveIssue?.(issuedPayload);
    await waitFor(() =>
      expect(screen.getByText('마운트 자격증명이 발급되었습니다')).toBeInTheDocument(),
    );
  });

  it('unmount 시 password 가 정리된다', async () => {
    const { unmount } = renderWithProviders(<IssueMountCredentialButton driveId="drive-1" />);
    clickIssue();

    await waitFor(() =>
      expect(screen.getByText('마운트 자격증명이 발급되었습니다')).toBeInTheDocument(),
    );

    unmount();
    expect(mockReset).toHaveBeenCalled();
  });
});
