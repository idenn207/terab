import { cn } from '@/shared/lib';
import * as Headless from '@headlessui/react';
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { buttonStyles, type ButtonVariantProps } from './buttonStyles';

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  variant?: ButtonVariantProps['variant'];
  tone?: ButtonVariantProps['tone'];
  size?: ButtonVariantProps['size'];
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  loading?: boolean;
  // 있으면 <RouterLink to={href}> 로 폴리모픽 — 라우터 일관성 유지
  href?: string;
}

function Spinner() {
  return (
    <span
      data-slot="spinner"
      aria-hidden="true"
      className="inline-block h-4 w-4 shrink-0 animate-spin rounded-pill border-2 border-current border-r-transparent"
    />
  );
}

function ButtonContent({
  leadingIcon,
  trailingIcon,
  loading,
  children,
}: Pick<ButtonProps, 'leadingIcon' | 'trailingIcon' | 'loading' | 'children'>) {
  return (
    <>
      {loading ? <Spinner /> : leadingIcon ? <span aria-hidden="true">{leadingIcon}</span> : null}
      {children != null && <span>{children}</span>}
      {!loading && trailingIcon ? <span aria-hidden="true">{trailingIcon}</span> : null}
    </>
  );
}

export const Button = React.forwardRef<HTMLElement, ButtonProps>(function Button(
  { variant, tone, size, leadingIcon, trailingIcon, loading, className, children, href, type, disabled, onClick, ...rest },
  ref,
) {
  const classes = cn(buttonStyles({ variant, tone, size }), className);
  const content = (
    <ButtonContent leadingIcon={leadingIcon} trailingIcon={trailingIcon} loading={loading}>
      {children}
    </ButtonContent>
  );

  if (typeof href === 'string') {
    return (
      <RouterLink
        to={href}
        ref={ref as React.ForwardedRef<HTMLAnchorElement>}
        className={classes}
        aria-busy={loading || undefined}
        aria-disabled={disabled || loading || undefined}
        onClick={
          disabled || loading
            ? (event) => {
                event.preventDefault();
              }
            : (onClick as React.MouseEventHandler<HTMLAnchorElement> | undefined)
        }
      >
        {content}
      </RouterLink>
    );
  }

  return (
    <Headless.Button
      {...rest}
      ref={ref as React.ForwardedRef<HTMLButtonElement>}
      type={type ?? 'button'}
      disabled={Boolean(disabled || loading)}
      aria-busy={loading || undefined}
      onClick={onClick as React.MouseEventHandler<HTMLButtonElement> | undefined}
      className={classes}
    >
      {content}
    </Headless.Button>
  );
});

export type { ButtonProps };
