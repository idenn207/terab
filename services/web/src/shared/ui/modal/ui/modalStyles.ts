import { cva, type VariantProps } from 'class-variance-authority';

export const modalPanelStyles = cva(
  [
    'row-start-2 w-full min-w-0 p-6',
    'bg-surface-elevated text-text',
    // mobile: BottomSheet — 하단 정렬 + 상단만 둥근 모서리
    'rounded-t-2xl',
    // desktop: centered Dialog — 모든 모서리 둥글게
    'sm:mb-auto sm:rounded-2xl',
    'shadow-lg ring-1 ring-border',
    'transition duration-normal will-change-transform',
    // mobile: 아래에서 슬라이드 업 — desktop: 살짝 fade-scale
    'data-closed:translate-y-12 data-closed:opacity-0',
    'sm:data-closed:translate-y-0 sm:data-closed:data-enter:scale-95',
    'data-enter:ease-out data-leave:ease-in',
  ],
  {
    variants: {
      size: {
        sm: 'sm:max-w-sm',
        md: 'sm:max-w-md',
        lg: 'sm:max-w-lg',
        xl: 'sm:max-w-2xl',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

export type ModalPanelVariantProps = VariantProps<typeof modalPanelStyles>;
