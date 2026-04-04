/// <reference types="vite/client" />

interface EthereumProvider {
  isMetaMask?: boolean;
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler: (...args: any[]) => void) => void;
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  selectedAddress: string | null;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export {};
