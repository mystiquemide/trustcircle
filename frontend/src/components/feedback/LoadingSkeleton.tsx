import { cn } from '../../lib/cn';

type SkeletonVariant = 'text' | 'card' | 'circle';

interface LoadingSkeletonProps {
  variant?: SkeletonVariant;
  count?: number;
  className?: string;
}

const variantClassMap: Record<SkeletonVariant, string> = {
  text: 'h-4 rounded-md',
  card: 'h-28 rounded-2xl',
  circle: 'h-10 w-10 rounded-full',
};

export const LoadingSkeleton = ({
  variant = 'text',
  count = 1,
  className,
}: LoadingSkeletonProps) => (
  <div className="space-y-2">
    {Array.from({ length: count }).map((_, index) => (
      <div
        key={`${variant}-${index}`}
        className={cn('animate-pulse bg-slate-200 dark:bg-slate-700/70', variantClassMap[variant], className)}
      />
    ))}
  </div>
);
