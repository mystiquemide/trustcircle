import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bars3Icon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { arcTestnet } from '../../lib/arcChain';
import { cn } from '../../lib/cn';
import { truncateAddress } from '../../lib/format';
import { useWalletContext } from '../../providers/WalletProvider';
import { Button } from '../common/Button';
import { Logo } from '../common/Logo';
import { ConnectWalletButton } from '../wallet/ConnectWalletButton';
import { DarkModeToggle } from '../wallet/DarkModeToggle';
import { NetworkWarning } from '../wallet/NetworkWarning';

const navItems = [
  { to: '/home', label: 'Home' },
  { to: '/create', label: 'Create Circle' },
  { to: '/dashboard', label: 'Dashboard' },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/60 dark:text-primary-200'
      : 'text-secondary hover:bg-slate-100 dark:hover:bg-slate-800/70'
  );

export const Layout = () => {
  const { chainId, isConnected, disconnect, address } = useWalletContext();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleDisconnect = () => {
    disconnect();
    navigate('/');
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-app-secondary/90 backdrop-blur">
        <div className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link to="/home" className="inline-flex">
              <Logo size="sm" />
            </Link>
          </div>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={navLinkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <DarkModeToggle />
            {isConnected && address ? (
              <>
                <span className="text-sm font-mono text-muted">{truncateAddress(address)}</span>
                <Button variant="outline" size="sm" onClick={handleDisconnect}>
                  <ArrowRightOnRectangleIcon className="mr-1.5 h-4 w-4" />
                  Disconnect
                </Button>
              </>
            ) : (
              <ConnectWalletButton size="sm" />
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setMenuOpen((current) => !current)}
          >
            <Bars3Icon className="h-5 w-5" />
          </Button>
        </div>

        {menuOpen ? (
          <div className="border-t p-3 md:hidden">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={navLinkClass}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-3 flex items-center justify-between gap-3">
              <DarkModeToggle />
              {isConnected && address ? (
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-sm font-mono text-muted">{truncateAddress(address)}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    fullWidth
                    onClick={() => {
                      handleDisconnect();
                      setMenuOpen(false);
                    }}
                  >
                    <ArrowRightOnRectangleIcon className="mr-1.5 h-4 w-4" />
                    Disconnect
                  </Button>
                </div>
              ) : (
                <ConnectWalletButton size="sm" fullWidth />
              )}
            </div>
          </div>
        ) : null}
      </header>

      <main className="page-shell animate-page-in">
        <NetworkWarning chainId={chainId} expectedChainId={arcTestnet.id} />
        <Outlet />
      </main>

      <footer className="border-t bg-app-secondary/80 py-6 text-sm text-muted">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 text-center sm:px-6 lg:flex-row lg:px-8 lg:text-left">
          <div className="flex items-center gap-4">
            <a href="#" className="py-2 transition hover:text-[color:var(--text-primary)]">
              Docs
            </a>
            <a href="#" className="py-2 transition hover:text-[color:var(--text-primary)]">
              Terms & Conditions
            </a>
          </div>
          <p>Built on Arc Network</p>
          <p>&copy; 2026 TrustCircle. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};
