import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, icon, className, id, children, ...props }, ref) => {
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
          <select
            ref={ref}
            id={controlId}
            className={cn(
              'w-full border-0 bg-transparent p-0 text-sm text-[color:var(--text-primary)] outline-none',
              className
            )}
            {...props}
          >
            {children}
          </select>
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

Select.displayName = 'Select';
