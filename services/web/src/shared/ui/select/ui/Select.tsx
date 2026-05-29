import { cn } from '@/shared/lib';
import * as Headless from '@headlessui/react';
import React from 'react';

import { selectTriggerStyles, type SelectVariantProps } from './selectStyles';

interface SelectProps<T extends string> {
  value: T | null;
  onChange: (next: T) => void;
  label?: string;
  size?: SelectVariantProps['size'];
  tone?: SelectVariantProps['tone'];
  disabled?: boolean;
  placeholder?: string;
  children: React.ReactNode;
  className?: string;
  // 표시용 컨텐츠 — value 에서 라벨을 역추적하기 어려운 경우 명시 전달
  renderSelected?: (value: T | null) => React.ReactNode;
}

function SelectRoot<T extends string>({
  value,
  onChange,
  label,
  size,
  tone,
  disabled,
  placeholder,
  className,
  children,
  renderSelected,
}: SelectProps<T>) {
  return (
    <Headless.Listbox value={value ?? undefined} onChange={onChange} disabled={disabled}>
      <div className={cn('relative', className)}>
        <Headless.ListboxButton aria-label={label} className={selectTriggerStyles({ size, tone })}>
          <span className="truncate text-left">{renderSelected ? renderSelected(value) : (value ?? placeholder ?? '선택')}</span>
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-text-muted">
            <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </Headless.ListboxButton>
        <Headless.ListboxOptions
          anchor="bottom start"
          className={cn(
            'z-50 mt-1 w-(--button-width) rounded-md border border-border bg-surface-elevated p-1 shadow-lg',
            'focus:outline-none',
          )}
        >
          {children}
        </Headless.ListboxOptions>
      </div>
    </Headless.Listbox>
  );
}

interface SelectOptionProps {
  value: string;
  disabled?: boolean;
  children: React.ReactNode;
}

function SelectOption({ value, disabled, children }: SelectOptionProps) {
  return (
    <Headless.ListboxOption
      value={value}
      disabled={disabled}
      className={cn(
        'flex min-h-12 cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-base text-text',
        'data-focus:bg-accent-soft data-selected:bg-accent-soft data-selected:text-accent',
        'data-disabled:opacity-50 data-disabled:cursor-not-allowed',
      )}
    >
      <span className="flex-1 truncate">{children}</span>
      <span
        aria-hidden="true"
        className="hidden h-4 w-4 text-accent data-selected:block group-data-selected:block"
      >
        ✓
      </span>
    </Headless.ListboxOption>
  );
}

export const Select = Object.assign(SelectRoot, { Option: SelectOption });

export type { SelectProps, SelectOptionProps };
