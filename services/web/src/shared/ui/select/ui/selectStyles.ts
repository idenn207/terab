import { cva, type VariantProps } from 'class-variance-authority';

export const selectTriggerStyles = cva(
  [
    'group inline-flex w-full items-center justify-between gap-2',
    'rounded-md border bg-surface-elevated text-text',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
    'data-disabled:opacity-50 data-disabled:pointer-events-none',
    'data-open:ring-2 data-open:ring-accent',
    'transition-colors duration-fast ease-out',
  ],
  {
    variants: {
      size: {
        sm: 'min-h-9 px-3 text-sm',
        md: 'min-h-12 px-4 text-base',
      },
      tone: {
        neutral: 'border-border hover:border-border-strong',
        danger: 'border-danger',
      },
    },
    defaultVariants: { size: 'md', tone: 'neutral' },
  },
);

export type SelectVariantProps = VariantProps<typeof selectTriggerStyles>;
