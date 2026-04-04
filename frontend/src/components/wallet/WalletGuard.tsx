import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingSkeleton } from '../feedback/LoadingSkeleton';
import { useWalletContext } from '../../providers/WalletProvider';

export const WalletGuard = () => {
  const location = useLocation();
  const { isConnected, isInitializing } = useWalletContext();

  if (isInitializing) {
    return (
      <div className="page-shell">
        <LoadingSkeleton variant="card" className="h-52" />
      </div>
    );
  }

  if (!isConnected) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};
