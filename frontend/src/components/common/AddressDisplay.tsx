import { useState } from 'react';
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';
import { truncateAddress } from '../../lib/format';
import { cn } from '../../lib/cn';

interface AddressDisplayProps {
  address: string;
  truncate?: boolean;
  copyable?: boolean;
  className?: string;
}

export const AddressDisplay = ({
  address,
  truncate = true,
  copyable = true,
  className,
}: AddressDisplayProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!copyable) {
      return;
    }

    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      console.warn('Failed to copy address:', error);
    }
  };

  return (
    <div
      className={cn('inline-flex max-w-full items-center gap-2 overflow-hidden rounded-lg bg-app-elevated px-2.5 py-1', className)}
    >
      <span className="break-all font-mono text-xs text-[color:var(--text-secondary)]">
        {truncate ? truncateAddress(address) : address}
      </span>
      {copyable ? (
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy wallet address"
          className="rounded-md p-2 text-muted hover:text-[color:var(--text-primary)]"
        >
          {copied ? <CheckIcon className="h-4 w-4" /> : <ClipboardDocumentIcon className="h-4 w-4" />}
        </button>
      ) : null}
    </div>
  );
};
