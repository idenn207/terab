import { cn } from '@/shared/lib';
import * as Headless from '@headlessui/react';
import React from 'react';

import { radioDotStyles, type RadioVariantProps } from './radioStyles';

interface RadioGroupProps<T extends string> {
  value: T | null;
  onChange: (next: T) => void;
  label?: string;
  describedById?: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

function RadioGroupRoot<T extends string>({
  value,
  onChange,
  label,
  describedById,
  children,
  className,
  disabled,
}: RadioGroupProps<T>) {
  return (
    <Headless.RadioGroup
      value={value ?? undefined}
      onChange={onChange}
      aria-label={label}
      aria-describedby={describedById}
      disabled={disabled}
      className={cn('flex flex-col gap-3', className)}
    >
      {children}
    </Headless.RadioGroup>
  );
}

interface RadioProps {
  value: string;
  tone?: RadioVariantProps['tone'];
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}

function RadioItem({ value, tone, disabled, children, className }: RadioProps) {
  return (
    <Headless.Radio
      value={value}
      disabled={disabled}
      // 48dp hit-area
      className={cn(
        'group flex min-h-12 cursor-pointer items-center gap-3 focus-visible:outline-none',
        disabled && 'cursor-not-allowed',
        className,
      )}
    >
      <span className={radioDotStyles({ tone })}>
        <span className="h-2.5 w-2.5 rounded-pill bg-accent opacity-0 transition-opacity duration-fast group-data-checked:opacity-100" />
      </span>
      <span className="text-base text-text">{children}</span>
    </Headless.Radio>
  );
}

export const RadioGroup = RadioGroupRoot;
export const Radio = RadioItem;

export type { RadioGroupProps, RadioProps };
