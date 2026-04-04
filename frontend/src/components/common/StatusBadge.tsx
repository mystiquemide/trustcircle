import { cn } from '../../lib/cn';

type BadgeTone = 'active' | 'pending' | 'paused' | 'resolved' | 'dissolved' | 'default';

const toneClassMap: Record<BadgeTone, string> = {
  active:
    'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-700/60',
  pending:
    'bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-700/60',
  paused:
    'bg-orange-100 text-orange-700 ring-1 ring-inset ring-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-700/60',
  resolved:
    'bg-sky-100 text-sky-700 ring-1 ring-inset ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-700/60',
  dissolved:
    'bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-700/60',
  default:
    'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700/60',
};

const resolveTone = (status: string): BadgeTone => {
  switch (status.toLowerCase()) {
    case 'active':
      return 'active';
    case 'pending':
      return 'pending';
    case 'paused':
      return 'paused';
    case 'resolved':
    case 'completed':
      return 'resolved';
    case 'dissolved':
    case 'failed':
      return 'dissolved';
    default:
      return 'default';
  }
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const tone = resolveTone(status);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide',
        toneClassMap[tone],
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {status}
    </span>
  );
};
