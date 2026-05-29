import { cn } from '@/shared/lib';
import React from 'react';

import { inputStyles, type InputVariantProps } from './inputStyles';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  tone?: InputVariantProps['tone'];
  size?: InputVariantProps['size'];
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  // a11y — 에러/도움말 텍스트 id 연결 (외부에서 aria-describedby 와 겹치지 않게 별도 prop)
  describedById?: string;
  // catalyst Input 호환 — 입력값을 자동 변환 (CSS text-transform)
  transform?: 'uppercase' | 'lowercase';
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    tone,
    size,
    leadingIcon,
    trailingIcon,
    describedById,
    transform,
    disabled,
    'aria-invalid': ariaInvalidProp,
    'aria-describedby': ariaDescribedByProp,
    ...rest
  },
  ref,
) {
  const hasInvalid = tone === 'danger' || ariaInvalidProp === true || ariaInvalidProp === 'true';
  const hasLeading = leadingIcon != null;
  const hasTrailing = trailingIcon != null;
  const inputClasses = cn(
    inputStyles({
      tone: hasInvalid ? 'danger' : tone,
      size,
      hasLeading,
      hasTrailing,
    }),
    transform === 'uppercase' && 'uppercase',
    transform === 'lowercase' && 'lowercase',
    className,
  );

  const describedBy = [describedById, ariaDescribedByProp].filter(Boolean).join(' ') || undefined;

  return (
    <span
      data-slot="input-control"
      className={cn(
        'relative isolate block w-full rounded-md',
        'focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 focus-within:ring-offset-surface',
        hasInvalid && 'focus-within:ring-danger',
      )}
    >
      {hasLeading && (
        <span
          aria-hidden="true"
          data-slot="leading"
          className="text-text-muted pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3"
        >
          {leadingIcon}
        </span>
      )}
      <input
        {...rest}
        ref={ref}
        disabled={disabled}
        aria-invalid={hasInvalid || undefined}
        aria-describedby={describedBy}
        className={inputClasses}
      />
      {hasTrailing && (
        <span
          aria-hidden="true"
          data-slot="trailing"
          className="text-text-muted pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center pr-3"
        >
          {trailingIcon}
        </span>
      )}
    </span>
  );
});

export type { InputProps };
