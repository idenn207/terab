import { cva, type VariantProps } from 'class-variance-authority';

export const inputStyles = cva(
  [
    'block w-full appearance-none border outline-none transition-colors duration-fast ease-out',
    'rounded-md',
    'bg-surface text-text placeholder:text-text-subtle',
    'disabled:opacity-50 disabled:pointer-events-none',
    'data-disabled:opacity-50 data-disabled:pointer-events-none',
    // focus 는 wrapper 의 focus-within ring 으로 표현
  ],
  {
    variants: {
      tone: {
        neutral: 'border-border hover:border-border-strong data-hover:border-border-strong',
        danger: 'border-danger data-invalid:border-danger',
      },
      size: {
        sm: 'min-h-9 px-3 text-sm',
        md: 'min-h-12 px-4 text-base',
      },
      hasLeading: { true: '', false: '' },
      hasTrailing: { true: '', false: '' },
    },
    compoundVariants: [
      { size: 'sm', hasLeading: true, class: 'pl-10' },
      { size: 'sm', hasTrailing: true, class: 'pr-10' },
      { size: 'md', hasLeading: true, class: 'pl-12' },
      { size: 'md', hasTrailing: true, class: 'pr-12' },
    ],
    defaultVariants: {
      tone: 'neutral',
      size: 'md',
      hasLeading: false,
      hasTrailing: false,
    },
  },
);

export type InputVariantProps = VariantProps<typeof inputStyles>;
