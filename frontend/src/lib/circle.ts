import { createPublicClient, custom } from 'viem';
import { TRUST_CIRCLE_ABI } from '../contracts/TrustCircle';
import { TRUST_CIRCLE_FACTORY_ABI } from '../contracts/TrustCircleFactory';
import { TRUST_CIRCLE_FACTORY_ADDRESS } from '../contracts/addresses';
import { arcTestnet } from './arcChain';
import { api } from './api';

export interface CircleInfo {
  id: number;
  name: string;
  address: `0x${string}`;
  status: string;
  contributionAmount: number;
  cycleDuration: number;
  cycleStart: number;
  memberCount: number;
  currentCycle: number;
}

const CIRCLE_STATUS_LABELS = ['Pending', 'Active', 'Paused', 'Resolved', 'Dissolved'];
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const DISCOVERY_CHUNK_SIZE = 20;
const MEMBERSHIP_CHUNK_SIZE = 20;
const DATA_CHUNK_SIZE = 10;

const chunkItems = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

export const resolveCircleStatus = (statusCode: number) =>
  CIRCLE_STATUS_LABELS[statusCode] ?? 'Unknown';

const getClient = () => {
  if (!window.ethereum) {
    throw new Error('No wallet provider found.');
  }

  return createPublicClient({
    transport: custom(window.ethereum),
    chain: arcTestnet,
  });
};

export const fetchCircleAddressById = async (circleId: number) => {
  const publicClient = getClient();
  const address = (await publicClient.readContract({
    address: TRUST_CIRCLE_FACTORY_ADDRESS as `0x${string}`,
    abi: TRUST_CIRCLE_FACTORY_ABI,
    functionName: 'getCircle',
    args: [BigInt(circleId)],
  })) as `0x${string}`;

  return address;
};

export const fetchUserCircles = async (walletAddress: `0x${string}`, maxCircles = 100) => {
  const publicClient = getClient();
  const circles: CircleInfo[] = [];
  const normalizedWalletAddress = walletAddress.toLowerCase();
  const discoveredCircles: Array<{ id: number; address: `0x${string}` }> = [];
  const circleIds = Array.from({ length: maxCircles }, (_, index) => index);

  let reachedEnd = false;

  for (const idChunk of chunkItems(circleIds, DISCOVERY_CHUNK_SIZE)) {
    if (reachedEnd) {
      break;
    }

    const discoveryResults = await Promise.all(
      idChunk.map(async (circleId) => {
        try {
          const address = (await publicClient.readContract({
            address: TRUST_CIRCLE_FACTORY_ADDRESS as `0x${string}`,
            abi: TRUST_CIRCLE_FACTORY_ABI,
            functionName: 'getCircle',
            args: [BigInt(circleId)],
          })) as `0x${string}`;

          return {
            id: circleId,
            address,
            failed: false,
          };
        } catch {
          return {
            id: circleId,
            address: ZERO_ADDRESS as `0x${string}`,
            failed: true,
          };
        }
      })
    );

    for (const result of discoveryResults) {
      if (result.failed || result.address === ZERO_ADDRESS) {
        reachedEnd = true;
        break;
      }

      discoveredCircles.push({
        id: result.id,
        address: result.address,
      });
    }
  }

  const memberCircles: Array<{ id: number; address: `0x${string}` }> = [];

  for (const circleChunk of chunkItems(discoveredCircles, MEMBERSHIP_CHUNK_SIZE)) {
    const membershipResults = await Promise.all(
      circleChunk.map(async (circle) => {
        const [isMemberResult, organizerResult] = await Promise.all([
          publicClient
            .readContract({
              address: circle.address,
              abi: TRUST_CIRCLE_ABI,
              functionName: 'isMember',
              args: [walletAddress],
            })
            .catch(() => false),
          publicClient
            .readContract({
              address: circle.address,
              abi: TRUST_CIRCLE_ABI,
              functionName: 'organizer',
            })
            .catch(() => ''),
        ]);

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
