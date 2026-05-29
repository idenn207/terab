import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from './ToastProvider';
import { useToast } from './useToast';

function Trigger({ messages }: { messages: Parameters<ReturnType<typeof useToast>['show']>[0][] }) {
  const { show } = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        messages.forEach((m) => show(m));
      }}
    >
      fire
    </button>
  );
}

describe('Toast — 기본 렌더링 + a11y', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('show() 호출 시 role="status" 토스트 렌더', () => {
    render(
      <ToastProvider>
        <Trigger messages={[{ message: '저장됨', tone: 'success' }]} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'fire' }));
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByRole('status')).toHaveTextContent('저장됨');
  });

  it('danger tone 은 aria-live="assertive"', () => {
    render(
      <ToastProvider>
        <Trigger messages={[{ message: '에러', tone: 'danger' }]} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'fire' }));
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'assertive');
  });

  it('neutral/success tone 은 aria-live="polite"', () => {
    render(
      <ToastProvider>
        <Trigger messages={[{ message: '저장됨', tone: 'success' }]} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'fire' }));
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});

describe('Toast — duration 자동 dismiss', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('short (4000ms) 후 자동 dismiss', () => {
    render(
      <ToastProvider>
        <Trigger messages={[{ message: '저장됨', duration: 'short' }]} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'fire' }));
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.queryByRole('status')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4001);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('long (10000ms) 후 자동 dismiss', () => {
    render(
      <ToastProvider>
        <Trigger messages={[{ message: '긴 메시지', duration: 'long' }]} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'fire' }));
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.queryByRole('status')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4001);
    });
    expect(screen.queryByRole('status')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(6001);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('Toast — queue (동시 표시 1개, 나머지 대기)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('show 3회 호출 시 첫 메시지만 먼저 표시', () => {
    render(
      <ToastProvider>
        <Trigger
          messages={[
            { message: '첫번째' },
            { message: '두번째' },
            { message: '세번째' },
          ]}
        />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'fire' }));
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByRole('status')).toHaveTextContent('첫번째');
  });

  it('첫 토스트 dismiss 후 두 번째 자동 등장', () => {
    render(
      <ToastProvider>
        <Trigger
          messages={[
            { message: '첫번째', duration: 'short' },
            { message: '두번째', duration: 'short' },
          ]}
        />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'fire' }));
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByRole('status')).toHaveTextContent('첫번째');
    act(() => {
      vi.advanceTimersByTime(4001);
    });
    expect(screen.getByRole('status')).toHaveTextContent('두번째');
  });
});

describe('Toast — action button', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('action 제공 시 버튼 렌더 + 클릭 시 onClick + dismiss', () => {
    const handle = vi.fn();
    render(
      <ToastProvider>
        <Trigger
          messages={[
            {
              message: '저장됨',
              action: { label: '되돌리기', onClick: handle },
            },
          ]}
        />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'fire' }));
    act(() => {
      vi.advanceTimersByTime(50);
    });
    const undoButton = screen.getByRole('button', { name: '되돌리기' });
    fireEvent.click(undoButton);
    expect(handle).toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('useToast — provider 밖에서 throw', () => {
  it('ToastProvider 없이 사용 시 throw', () => {
    function Bad() {
      useToast();
      return null;
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Bad />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
