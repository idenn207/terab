import { cn } from '@/shared/lib';
import React from 'react';

import type { ToastShowOptions } from './useToast';

interface ToastSurfaceProps extends ToastShowOptions {
  onDismiss: () => void;
}

// Material Snackbar anatomy — 단일 항목 시각 표현
export function Toast({ message, tone = 'neutral', action, onDismiss }: ToastSurfaceProps) {
  // danger 는 assertive — 사용자 즉시 인지 필요
  const ariaLive = tone === 'danger' ? 'assertive' : 'polite';
  return (
    <div
      role="status"
      aria-live={ariaLive}
      data-tone={tone}
      className={cn(
        'pointer-events-auto fixed bottom-4 left-1/2 z-50 -translate-x-1/2',
        'flex max-w-md items-center gap-3 rounded-md px-4 py-3 shadow-lg',
        'border bg-surface-elevated border-border-strong',
        tone === 'success' && 'border-success text-success',
        tone === 'danger' && 'border-danger text-danger',
        tone === 'neutral' && 'text-text',
      )}
    >
      <span className="text-sm">{message}</span>
      {action && (
        <button
          type="button"
          onClick={() => {
            action.onClick();
            onDismiss();
          }}
          className="text-accent text-sm font-semibold underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
