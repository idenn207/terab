import { cva, type VariantProps } from 'class-variance-authority';

export const radioDotStyles = cva(
  [
    'relative flex h-5 w-5 shrink-0 items-center justify-center rounded-pill',
    'border bg-surface-elevated',
    'transition-colors duration-fast ease-out',
    'group-data-checked:border-accent',
    'group-data-disabled:opacity-50',
    'group-data-focus:ring-2 group-data-focus:ring-accent group-data-focus:ring-offset-2 group-data-focus:ring-offset-surface',
  ],
  {
    variants: {
      tone: {
        neutral: 'border-border-strong group-data-hover:border-text-muted',
        danger: 'border-danger group-data-checked:border-danger group-data-focus:ring-danger',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type RadioVariantProps = VariantProps<typeof radioDotStyles>;
