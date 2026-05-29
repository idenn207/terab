import { cn } from '@/shared/lib';
import React, { cloneElement, useCallback, useEffect, useId, useRef, useState } from 'react';

import { tooltipContentClass } from './tooltipStyles';

interface TooltipProps {
  content: React.ReactNode;
  // hover 진입 지연 — focus 진입은 즉시 (a11y)
  delay?: number;
  // placement — 단순 above/below. 기본 above
  placement?: 'top' | 'bottom';
  children: React.ReactElement;
}

const DEFAULT_DELAY = 500;

// touch 환경 감지 — mobile 에서는 tooltip 표시 안 함
function isTouchEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

export function Tooltip({ content, delay = DEFAULT_DELAY, placement = 'top', children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<number | null>(null);
  const tooltipId = useId();

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const show = useCallback(
    (immediate: boolean) => {
      if (isTouchEnvironment()) return;
      clearTimer();
      if (immediate) {
        setOpen(true);
      } else {
        timerRef.current = window.setTimeout(() => setOpen(true), delay);
      }
    },
    [clearTimer, delay],
  );

  const hide = useCallback(() => {
    clearTimer();
    setOpen(false);
  }, [clearTimer]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, hide]);

  // trigger 자식 — 이벤트와 aria-describedby wiring
  const child = children as React.ReactElement<{
    onMouseEnter?: React.MouseEventHandler;
    onMouseLeave?: React.MouseEventHandler;
    onFocus?: React.FocusEventHandler;
    onBlur?: React.FocusEventHandler;
    'aria-describedby'?: string;
  }>;
  const triggerProps = {
    onMouseEnter: (event: React.MouseEvent) => {
      child.props.onMouseEnter?.(event);
      show(false);
    },
    onMouseLeave: (event: React.MouseEvent) => {
      child.props.onMouseLeave?.(event);
      hide();
    },
    onFocus: (event: React.FocusEvent) => {
      child.props.onFocus?.(event);
      show(true);
    },
    onBlur: (event: React.FocusEvent) => {
      child.props.onBlur?.(event);
      hide();
    },
    'aria-describedby': open ? tooltipId : child.props['aria-describedby'],
  };

  return (
    <span className="relative inline-flex">
      {cloneElement(child, triggerProps)}
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(
            tooltipContentClass,
            placement === 'top' ? 'bottom-full mb-2 left-1/2 -translate-x-1/2' : 'top-full mt-2 left-1/2 -translate-x-1/2',
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}

export type { TooltipProps };
