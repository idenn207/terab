import React, { useCallback, useEffect, useState } from 'react';

import { Toast } from './Toast';
import { ToastContext, type ToastShowOptions } from './useToast';

interface ToastInstance extends ToastShowOptions {
  id: number;
}

interface ToastProviderProps {
  children: React.ReactNode;
}

const DURATION_MS = { short: 4000, long: 10000 } as const;

export function ToastProvider({ children }: ToastProviderProps) {
  const [queue, setQueue] = useState<ToastInstance[]>([]);
  const [current, setCurrent] = useState<ToastInstance | null>(null);
  const [counter, setCounter] = useState(0);

  const show = useCallback((opts: ToastShowOptions) => {
    setCounter((c) => c + 1);
    setQueue((q) => [...q, { ...opts, id: Date.now() + Math.random() }]);
  }, []);

  const dismiss = useCallback(() => {
    setCurrent(null);
  }, []);

  // current 가 비면 queue 앞부분을 끌어온다
  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
  }, [current, queue]);

  // 자동 dismiss — duration 후
  useEffect(() => {
    if (!current) return;
    const ms = DURATION_MS[current.duration ?? 'short'];
    const timer = setTimeout(() => setCurrent(null), ms);
    return () => clearTimeout(timer);
  }, [current]);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      {current && (
        <Toast
          key={current.id}
          message={current.message}
          tone={current.tone}
          action={current.action}
          duration={current.duration}
          onDismiss={dismiss}
        />
      )}
      {/* test helper — show 호출 횟수를 외부에서 관찰 가능하게 데이터 attribute 노출 */}
      <span data-testid="toast-counter" data-count={counter} className="sr-only" aria-hidden="true" />
    </ToastContext.Provider>
  );
}
