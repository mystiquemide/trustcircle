import { createPublicClient, http } from 'viem';
import { TRUST_CIRCLE_ABI } from '../contracts/TrustCircle';
import { TRUST_CIRCLE_FACTORY_ABI } from '../contracts/TrustCircleFactory';
import { TRUST_CIRCLE_FACTORY_ADDRESS } from '../contracts/addresses';
import { arcTestnet } from './arcChain';
import { api } from './api';

export interface CircleInfo {
  id: number;
  name: string;
  address: `0x${string}`;
  routeTarget?: string;
  status: string;
  contributionAmount: number;
  cycleDuration: number;
  cycleStart: number;
  memberCount: number;
  currentCycle: number;
  description?: string;
  isPublic?: boolean;
}

interface CircleMetadata {
  contractAddress: string;
  circleId?: number;
  name?: string;
  description?: string;
  isPublic?: boolean;
}

const CIRCLE_STATUS_LABELS = ['Pending', 'Active', 'Paused', 'Resolved', 'Dissolved'];
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const DISCOVERY_CHUNK_SIZE = 5;
const MEMBERSHIP_CHUNK_SIZE = 5;
const DATA_CHUNK_SIZE = 3;
const LOCAL_TRACKED_CIRCLES_KEY_PREFIX = 'trustcircle_tracked_circles_';

const chunkItems = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

export const resolveCircleStatus = (statusCode: number) =>
  CIRCLE_STATUS_LABELS[statusCode] ?? 'Unknown';

const getTrackedCirclesStorageKey = (walletAddress: string) =>
  `${LOCAL_TRACKED_CIRCLES_KEY_PREFIX}${walletAddress.toLowerCase()}`;

const normalizeAddressList = (addresses: string[]) =>
  Array.from(
    new Set(
      addresses
        .filter((address): address is `0x${string}` => /^0x[a-fA-F0-9]{40}$/.test(address))
        .map((address) => address.toLowerCase() as `0x${string}`)
    )
  );

const loadLocalTrackedCircles = (walletAddress: string): `0x${string}`[] => {
  try {
    const payload = window.localStorage.getItem(getTrackedCirclesStorageKey(walletAddress));
    if (!payload) {
      return [];
    }

    return normalizeAddressList(JSON.parse(payload) as string[]);
  } catch {
    return [];
  }
};

export const trackCircleLocally = (walletAddress: string, contractAddress: string) => {
  try {
    const nextAddresses = normalizeAddressList([
      ...loadLocalTrackedCircles(walletAddress),
      contractAddress,
    ]);
    window.localStorage.setItem(getTrackedCirclesStorageKey(walletAddress), JSON.stringify(nextAddresses));
  } catch {
    // no-op
  }
};

const loadBackendTrackedCircles = async (walletAddress: string): Promise<`0x${string}`[]> => {
  try {
    const response = await api.getUserCircles(walletAddress);
    return normalizeAddressList(response?.circles || []);
  } catch {
    return [];
  }
};

// Use direct HTTP transport for reads — bypasses MetaMask which may have
// a stale/broken RPC URL configured. This is only for read operations.
const getClient = () => {
  return createPublicClient({
    transport: http(),
    chain: arcTestnet,
  });
};

export const fetchCircleAddressById = async (circleId: number) => {
  const publicClient = getClient();
  const address = (await publicClient.readContract({
    address: TRUST_CIRCLE_FACTORY_ADDRESS as `0x${string}`,
    abi: TRUST_CIRCLE_FACTORY_ABI,
    functionName: 'circles',
    args: [BigInt(circleId)],
  })) as `0x${string}`;

  return address;
};

