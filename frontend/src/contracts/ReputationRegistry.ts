export const REPUTATION_REGISTRY_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'wallet', type: 'address' }],
    name: 'getScore',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
