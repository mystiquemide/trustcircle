import { createPublicClient, createWalletClient, custom } from 'viem';
import { arcTestnet } from './arcChain';

export const getPublicClient = () => {
  if (!window.ethereum) {
    throw new Error('No wallet provider found. Install MetaMask or another wallet.');
  }

  return createPublicClient({
    transport: custom(window.ethereum),
    chain: arcTestnet,
  });
};

export const getWalletClient = () => {
  if (!window.ethereum) {
    throw new Error('No wallet provider found. Install MetaMask or another wallet.');
  }

  return createWalletClient({
    transport: custom(window.ethereum),
    chain: arcTestnet,
  });
};

export const ensureWalletAddress = async () => {
  if (!window.ethereum) {
    throw new Error('No wallet provider found. Install MetaMask or another wallet.');
  }

  const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
  const address = accounts[0];

  if (!address) {
    throw new Error('Unable to resolve wallet address.');
  }

  return address as `0x${string}`;
};