const fetchCircleInfoByAddress = async (
  publicClient: ReturnType<typeof getClient>,
  address: `0x${string}`,
  id: number,
  metadata?: Partial<CircleMetadata>
): Promise<CircleInfo | null> => {
  try {
    const [name, status, contributionAmount, cycleDuration, cycleStart, memberCount, currentCycle] =
      await Promise.all([
        publicClient.readContract({ address, abi: TRUST_CIRCLE_ABI, functionName: 'name' }),
        publicClient.readContract({ address, abi: TRUST_CIRCLE_ABI, functionName: 'status' }),
        publicClient.readContract({ address, abi: TRUST_CIRCLE_ABI, functionName: 'contributionAmount' }),
        publicClient.readContract({ address, abi: TRUST_CIRCLE_ABI, functionName: 'cycleDuration' }),
        publicClient.readContract({ address, abi: TRUST_CIRCLE_ABI, functionName: 'cycleStart' }),
        publicClient.readContract({ address, abi: TRUST_CIRCLE_ABI, functionName: 'memberCount' }),
        publicClient.readContract({ address, abi: TRUST_CIRCLE_ABI, functionName: 'currentCycle' }),
      ]);

    return {
      id,
      name: metadata?.name || (name as string),
      address,
      routeTarget: metadata?.circleId !== undefined ? String(metadata.circleId) : address,
      status: resolveCircleStatus(Number(status)),
      contributionAmount: Number(contributionAmount) / 10 ** 6,
      cycleDuration: Number(cycleDuration),
      cycleStart: Number(cycleStart),
      memberCount: Number(memberCount),
      currentCycle: Number(currentCycle),
      description: metadata?.description,
      isPublic: metadata?.isPublic,
    };
  } catch (error) {
    console.warn(`Failed to fetch circle ${address} data:`, error);
    return null;
  }
};

export const fetchUserCircles = async (walletAddress: `0x${string}`, maxCircles = 50) => {
  const publicClient = getClient();
  const circles: CircleInfo[] = [];
  const normalizedWalletAddress = walletAddress.toLowerCase();
  const trackedAddresses = normalizeAddressList([
    ...loadLocalTrackedCircles(walletAddress),
    ...(await loadBackendTrackedCircles(walletAddress)),
  ]);

  for (let index = 0; index < trackedAddresses.length; index += 1) {
    const circle = await fetchCircleInfoByAddress(publicClient, trackedAddresses[index], index);
    if (circle) {
      circles.push(circle);
    }
  }

  if (circles.length > 0) {
    return circles;
  }

  const discoveredCircles: Array<{ id: number; address: `0x${string}` }> = [];
  // Step 1: Determine how many circles exist by reading the counter (with retries)
  let totalCircleCount = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const counter = await publicClient.readContract({
        address: TRUST_CIRCLE_FACTORY_ADDRESS as `0x${string}`,
        abi: TRUST_CIRCLE_FACTORY_ABI,
        functionName: 'circleIdCounter',
      });
      totalCircleCount = Number(counter);
      break;
    } catch (e) {
      console.warn(`circleIdCounter attempt ${attempt + 1} failed:`, e);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (totalCircleCount === 0) {
    return circles;
  }

  const actualMax = Math.min(totalCircleCount, maxCircles);
  const circleIds = Array.from({ length: actualMax }, (_, index) => index);

  // Step 2: Discover circle addresses (with per-call retries for flaky RPC)
  for (const idChunk of chunkItems(circleIds, DISCOVERY_CHUNK_SIZE)) {
    const discoveryResults = await Promise.all(
      idChunk.map(async (circleId) => {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const address = (await publicClient.readContract({
              address: TRUST_CIRCLE_FACTORY_ADDRESS as `0x${string}`,
              abi: TRUST_CIRCLE_FACTORY_ABI,
              functionName: 'circles',
              args: [BigInt(circleId)],
            })) as `0x${string}`;

            if (address && address !== ZERO_ADDRESS) {
              return { id: circleId, address };
            }
            return null;
          } catch {
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
        return null;
      })
    );

    for (const result of discoveryResults) {
      if (result) {
        discoveredCircles.push(result);
      }
    }
  }

  const memberCircles: Array<{ id: number; address: `0x${string}` }> = [];

  for (const circleChunk of chunkItems(discoveredCircles, MEMBERSHIP_CHUNK_SIZE)) {
    const membershipResults = await Promise.all(
      circleChunk.map(async (circle) => {
        // These must be independent — isMember reverts for non-members on
        // the deployed contract, which would kill a Promise.all batch.
        let isMemberResult: unknown = false;
        let organizerResult: unknown = '';

        // Fetch organizer (should always work)
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            organizerResult = await publicClient.readContract({
              address: circle.address,
              abi: TRUST_CIRCLE_ABI,
              functionName: 'organizer',
            });
            break;
          } catch {
            await new Promise((r) => setTimeout(r, 1500));
          }
        }

        // Fetch isMember (reverts for non-members — that's expected, treat as false)
        try {
          isMemberResult = await publicClient.readContract({
            address: circle.address,
            abi: TRUST_CIRCLE_ABI,
            functionName: 'isMember',
            args: [walletAddress],
          });
        } catch {
          isMemberResult = false;
        }

        const isMember = Boolean(isMemberResult);
        const isOrganizer =
          typeof organizerResult === 'string' &&
          organizerResult.toLowerCase() === normalizedWalletAddress;

        if (!isMember && !isOrganizer) {
          return null;
        }

        return circle;
      })
    );

    for (const match of membershipResults) {
      if (match) {
        memberCircles.push(match);
      }
    }
  }

  for (const circleChunk of chunkItems(memberCircles, DATA_CHUNK_SIZE)) {
    const circleDetails = await Promise.all(
      circleChunk.map(async ({ id, address }) => {
        try {
          const [name, status, contributionAmount, cycleDuration, cycleStart, memberCount, currentCycle] =
            await Promise.all([
              publicClient.readContract({
                address,
                abi: TRUST_CIRCLE_ABI,
                functionName: 'name',
              }),
              publicClient.readContract({
                address,
                abi: TRUST_CIRCLE_ABI,
                functionName: 'status',
              }),
              publicClient.readContract({
                address,
                abi: TRUST_CIRCLE_ABI,
                functionName: 'contributionAmount',
              }),
              publicClient.readContract({
                address,
                abi: TRUST_CIRCLE_ABI,
                functionName: 'cycleDuration',
              }),
              publicClient.readContract({
                address,
                abi: TRUST_CIRCLE_ABI,
                functionName: 'cycleStart',
              }),
              publicClient.readContract({
                address,
                abi: TRUST_CIRCLE_ABI,
                functionName: 'memberCount',
              }),
              publicClient.readContract({
                address,
                abi: TRUST_CIRCLE_ABI,
                functionName: 'currentCycle',
              }),
            ]);

          const parsedStatus = resolveCircleStatus(Number(status));

          void api
            .saveCircleMetadata(
              address,
              name as string,
              `${Number(memberCount)} members, ${parsedStatus} circle`
            )
            .catch((error) => {
              console.warn('Failed to sync circle metadata:', error);
            });

          return {
            id,
            name: name as string,
            address,
            routeTarget: String(id),
            status: parsedStatus,
            contributionAmount: Number(contributionAmount) / 10 ** 6,
            cycleDuration: Number(cycleDuration),
            cycleStart: Number(cycleStart),
            memberCount: Number(memberCount),
            currentCycle: Number(currentCycle),
          } as CircleInfo;
        } catch (error) {
          console.warn(`Failed to fetch circle ${id} data:`, error);
          return null;
        }
      })
    );

    for (const detail of circleDetails) {
      if (detail) {
        circles.push(detail);
      }
    }
  }

  return circles;
};

