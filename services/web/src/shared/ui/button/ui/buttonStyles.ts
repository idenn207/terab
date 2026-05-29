import { cva, type VariantProps } from 'class-variance-authority';

export const buttonStyles = cva(
  [
    'relative inline-flex items-center justify-center gap-x-2 select-none',
    'rounded-md font-semibold whitespace-nowrap',
    'transition-colors duration-fast ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
    'disabled:opacity-50 disabled:pointer-events-none',
    'data-disabled:opacity-50 data-disabled:pointer-events-none',
  ],
  {
    variants: {
      variant: {
        filled: '',
        tonal: '',
        outlined: 'border bg-transparent',
        text: 'border border-transparent bg-transparent',
      },
      tone: {
        accent: '',
        danger: '',
        neutral: '',
      },
      size: {
        sm: 'min-h-9 min-w-9 px-3 text-sm',
        md: 'min-h-12 min-w-12 px-4 text-base',
      },
    },
    compoundVariants: [
      // filled — Material filled tone
      { variant: 'filled', tone: 'accent', class: 'bg-accent text-accent-fg hover:bg-accent-hover data-hover:bg-accent-hover' },
      { variant: 'filled', tone: 'danger', class: 'bg-danger text-accent-fg hover:opacity-90 data-hover:opacity-90' },
      { variant: 'filled', tone: 'neutral', class: 'bg-surface-elevated text-text border border-border hover:bg-surface-muted data-hover:bg-surface-muted' },
      // tonal — Material tonal (soft 배경)
      { variant: 'tonal', tone: 'accent', class: 'bg-accent-soft text-accent hover:opacity-90 data-hover:opacity-90' },
      { variant: 'tonal', tone: 'danger', class: 'bg-danger-soft text-danger hover:opacity-90 data-hover:opacity-90' },
      { variant: 'tonal', tone: 'neutral', class: 'bg-surface-muted text-text hover:bg-surface-elevated data-hover:bg-surface-elevated' },
      // outlined
      { variant: 'outlined', tone: 'accent', class: 'border-accent text-accent hover:bg-accent-soft data-hover:bg-accent-soft' },
      { variant: 'outlined', tone: 'danger', class: 'border-danger text-danger hover:bg-danger-soft data-hover:bg-danger-soft' },
      { variant: 'outlined', tone: 'neutral', class: 'border-border-strong text-text hover:bg-surface-muted data-hover:bg-surface-muted' },
      // text
      { variant: 'text', tone: 'accent', class: 'text-accent hover:bg-accent-soft data-hover:bg-accent-soft' },
      { variant: 'text', tone: 'danger', class: 'text-danger hover:bg-danger-soft data-hover:bg-danger-soft' },
      { variant: 'text', tone: 'neutral', class: 'text-text-muted hover:bg-surface-muted hover:text-text data-hover:bg-surface-muted' },
    ],
    defaultVariants: {
      variant: 'filled',
      tone: 'accent',
      size: 'md',
    },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonStyles>;
