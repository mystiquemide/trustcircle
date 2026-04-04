import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, className, id, ...props }, ref) => {
    const controlId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-1.5">
        {label ? (
          <label htmlFor={controlId} className="block text-sm font-semibold text-[color:var(--text-secondary)]">
            {label}
          </label>
        ) : null}
        <div
          className={cn(
            'flex h-11 items-center rounded-xl border bg-app-secondary px-3',
            error
              ? 'border-rose-400 focus-within:border-rose-500'
              : 'border-slate-200 focus-within:border-primary-500 dark:border-slate-700 dark:focus-within:border-primary-400'
          )}
        >
          {icon ? <span className="mr-2 text-muted">{icon}</span> : null}
          <input
            ref={ref}
            id={controlId}
            className={cn(
              'w-full border-0 bg-transparent p-0 text-sm text-[color:var(--text-primary)] outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500',
              className
            )}
            {...props}
          />
        </div>
        {error ? (
          <p className="text-xs font-medium text-rose-500">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-muted">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