/**
 * Fetch ALL circles from the blockchain (no membership filter).
 * Used for the "Public Circles" / "Browse Circles" tab so anyone can discover and join.
 */
export const fetchAllCircles = async (maxCircles = 100): Promise<CircleInfo[]> => {
  const publicClient = getClient();
  const circles: CircleInfo[] = [];

  // Step 1: Get total count
  let totalCircleCount = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const counter = await publicClient.readContract({
        address: TRUST_CIRCLE_FACTORY_ADDRESS as `0x${string}`,
        abi: TRUST_CIRCLE_FACTORY_ABI,
        functionName: 'circleIdCounter',
      });
      totalCircleCount = Number(counter);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (totalCircleCount === 0) {
    return circles;
  }

  const actualMax = Math.min(totalCircleCount, maxCircles);
  const circleIds = Array.from({ length: actualMax }, (_, index) => index);

  // Step 2: Discover all circle addresses
  const discoveredCircles: Array<{ id: number; address: `0x${string}` }> = [];

  for (const idChunk of chunkItems(circleIds, DISCOVERY_CHUNK_SIZE)) {
    const discoveryResults = await Promise.all(
      idChunk.map(async (circleId) => {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const address = (await publicClient.readContract({
              address: TRUST_CIRCLE_FACTORY_ADDRESS as `0x${string}`,
              abi: TRUST_CIRCLE_FACTORY_ABI,
              functionName: 'circles',
              args: [BigInt(circleId)],
            })) as `0x${string}`;

            if (address && address !== ZERO_ADDRESS) {
              return { id: circleId, address };
            }
            return null;
          } catch {
            await new Promise((r) => setTimeout(r, 1500));
          }
        }
        return null;
      })
    );

    for (const result of discoveryResults) {
      if (result) {
        discoveredCircles.push(result);
      }
    }
  }

  // Step 3: Fetch details for all discovered circles (no membership filter)
  for (const circleChunk of chunkItems(discoveredCircles, DATA_CHUNK_SIZE)) {
    const circleDetails = await Promise.all(
      circleChunk.map(async ({ id, address }) => {
        try {
          const [name, status, contributionAmount, cycleDuration, cycleStart, memberCount, currentCycle] =
            await Promise.all([
              publicClient.readContract({ address, abi: TRUST_CIRCLE_ABI, functionName: 'name' }),
              publicClient.readContract({ address, abi: TRUST_CIRCLE_ABI, functionName: 'status' }),
              publicClient.readContract({ address, abi: TRUST_CIRCLE_ABI, functionName: 'contributionAmount' }),
              publicClient.readContract({ address, abi: TRUST_CIRCLE_ABI, functionName: 'cycleDuration' }),
              publicClient.readContract({ address, abi: TRUST_CIRCLE_ABI, functionName: 'cycleStart' }),
              publicClient.readContract({ address, abi: TRUST_CIRCLE_ABI, functionName: 'memberCount' }),
              publicClient.readContract({ address, abi: TRUST_CIRCLE_ABI, functionName: 'currentCycle' }),
            ]);

          return {
            id,
            name: name as string,
            address,
            routeTarget: String(id),
            status: resolveCircleStatus(Number(status)),
            contributionAmount: Number(contributionAmount) / 10 ** 6,
            cycleDuration: Number(cycleDuration),
            cycleStart: Number(cycleStart),
            memberCount: Number(memberCount),
            currentCycle: Number(currentCycle),
          } as CircleInfo;
        } catch (error) {
          console.warn(`Failed to fetch circle ${id} data:`, error);
          return null;
        }
      })
    );

    for (const detail of circleDetails) {
      if (detail) {
        circles.push(detail);
      }
    }
  }

  return circles;
};

