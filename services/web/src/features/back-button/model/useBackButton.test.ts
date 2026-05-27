import { act, renderHook } from '@testing-library/react';
import { useBackButton } from '../model/useBackButton';

const { mockAddListener, mockExitApp, mockRemove, mockNavigate, matchesRef } = vi.hoisted(() => ({
  mockAddListener: vi.fn(),
  mockExitApp: vi.fn(),
  mockRemove: vi.fn(),
  mockNavigate: vi.fn(),
  matchesRef: { current: [] as Array<{ handle?: { isRootDestination?: boolean } }> },
}));

let capturedBackButtonCallback: (() => void) | null = null;

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn().mockReturnValue(true) },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: mockAddListener,
    exitApp: mockExitApp,
  },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useMatches: () => matchesRef.current,
  };
});

const setRootDestination = () => {
  matchesRef.current = [{ handle: { isRootDestination: true } }];
};

const setNonRootDestination = () => {
  matchesRef.current = [{ handle: undefined }];
};

beforeEach(async () => {
  const { Capacitor } = await import('@capacitor/core');
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
  matchesRef.current = [];
  capturedBackButtonCallback = null;
  mockAddListener.mockImplementation((event, cb) => {
    if (event === 'backButton') capturedBackButtonCallback = cb;
    return Promise.resolve({ remove: mockRemove });
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('useBackButton', () => {
  it('root destination 에서 첫 back 시 pendingExit 토스트가 노출되고 exitApp 은 호출되지 않는다', async () => {
    setRootDestination();
    const { result } = renderHook(() => useBackButton());

    await act(async () => {
      await Promise.resolve();
    });
    expect(capturedBackButtonCallback).not.toBeNull();

    act(() => {
      capturedBackButtonCallback!();
    });

    expect(result.current.pendingExit).toBe(true);
    expect(mockExitApp).not.toHaveBeenCalled();
  });

  it('root destination 에서 2초 안에 두 번 back 누르면 exitApp 이 호출된다', async () => {
    setRootDestination();
    renderHook(() => useBackButton());

    await act(async () => {
      await Promise.resolve();
    });
    expect(capturedBackButtonCallback).not.toBeNull();

    act(() => {
      capturedBackButtonCallback!();
    });
    act(() => {
      vi.advanceTimersByTime(500);
      capturedBackButtonCallback!();
    });

    expect(mockExitApp).toHaveBeenCalledTimes(1);
  });

  it('root destination 에서 첫 back 후 2초 경과 + 두 번째 back 은 토스트만 다시 노출하고 exit 하지 않는다', async () => {
    setRootDestination();
    const { result } = renderHook(() => useBackButton());

    await act(async () => {
      await Promise.resolve();
    });
    expect(capturedBackButtonCallback).not.toBeNull();

    act(() => {
      capturedBackButtonCallback!();
    });
    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(result.current.pendingExit).toBe(false);

    act(() => {
      capturedBackButtonCallback!();
    });

    expect(result.current.pendingExit).toBe(true);
    expect(mockExitApp).not.toHaveBeenCalled();
  });

  it('non-root destination 에서 back 누르면 navigate(-1) 가 호출되고 exitApp 은 호출되지 않는다', async () => {
    setNonRootDestination();
    renderHook(() => useBackButton());

    await act(async () => {
      await Promise.resolve();
    });
    expect(capturedBackButtonCallback).not.toBeNull();

    act(() => {
      capturedBackButtonCallback!();
    });

    expect(mockNavigate).toHaveBeenCalledWith(-1);
    expect(mockExitApp).not.toHaveBeenCalled();
  });

  it('비네이티브 플랫폼에서는 backButton 리스너를 등록하지 않는다', async () => {
    const { Capacitor } = await import('@capacitor/core');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    renderHook(() => useBackButton());

    expect(mockAddListener).not.toHaveBeenCalled();
  });
});
