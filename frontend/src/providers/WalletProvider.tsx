import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

interface WalletContextValue {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  isInitializing: boolean;
  hasProvider: boolean;
  connect: () => Promise<string>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);
const STORAGE_KEY = 'trustcircle_connected_wallet';

const parseChainId = (hexValue: string | null): number | null => {
  if (!hexValue) {
    return null;
  }

  const parsed = Number.parseInt(hexValue, 16);
  return Number.isNaN(parsed) ? null : parsed;
};

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const hasProvider = Boolean(window.ethereum);

  const connect = useCallback(async (): Promise<string> => {
    if (!window.ethereum) {
      throw new Error('No wallet provider found. Install MetaMask or another EVM wallet.');
    }

    setIsConnecting(true);

    try {
      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[];

      const account = accounts[0];
      if (!account) {
        throw new Error('Wallet connected but no account was returned.');
      }

      const nextChainId = parseChainId(
        (await window.ethereum.request({ method: 'eth_chainId' })) as string
      );

      setAddress(account);
      setChainId(nextChainId);
      window.localStorage.setItem(STORAGE_KEY, account);

      return account;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const waitForProvider = async (retries = 10): Promise<void> => {
      if (window.ethereum || retries === 0) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
      return waitForProvider(retries - 1);
    };

    const hydrate = async () => {
      await waitForProvider();

      if (!window.ethereum) {
        if (!cancelled) {
          setIsInitializing(false);
        }
        return;
      }

      try {
        const [accounts, chainHex] = await Promise.all([
          window.ethereum.request({ method: 'eth_accounts' }) as Promise<string[]>,
          window.ethereum.request({ method: 'eth_chainId' }) as Promise<string>,
        ]);

        if (cancelled) {
          return;
        }

        const cachedAddress = window.localStorage.getItem(STORAGE_KEY);
        const account = accounts[0] ?? cachedAddress;
        if (account) {
          setAddress(account);
        }
        setChainId(parseChainId(chainHex));
      } catch {
        if (!cancelled) {
          setAddress(null);
          setChainId(null);
        }
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!window.ethereum) {
      return undefined;
    }

    const handleAccountsChanged = (accounts: string[]) => {
      const account = accounts[0] ?? null;
      setAddress(account);

      if (account) {
        window.localStorage.setItem(STORAGE_KEY, account);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    };

    const handleChainChanged = (chainHex: string) => {
      setChainId(parseChainId(chainHex));
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.off('accountsChanged', handleAccountsChanged);
      window.ethereum?.off('chainChanged', handleChainChanged);
    };
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      chainId,
      isConnected: Boolean(address),
      isConnecting,
      isInitializing,
      hasProvider,
      connect,
      disconnect,
    }),
    [address, chainId, isConnecting, isInitializing, hasProvider, connect, disconnect]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWalletContext = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletContext must be used within WalletProvider');
  }

  return context;
};