const fetchCircleByMetadata = async (metadata: CircleMetadata, fallbackId: number): Promise<CircleInfo> => {
  const publicClient = getClient();
  const address = metadata.contractAddress as `0x${string}`;
  const fallbackName = metadata.name || 'Public Circle';
  const fallbackDescription = metadata.description || '';

  try {
    const [name, status, contributionAmount, cycleDuration, cycleStart, memberCount, currentCycle] =
      await Promise.all([
        publicClient.readContract({ address, abi: TRUST_CIRCLE_ABI, functionName: 'name' }),
        publicClient.readContract({ address, abi: TRUST_CIRCLE_ABI, functionName: 'status' }),
        publicClient.readContract({ address, abi: TRUST_CIRCLE_ABI, functionName: 'contributionAmount' }),
        publicClient.readContract({ address, abi: TRUST_CIRCLE_ABI, functionName: 'cycleDuration' }),
        publicClient.readContract({ address, abi: TRUST_CIRCLE_ABI, functionName: 'cycleStart' }),
        publicClient.readContract({ address, abi: TRUST_CIRCLE_ABI, functionName: 'memberCount' }),
        publicClient.readContract({ address, abi: TRUST_CIRCLE_ABI, functionName: 'currentCycle' }),
      ]);

    return {
      id: metadata.circleId ?? fallbackId,
      name: metadata.name || (name as string),
      address,
      routeTarget: metadata.circleId !== undefined ? String(metadata.circleId) : address,
      status: resolveCircleStatus(Number(status)),
      contributionAmount: Number(contributionAmount) / 10 ** 6,
      cycleDuration: Number(cycleDuration),
      cycleStart: Number(cycleStart),
      memberCount: Number(memberCount),
      currentCycle: Number(currentCycle),
      description: fallbackDescription,
      isPublic: true,
    };
  } catch (error) {
    console.warn(`Failed to hydrate public circle ${address}:`, error);

    return {
      id: metadata.circleId ?? fallbackId,
      name: fallbackName,
      address,
      routeTarget: metadata.circleId !== undefined ? String(metadata.circleId) : address,
      status: 'Pending',
      contributionAmount: 0,
      cycleDuration: 0,
      cycleStart: 0,
      memberCount: 0,
      currentCycle: 0,
      description: fallbackDescription,
      isPublic: true,
    };
  }
};

export const fetchPublicCircles = async (maxCircles = 100): Promise<CircleInfo[]> => {
  const metadata = (await api.listCircles({ isPublic: true, limit: maxCircles })) as CircleMetadata[];
  const publicMetadata = metadata.filter((item) => item.contractAddress);

  if (publicMetadata.length === 0) {
    return [];
  }

  const circles: CircleInfo[] = [];

  for (let index = 0; index < publicMetadata.length; index += 1) {
    const circle = await fetchCircleByMetadata(publicMetadata[index], index);
    if (circle.status === 'Pending') {
      circles.push(circle);
    }
  }

  return circles;
};
