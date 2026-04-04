import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  subtitle?: ReactNode;
  footer?: ReactNode;
  padded?: boolean;
}

export const Card = ({
  title,
  subtitle,
  footer,
  padded = true,
  className,
  children,
  ...props
}: CardProps) => (
  <section
    className={cn(
      'glass-card rounded-2xl border shadow-card',
      padded && 'p-5 sm:p-6',
      className
    )}
    {...props}
  >
    {title ? (
      <header className={cn('mb-4', !subtitle && 'mb-5')}>
        <h2 className="text-lg font-bold leading-tight text-[color:var(--text-primary)]">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </header>
    ) : null}
    <div>{children}</div>
    {footer ? <footer className="mt-5 border-t pt-4">{footer}</footer> : null}
  </section>
);
