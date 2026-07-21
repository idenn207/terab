import { renderWithProviders } from '@/__tests__/wrappers';
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { DriveMountPanel } from './DriveMountPanel';

const { mockGetMyDrive, mockGetList } = vi.hoisted(() => ({
  mockGetMyDrive: vi.fn(),
  mockGetList: vi.fn(),
}));

vi.mock('@shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@shared/api')>();
  return {
    ...actual,
    driveControllerGetMyDriveOptions: () => ({
      queryKey: [{ _id: 'driveControllerGetMyDrive' }],
      queryFn: mockGetMyDrive,
    }),
    mountCredentialControllerListOptions: () => ({
      queryKey: [{ _id: 'mountCredentialControllerList' }],
      queryFn: mockGetList,
    }),
  };
});

vi.mock('@/features', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features')>();
  return {
    ...actual,
    IssueMountCredentialButton: ({ driveId }: { driveId?: string }) => (
      <button type="button" data-testid="issue-btn" data-drive-id={driveId ?? ''}>
        마운트 발급
      </button>
    ),
    RevokeMountCredentialButton: ({ credentialId }: { credentialId: string }) => (
      <button type="button" data-testid={`revoke-btn-${credentialId}`}>
        회수
      </button>
    ),
  };
});

const sampleDrive = {
  id: 'drive-1',
  kind: 'PRIVATE' as const,
  name: '내 드라이브',
  mountPath: '/volume1/drives/drive-1',
  createdAt: '2026-05-30T00:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetMyDrive.mockResolvedValue(sampleDrive);
});

describe('DriveMountPanel', () => {
  it('자격증명 0건 — 빈 상태 안내 + 발급 버튼만 노출', async () => {
    mockGetList.mockResolvedValue([]);

    renderWithProviders(<DriveMountPanel />);

    await waitFor(() => expect(screen.getByText(/활성 마운트 자격증명이 없습니다/)).toBeInTheDocument());
    expect(screen.getByTestId('issue-btn')).toBeInTheDocument();
    expect(screen.queryByText('회수')).not.toBeInTheDocument();
  });

  it('자격증명 1건 — 각 자격증명 카드 + 회수 버튼 노출', async () => {
    mockGetList.mockResolvedValue([
      {
        id: 'cred-1',
        driveId: 'drive-1',
        protocol: 'iscsi',
        iqn: 'iqn.2026-05.com.terab:drive-1',
        osUsername: 'terab-cred-1',
        portalHost: '192.168.0.5',
        portalPort: 3260,
        createdAt: '2026-05-30T00:00:00.000Z',
      },
    ]);

    renderWithProviders(<DriveMountPanel />);

    await waitFor(() => expect(screen.getByTestId('revoke-btn-cred-1')).toBeInTheDocument());
    expect(screen.getByText('terab-cred-1')).toBeInTheDocument();
    expect(screen.getByText('iqn.2026-05.com.terab:drive-1')).toBeInTheDocument();
    expect(screen.getByText('192.168.0.5:3260')).toBeInTheDocument();
  });

  it('자격증명 3건 — 모든 row 가 회수 버튼을 가진다', async () => {
    const credentials = [1, 2, 3].map((n) => ({
      id: `cred-${n}`,
      driveId: 'drive-1',
      protocol: 'iscsi',
      iqn: `iqn.2026-05.com.terab:drive-${n}`,
      osUsername: `terab-cred-${n}`,
      portalHost: '192.168.0.5',
      portalPort: 3260,
      createdAt: '2026-05-30T00:00:00.000Z',
    }));
    mockGetList.mockResolvedValue(credentials);

    renderWithProviders(<DriveMountPanel />);

    await waitFor(() => expect(screen.getByTestId('revoke-btn-cred-1')).toBeInTheDocument());
    expect(screen.getByTestId('revoke-btn-cred-2')).toBeInTheDocument();
    expect(screen.getByTestId('revoke-btn-cred-3')).toBeInTheDocument();
  });

  it('drive 가 로드되면 IssueMountCredentialButton 에 driveId 가 props 로 전달된다', async () => {
    mockGetList.mockResolvedValue([]);

    renderWithProviders(<DriveMountPanel />);

    await waitFor(() => expect(screen.getByTestId('issue-btn')).toHaveAttribute('data-drive-id', 'drive-1'));
  });

  it('axe-core a11y violations 0건 — 자격증명 1건 상태', async () => {
    mockGetList.mockResolvedValue([
      {
        id: 'cred-1',
        driveId: 'drive-1',
        protocol: 'iscsi',
        iqn: 'iqn.2026-05.com.terab:drive-1',
        osUsername: 'terab-cred-1',
        portalHost: '192.168.0.5',
        portalPort: 3260,
        createdAt: '2026-05-30T00:00:00.000Z',
      },
    ]);

    const { container } = renderWithProviders(<DriveMountPanel />);
    await waitFor(() => expect(screen.getByTestId('revoke-btn-cred-1')).toBeInTheDocument());

    expect(await axe(container)).toHaveNoViolations();
  });
});
