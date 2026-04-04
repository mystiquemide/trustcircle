import { ShieldCheckIcon } from '@heroicons/react/24/solid';
import { cn } from '../../lib/cn';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { iconWrap: 'h-7 w-7 rounded-lg', text: 'text-lg' },
  md: { iconWrap: 'h-9 w-9 rounded-xl', text: 'text-xl' },
  lg: { iconWrap: 'h-12 w-12 rounded-2xl', text: 'text-2xl' },
};

export const Logo = ({ size = 'md', showText = true, className }: LogoProps) => (
  <div className={cn('inline-flex items-center gap-3', className)}>
    <div
      className={cn(
        'flex items-center justify-center bg-gradient-to-br from-primary-400 to-primary-700 shadow-card',
        sizeMap[size].iconWrap
      )}
      aria-hidden="true"
    >
      <ShieldCheckIcon className="h-4 w-4 text-white" />
    </div>
    {showText ? (
      <div className="flex flex-col">
        <span className={cn('font-extrabold leading-none tracking-tight', sizeMap[size].text)}>
          TrustCircle
        </span>
        <span className="text-[11px] font-medium text-muted">Onchain savings circles</span>
      </div>
    ) : null}
  </div>
);
