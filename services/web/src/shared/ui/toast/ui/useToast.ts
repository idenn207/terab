import { createContext, useContext } from 'react';

export interface ToastShowOptions {
  message: string;
  tone?: 'success' | 'danger' | 'neutral';
  action?: { label: string; onClick: () => void };
  duration?: 'short' | 'long';
}

export interface ToastContextValue {
  show: (opts: ToastShowOptions) => void;
  dismiss: () => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
