import { cn } from '@/shared/lib';
import * as Headless from '@headlessui/react';
import React from 'react';

import { modalPanelStyles, type ModalPanelVariantProps } from './modalStyles';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  size?: ModalPanelVariantProps['size'];
  // backdrop tap / Esc 로 닫기 허용 — 진짜 결정 모달은 false 로
  dismissible?: boolean;
  className?: string;
  children: React.ReactNode;
}

function ModalRoot({ open, onClose, size, dismissible = true, className, children }: ModalProps) {
  // dismissible=false → Headless 가 onClose 를 호출하지 않게 우회
  const handleClose = (value: boolean) => {
    if (!dismissible) return;
    if (!value) onClose();
  };

  return (
    <Headless.Dialog open={open} onClose={handleClose} transition>
      <Headless.DialogBackdrop
        transition
        className={cn(
          'fixed inset-0 flex w-screen justify-center overflow-y-auto bg-text/40',
          'px-2 py-2 sm:px-6 sm:py-8 lg:px-8 lg:py-16',
          'transition duration-fast data-closed:opacity-0 data-enter:ease-out data-leave:ease-in',
        )}
      />
      <div className="fixed inset-0 w-screen overflow-y-auto pt-6 sm:pt-0">
        <div className="grid min-h-full grid-rows-[1fr_auto] justify-items-center sm:grid-rows-[1fr_auto_3fr] sm:p-4">
          <Headless.DialogPanel transition className={cn(modalPanelStyles({ size }), className)}>
            {children}
          </Headless.DialogPanel>
        </div>
      </div>
    </Headless.Dialog>
  );
}

function ModalHeader({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Headless.DialogTitle as="h2" className={cn('text-lg font-semibold text-text', className)}>
      {children}
    </Headless.DialogTitle>
  );
}

function ModalBody({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-6 text-text-muted', className)}>{children}</div>;
}

function ModalFooter({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'mt-8 flex flex-col-reverse items-stretch gap-3',
        'sm:flex-row sm:items-center sm:justify-end',
        className,
      )}
    >
      {children}
    </div>
  );
}

export const Modal = Object.assign(ModalRoot, {
  Header: ModalHeader,
  Body: ModalBody,
  Footer: ModalFooter,
});

export type { ModalProps };
