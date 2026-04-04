import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Button } from '../common/Button';

interface NetworkWarningProps {
  chainId: number | null;
  expectedChainId: number;
}

const toHexChainId = (value: number) => `0x${value.toString(16)}`;

export const NetworkWarning = ({ chainId, expectedChainId }: NetworkWarningProps) => {
  if (!chainId || chainId === expectedChainId || !window.ethereum) {
    return null;
  }

  const handleSwitch = async () => {
    try {
      await window.ethereum?.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: toHexChainId(expectedChainId) }],
      });
    } catch (error) {
      console.warn('Failed to switch chain:', error);
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/50 dark:text-amber-200">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="inline-flex items-center gap-2 text-sm font-medium">
          <ExclamationTriangleIcon className="h-4 w-4" />
          Wrong network detected. Switch to Arc Testnet.
        </div>
        <Button size="sm" variant="outline" onClick={handleSwitch}>
          Switch Network
        </Button>
      </div>
    </div>
  );
};
