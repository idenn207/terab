import { cn } from '@/shared/lib';
import * as Headless from '@headlessui/react';
import React from 'react';

import { checkboxBoxStyles, type CheckboxVariantProps } from './checkboxStyles';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  tone?: CheckboxVariantProps['tone'];
  name?: string;
  value?: string;
  disabled?: boolean;
  describedById?: string;
  'aria-label'?: string;
  className?: string;
}

export function Checkbox({
  checked,
  onChange,
  tone,
  name,
  value,
  disabled,
  describedById,
  'aria-label': ariaLabel,
  className,
}: CheckboxProps) {
  return (
    <Headless.Checkbox
      checked={checked}
      onChange={onChange}
      name={name}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={describedById}
      // 48dp hit-area — visible box 는 20px 이지만 클릭 영역은 padding 으로 확장
      className={cn(
        'group inline-flex h-12 w-12 cursor-pointer items-center justify-center',
        'focus-visible:outline-none',
        disabled && 'cursor-not-allowed',
        className,
      )}
    >
      <span className={checkboxBoxStyles({ tone })}>
        <svg
          aria-hidden="true"
          className="h-3.5 w-3.5 text-accent-fg opacity-0 transition-opacity duration-fast group-data-checked:opacity-100"
          viewBox="0 0 14 14"
          fill="none"
        >
          <path d="M3 7l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Headless.Checkbox>
  );
}

interface CheckboxFieldProps {
  className?: string;
  children: React.ReactNode;
}

// CheckboxField — Checkbox + Label 콤보. catalyst 와 동일한 슬롯 패턴 (사용처 호환)
export function CheckboxField({ className, children }: CheckboxFieldProps) {
  return <div className={cn('flex items-center gap-3', className)}>{children}</div>;
}

export type { CheckboxProps, CheckboxFieldProps };
