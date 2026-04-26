export const CONTRACT_ADDRESSES = {
  ReputationRegistry: (import.meta.env.VITE_REPUTATION_ADDRESS || '0x9549002af3b4B806D1F3D16287189143F44a7E18') as `0x${string}`,
  TrustCircleFactory: (import.meta.env.VITE_FACTORY_ADDRESS || '0x5f2B3dF47120762de67431f47453189A8844AADE') as `0x${string}`,
  USDC: (import.meta.env.VITE_USDC_ADDRESS || '0x3600000000000000000000000000000000000000') as `0x${string}`,
} as const;

export const TRUST_CIRCLE_FACTORY_ADDRESS = CONTRACT_ADDRESSES.TrustCircleFactory as `0x${string}`;