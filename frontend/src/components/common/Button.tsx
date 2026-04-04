import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { cn } from '../../lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClassMap: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-600 text-white hover:bg-primary-700 focus-visible:outline-primary-500 dark:bg-primary-500 dark:hover:bg-primary-400',
  secondary:
    'bg-primary-50 text-primary-700 hover:bg-primary-100 focus-visible:outline-primary-500 dark:bg-primary-950/60 dark:text-primary-200 dark:hover:bg-primary-900/60',
  outline:
    'border border-primary-300 bg-transparent text-primary-700 hover:bg-primary-50 focus-visible:outline-primary-500 dark:border-primary-700 dark:text-primary-200 dark:hover:bg-primary-950/40',
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline-rose-500 dark:bg-rose-500 dark:hover:bg-rose-400',
  ghost:
    'bg-transparent text-secondary hover:bg-slate-100 focus-visible:outline-slate-500 dark:text-slate-200 dark:hover:bg-slate-800/60',
};

const sizeClassMap: Record<ButtonSize, string> = {
  sm: 'h-10 rounded-lg px-3 text-sm',
  md: 'h-11 rounded-xl px-4 text-sm',
  lg: 'h-12 rounded-xl px-5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      fullWidth = false,
      className,
      children,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
        variantClassMap[variant],
        sizeClassMap[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading ? <ArrowPathIcon className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  )
);

Button.displayName = 'Button';
