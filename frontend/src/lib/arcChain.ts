import { defineChain } from 'viem';

/**
 * Arc Testnet configuration for Viem
 * Arc is an EVM-compatible network powered by Circle
 * 
 * Network Details:
 * - Chain ID: 5042002
 * - RPC URL: https://rpc.testnet.arc.io (configurable via VITE_ARC_RPC_URL)
 * - Block Explorer: https://testnet.arcscan.io
 * - Native Currency: USDC
 */

const ARC_RPC_URL = import.meta.env.VITE_ARC_RPC_URL || 'https://rpc.testnet.arc.network';
const ARC_EXPLORER_URL = import.meta.env.VITE_ARC_EXPLORER_URL || 'https://testnet.arcscan.app';

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    decimals: 6,
    name: 'USD Coin',
    symbol: 'USDC',
  },
  rpcUrls: {
    default: {
      http: [ARC_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: 'Arcscan',
      url: ARC_EXPLORER_URL,
    },
  },
  testnet: true,
});
