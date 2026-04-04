import type { ComponentType, SVGProps } from 'react';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { Button } from '../common/Button';

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

interface EmptyStateProps {
  icon?: IconType;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

export const EmptyState = ({
  icon: Icon = SparklesIcon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: EmptyStateProps) => (
  <div className="rounded-2xl border border-dashed border-primary-200 bg-primary-50/40 p-4 text-center dark:border-primary-800 dark:bg-primary-950/20 sm:p-8">
    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-100 text-primary-700 dark:bg-primary-900/60 dark:text-primary-200">
      <Icon className="h-6 w-6" aria-hidden="true" />
    </div>
    <h3 className="text-xl font-bold text-[color:var(--text-primary)]">{title}</h3>
    <p className="mx-auto mt-2 max-w-lg text-sm text-muted">{description}</p>
    {actionLabel && onAction ? (
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={onAction}>{actionLabel}</Button>
        {secondaryActionLabel && onSecondaryAction ? (
          <Button variant="outline" onClick={onSecondaryAction}>
            {secondaryActionLabel}
          </Button>
        ) : null}
      </div>
    ) : null}
  </div>
);
