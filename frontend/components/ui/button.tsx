'use client';

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * EWP Design System v1 — use this instead of ad hoc `<button className="btn-*">`.
 *
 * Variants:
 * - primary: one main action per panel/page section
 * - secondary: outline actions (export, edit, cancel)
 * - ghost: low-emphasis actions
 * - toolbar: page header refresh / utility (never brand-filled)
 * - danger: destructive confirm
 * - inline: compact actions inside tables
 */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'toolbar'
  | 'danger'
  | 'inline';

export type ButtonSize = 'md' | 'sm';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
};

const base =
  'inline-flex items-center justify-center gap-2.5 font-semibold transition-all ' +
  'focus:outline-none focus:ring-2 focus:ring-cyan-400/60 focus:ring-offset-2 ' +
  'disabled:pointer-events-none disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  primary:
    'min-h-11 rounded-lg px-5 text-sm text-white shadow-sm bg-brand hover:bg-brand-dark hover:shadow-md active:scale-[0.99]',
  secondary:
    'min-h-11 rounded-lg border-2 border-slate-300 bg-white px-5 text-sm text-content shadow-sm hover:border-slate-400 hover:bg-slate-50 active:scale-[0.99]',
  ghost:
    'min-h-10 rounded-lg px-4 text-sm text-content-muted hover:bg-slate-100 hover:text-content',
  toolbar:
    'h-9 rounded-lg border border-card-border bg-white px-3 text-sm font-medium text-content-muted shadow-sm hover:border-primary-300 hover:text-brand',
  danger:
    'min-h-11 rounded-lg px-5 text-sm text-white shadow-sm bg-danger hover:bg-red-600 active:scale-[0.99]',
  inline:
    'h-8 rounded-md px-3 text-xs font-medium text-brand hover:bg-violet-50 border border-transparent hover:border-violet-200',
};

const sizes: Record<ButtonSize, string> = {
  md: '',
  sm: 'min-h-9 px-4 text-xs',
};

function renderIcon(icon: ReactNode, loading: boolean): ReactNode {
  if (loading) {
    return <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />;
  }
  if (!icon) return null;
  if (typeof icon === 'object' && icon !== null && 'type' in icon) {
    const el = icon as ReactElement<{ className?: string }>;
    return (
      <span className="inline-flex shrink-0 [&>svg]:h-4 [&>svg]:w-4" aria-hidden>
        {el}
      </span>
    );
  }
  return icon;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    iconPosition = 'left',
    className,
    disabled,
    children,
    type = 'button',
    ...props
  },
  ref,
) {
  const iconNode = renderIcon(icon, loading);
  const sizeClass =
    variant === 'inline' || variant === 'toolbar' ? '' : size === 'sm' ? sizes.sm : '';

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], sizeClass, className)}
      {...props}
    >
      {iconPosition === 'left' && iconNode}
      {children ? (
        <span className={cn(variant === 'toolbar' && 'hidden sm:inline')}>{children}</span>
      ) : null}
      {iconPosition === 'right' && iconNode}
    </button>
  );
});
