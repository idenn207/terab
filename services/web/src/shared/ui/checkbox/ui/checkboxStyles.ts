import { cva, type VariantProps } from 'class-variance-authority';

// visible box — Material 18~20px
export const checkboxBoxStyles = cva(
  [
    'relative flex h-5 w-5 shrink-0 items-center justify-center rounded-sm',
    'border bg-surface-elevated',
    'transition-colors duration-fast ease-out',
    'group-data-checked:bg-accent group-data-checked:border-accent',
    'group-data-disabled:opacity-50',
    'group-data-focus:ring-2 group-data-focus:ring-accent group-data-focus:ring-offset-2 group-data-focus:ring-offset-surface',
  ],
  {
    variants: {
      tone: {
        neutral: 'border-border-strong group-data-hover:border-text-muted',
        danger:
          'border-danger group-data-checked:bg-danger group-data-checked:border-danger group-data-focus:ring-danger',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
);

export type CheckboxVariantProps = VariantProps<typeof checkboxBoxStyles>;
