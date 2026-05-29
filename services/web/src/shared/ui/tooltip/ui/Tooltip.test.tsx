import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Tooltip } from './Tooltip';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Tooltip — hover trigger (500ms delay)', () => {
  it('hover 진입 직후 0ms 에서는 미표시', () => {
    render(
      <Tooltip content="도움말">
        <button type="button">호버</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByRole('button'));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('500ms 경과 후 표시', () => {
    render(
      <Tooltip content="도움말">
        <button type="button">호버</button>
      </Tooltip>,
    );
    fireEvent.mouseEnter(screen.getByRole('button'));
    act(() => {
      vi.advanceTimersByTime(501);
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('도움말');
  });

  it('mouseLeave 시 즉시 dismiss', () => {
    render(
      <Tooltip content="도움말">
        <button type="button">호버</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button');
    fireEvent.mouseEnter(trigger);
    act(() => {
      vi.advanceTimersByTime(501);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('Tooltip — focus trigger (즉시)', () => {
  it('focus 진입 시 즉시 표시 (delay 무시)', () => {
    render(
      <Tooltip content="도움말">
        <button type="button">호버</button>
      </Tooltip>,
    );
    fireEvent.focus(screen.getByRole('button'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('도움말');
  });

  it('blur 시 dismiss', () => {
    render(
      <Tooltip content="도움말">
        <button type="button">호버</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button');
    fireEvent.focus(trigger);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.blur(trigger);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('Tooltip — a11y (aria-describedby wiring)', () => {
  it('open 시 trigger 에 aria-describedby 자동 부착', () => {
    render(
      <Tooltip content="도움말">
        <button type="button">호버</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button');
    fireEvent.focus(trigger);
    const describedBy = trigger.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy ?? '')).toHaveAttribute('role', 'tooltip');
  });

  it('Esc 키로 dismiss', () => {
    render(
      <Tooltip content="도움말">
        <button type="button">호버</button>
      </Tooltip>,
    );
    fireEvent.focus(screen.getByRole('button'));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
