import { renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useDeepLink } from '../model/useDeepLink';

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn().mockReturnValue(true) },
}));

let capturedCallback: ((event: { url: string }) => void) | null = null;
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn().mockImplementation((_event, cb) => {
      capturedCallback = cb;
      return Promise.resolve({ remove: vi.fn() });
    }),
  },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('useDeepLink', () => {
  afterEach(() => {
    capturedCallback = null;
    vi.clearAllMocks();
  });

  it('appUrlOpen 이벤트 발생 시 URL의 pathname으로 navigate를 호출한다', async () => {
    renderHook(() => useDeepLink(), { wrapper: MemoryRouter });

    await waitFor(() => capturedCallback !== null);
    capturedCallback!({ url: 'https://drive.skypark207.com/auth/2fa/abc123' });

    expect(mockNavigate).toHaveBeenCalledWith('/auth/2fa/abc123');
  });

  it('초대 링크 딥링크도 pathname으로 navigate를 호출한다', async () => {
    renderHook(() => useDeepLink(), { wrapper: MemoryRouter });

    await waitFor(() => capturedCallback !== null);
    capturedCallback!({ url: 'https://drive.skypark207.com/invite/token-xyz' });

    expect(mockNavigate).toHaveBeenCalledWith('/invite/token-xyz');
  });

  it('비네이티브 플랫폼에서는 리스너를 등록하지 않는다', async () => {
    const { Capacitor } = await import('@capacitor/core');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    const { App } = await import('@capacitor/app');

    renderHook(() => useDeepLink(), { wrapper: MemoryRouter });

    expect(App.addListener).not.toHaveBeenCalled();
  });
});
