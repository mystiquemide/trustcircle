import { useNavigate } from 'react-router-dom';
import { WalletIcon } from '@heroicons/react/24/outline';
import { Button } from '../common/Button';
import { useWalletContext } from '../../providers/WalletProvider';
import { truncateAddress } from '../../lib/format';
import { useToast } from '../../providers/ToastProvider';

interface ConnectWalletButtonProps {
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  redirectToHomeOnConnect?: boolean;
}

export const ConnectWalletButton = ({
  size = 'md',
  fullWidth = false,
  redirectToHomeOnConnect = false,
}: ConnectWalletButtonProps) => {
  const navigate = useNavigate();
  const { connect, isConnected, isConnecting, address, hasProvider } = useWalletContext();
  const { showToast } = useToast();

  const handleConnect = async () => {
    try {
      const connectedAddress = await connect();
      showToast('Wallet connected successfully.', 'success');

      if (redirectToHomeOnConnect && connectedAddress) {
        navigate('/home');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect wallet.';
      showToast(message, 'error');
    }
  };

  return (
    <Button
      onClick={handleConnect}
      loading={isConnecting}
      size={size}
      fullWidth={fullWidth}
      variant={isConnected ? 'secondary' : 'primary'}
      title={!hasProvider ? 'Install an EVM wallet extension' : undefined}
    >
      <WalletIcon className="h-4 w-4" />
      {isConnected && address ? truncateAddress(address) : 'Connect Wallet'}
    </Button>
  );
};
