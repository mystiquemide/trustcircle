import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createPublicClient, createWalletClient, custom } from 'viem';
import {
  ArrowLeftIcon,
  BanknotesIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { TRUST_CIRCLE_ABI } from '../contracts/TrustCircle';
import { TRUST_CIRCLE_FACTORY_ABI } from '../contracts/TrustCircleFactory';
import { CONTRACT_ADDRESSES, TRUST_CIRCLE_FACTORY_ADDRESS } from '../contracts/addresses';
import { arcTestnet } from '../lib/arcChain';
import { api } from '../lib/api';
import { formatCycleDuration, formatTimeLeft, formatUsd } from '../lib/format';
import { getUserErrorMessage, logError } from '../lib/errors';
import { buildLocalInviteCode } from '../lib/invites';
import { AddressDisplay, Button, Card, ConfirmDialog, StatusBadge } from '../components/common';
import { LoadingSkeleton, EmptyState } from '../components/feedback';
import { useToast } from '../providers/ToastProvider';
import { useWalletContext } from '../providers/WalletProvider';

interface CircleData {
  name: string;
  memberCount: number;
  contributionAmount: number;
  cycleDuration: number;
  currentCycle: number;
  cycleStart: number;
  status: string;
  organizer: string;
  description?: string;
  currentDefaulter?: string;
  continueVotes?: number;
  dissolveVotes?: number;
  hasVoted?: boolean;
}

type Contributions = Record<string, boolean>;
const isAddressParam = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);
const pendingMetadataKey = (circleId: string) => `trustcircle_pending_circle_metadata_${circleId}`;

const loadPendingCircleMetadata = (circleId: string) => {
  if (!circleId || isAddressParam(circleId)) {
    return null;
  }

  try {
    const rawMetadata = window.localStorage.getItem(pendingMetadataKey(circleId));
    if (!rawMetadata) {
      return null;
    }

    return JSON.parse(rawMetadata) as {
      name?: string;
      description?: string;
      isPublic?: boolean;
      circleId?: number;
    };
  } catch {
    return null;
  }
};

export default function CircleDetail() {
  const { circleId = '' } = useParams<{ circleId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { address: walletAddress } = useWalletContext();

  const [circleAddress, setCircleAddress] = useState<string>('');
  const [circleData, setCircleData] = useState<CircleData | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [contributions, setContributions] = useState<Contributions>({});
  const [payoutOrder, setPayoutOrder] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [contributing, setContributing] = useState(false);
  const [distributingPayout, setDistributingPayout] = useState(false);
  const [showConfirmContribution, setShowConfirmContribution] = useState(false);
  const [showConfirmDistribute, setShowConfirmDistribute] = useState(false);
  const [markingDefaulter, setMarkingDefaulter] = useState(false);
  const [voting, setVoting] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [inviteLink, setInviteLink] = useState<string>('');
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const ethereum = window.ethereum;

  useEffect(() => {
    if (!circleId || !ethereum) {
      return;
    }

    const loadCircle = async () => {
      setLoading(true);
      try {
        const publicClient = createPublicClient({
          transport: custom(ethereum),
          chain: arcTestnet,
          pollingInterval: 10_000,
        });

        let address = isAddressParam(circleId) ? circleId : '';

        if (!address) {
          for (let attempt = 0; attempt < 24; attempt++) {
            address = (await publicClient.readContract({
              address: TRUST_CIRCLE_FACTORY_ADDRESS as `0x${string}`,
              abi: TRUST_CIRCLE_FACTORY_ABI,
              functionName: 'circles',
              args: [BigInt(circleId)],
            })) as string;

            if (address && address !== '0x0000000000000000000000000000000000000000') {
              break;
            }
            await new Promise(r => setTimeout(r, 5000));
          }
        }

        if (!address || address === '0x0000000000000000000000000000000000000000') {
          throw new Error('Circle address not yet available. Please refresh in a moment.');
        }

        setCircleAddress(address);

        const [name, memberCount, contributionAmount, cycleDuration, currentCycle, cycleStart, status, organizer, currentDefaulter, continueVotes, dissolveVotes] =
          await Promise.all([
            publicClient.readContract({
              address: address as `0x${string}`,
              abi: TRUST_CIRCLE_ABI,
              functionName: 'name',
            }),
            publicClient.readContract({
              address: address as `0x${string}`,
              abi: TRUST_CIRCLE_ABI,
              functionName: 'memberCount',
            }),
            publicClient.readContract({
              address: address as `0x${string}`,
              abi: TRUST_CIRCLE_ABI,
              functionName: 'contributionAmount',
            }),
            publicClient.readContract({
              address: address as `0x${string}`,
              abi: TRUST_CIRCLE_ABI,
              functionName: 'cycleDuration',
            }),
            publicClient.readContract({
              address: address as `0x${string}`,
              abi: TRUST_CIRCLE_ABI,
              functionName: 'currentCycle',
            }),
            publicClient.readContract({
              address: address as `0x${string}`,
              abi: TRUST_CIRCLE_ABI,
              functionName: 'cycleStart',
            }),
            publicClient.readContract({
              address: address as `0x${string}`,
              abi: TRUST_CIRCLE_ABI,
              functionName: 'status',
            }),
            publicClient.readContract({
              address: address as `0x${string}`,
              abi: TRUST_CIRCLE_ABI,
              functionName: 'organizer',
            }),
            publicClient.readContract({
              address: address as `0x${string}`,
              abi: TRUST_CIRCLE_ABI,
              functionName: 'currentDefaulter',
            }).catch(() => '0x0000000000000000000000000000000000000000'),
            publicClient.readContract({
              address: address as `0x${string}`,
              abi: TRUST_CIRCLE_ABI,
              functionName: 'continueVotes',
            }).catch(() => 0n),
            publicClient.readContract({
              address: address as `0x${string}`,
              abi: TRUST_CIRCLE_ABI,
              functionName: 'dissolveVotes',
            }).catch(() => 0n),
          ]);

        let hasVoted = false;
        if (window.ethereum?.selectedAddress && status === 2) { // Paused
          try {
            hasVoted = (await publicClient.readContract({
              address: address as `0x${string}`,
              abi: TRUST_CIRCLE_ABI,
              functionName: 'hasVoted',
              args: [window.ethereum.selectedAddress as `0x${string}`],
            })) as boolean;
          } catch {
            // ignore
          }
        }

        const statusLabel = ['Pending', 'Active', 'Paused', 'Resolved', 'Dissolved'][Number(status)] ?? 'Unknown';

        const nextCircleData: CircleData = {
          name: name as string,
          memberCount: Number(memberCount),
          contributionAmount: Number(contributionAmount) / 10 ** 6,
          cycleDuration: Number(cycleDuration),
          currentCycle: Number(currentCycle),
          cycleStart: Number(cycleStart),
          status: statusLabel,
          organizer: organizer as string,
          currentDefaulter: currentDefaulter as string,
          continueVotes: Number(continueVotes),
          dissolveVotes: Number(dissolveVotes),
          hasVoted,
        };

        setCircleData(nextCircleData);

        const memberList: string[] = [];
        for (let i = 0; i < Number(memberCount); i += 1) {
          try {
            const member = (await publicClient.readContract({
              address: address as `0x${string}`,
              abi: TRUST_CIRCLE_ABI,
              functionName: 'members',
              args: [BigInt(i)],
            })) as string;

            if (member && member !== '0x0000000000000000000000000000000000000000') {
              memberList.push(member);
            }
          } catch {
            // continue
          }
        }
        setMembers(memberList);

        const contributionStatus: Contributions = {};
        for (const member of memberList) {
          try {
            const contributed = (await publicClient.readContract({
              address: address as `0x${string}`,
              abi: TRUST_CIRCLE_ABI,
              functionName: 'contributions',
              args: [BigInt(currentCycle as bigint), member as `0x${string}`],
            })) as boolean;
            contributionStatus[member] = contributed;
          } catch {
            contributionStatus[member] = false;
          }
        }
        setContributions(contributionStatus);

        const order: string[] = [];
        const seenRecipients = new Set<string>();
        for (let i = 0; i < Number(memberCount); i += 1) {
          try {
            const recipient = (await publicClient.readContract({
              address: address as `0x${string}`,
              abi: TRUST_CIRCLE_ABI,
              functionName: 'payoutOrder',
              args: [BigInt(i)],
            })) as string;

            if (recipient && recipient !== '0x0000000000000000000000000000000000000000') {
              const normalizedRecipient = recipient.toLowerCase();
              if (seenRecipients.has(normalizedRecipient)) {
                continue;
              }

              seenRecipients.add(normalizedRecipient);
              order.push(recipient);
            }
          } catch {
            // continue
          }
        }
        setPayoutOrder(order);

        const pendingMetadata = loadPendingCircleMetadata(circleId);
        const metadataName = pendingMetadata?.name || (name as string);
        const metadataDescription =
          pendingMetadata?.description || `${Number(memberCount)} members, ${statusLabel} circle`;
        const metadataCircleId =
          typeof pendingMetadata?.circleId === 'number'
            ? pendingMetadata.circleId
            : !isAddressParam(circleId) && /^\d+$/.test(circleId)
              ? Number(circleId)
              : undefined;

        void api
          .saveCircleMetadata(
            address,
            metadataName,
            metadataDescription,
            pendingMetadata?.isPublic,
            metadataCircleId
          )
          .then(() => {
            if (pendingMetadata) {
              window.localStorage.removeItem(pendingMetadataKey(circleId));
            }
          })
          .catch((error) => {
            console.warn('Failed to sync metadata:', error);
          });

        void api
          .getCircleMetadata(address)
          .then((metadata) => {
            if (metadata?.description) {
              setCircleData((current) => (current ? { ...current, description: metadata.description } : current));
            }
          })
          .catch((error) => {
            console.warn('Failed to load backend metadata:', error);
          });
      } catch (error) {
        logError('Failed to load circle details:', error);
        showToast(getUserErrorMessage('Unable to load circle details. Please try again.'), 'error');
        setCircleData(null);
      } finally {
        setLoading(false);
      }
    };

    void loadCircle();
  }, [circleId, ethereum, refreshIndex, showToast]);

  const activeAddress = window.ethereum?.selectedAddress;
  const normalizedActiveAddress = activeAddress?.toLowerCase();
  const isMember = normalizedActiveAddress
    ? members.some((member) => member.toLowerCase() === normalizedActiveAddress)
    : false;
  const hasContributed = normalizedActiveAddress
    ? Object.entries(contributions).some(
        ([member, contributed]) => member.toLowerCase() === normalizedActiveAddress && contributed
      )
    : false;
  const allMembersContributed = useMemo(
    () => members.length > 0 && members.every((member) => contributions[member]),
    [members, contributions]
  );
  const cycleDeadlinePassed = useMemo(() => {
    if (!circleData || circleData.status !== 'Active') {
      return false;
    }

    const deadline = circleData.cycleStart + circleData.cycleDuration;
    return Math.floor(Date.now() / 1000) > deadline;
  }, [circleData]);
  const gracePeriodPassed = useMemo(() => {
    if (!circleData || circleData.status !== 'Active') {
      return false;
    }

    const graceDeadline = circleData.cycleStart + circleData.cycleDuration + 24 * 60 * 60;
    return Math.floor(Date.now() / 1000) > graceDeadline;
  }, [circleData]);
  const canDistributePayout =
    isMember &&
    circleData?.status === 'Active' &&
    cycleDeadlinePassed &&
    (allMembersContributed || gracePeriodPassed);

  const timeLeftLabel = useMemo(() => {
    if (!circleData) {
      return '...';
    }

    if (circleData.status === 'Pending') {
      return 'Waiting for members';
    }

    if (circleData.status === 'Resolved' || circleData.status === 'Dissolved') {
      return 'Circle complete';
    }

    if (circleData.status === 'Paused') {
      return 'Paused';
    }

    const deadline = circleData.cycleStart + circleData.cycleDuration;
    const now = Math.floor(Date.now() / 1000);
    return formatTimeLeft(deadline - now);
  }, [circleData]);

  const cycleProgressLabel = circleData?.status === 'Active' ? 'Deadline' : 'Status';
  const cycleProgressValueClass =
    circleData?.status === 'Active'
      ? 'mt-1 inline-flex items-center gap-2 text-lg font-bold text-primary-600 dark:text-primary-300'
      : 'mt-1 inline-flex items-center gap-2 text-lg font-bold text-[color:var(--text-primary)]';

  const handleContribute = async () => {
    if (!circleData || !circleAddress || !ethereum) {
      return;
    }

    if (circleData.status !== 'Active' || cycleDeadlinePassed) {
      showToast('Contribution deadline has passed for this cycle.', 'warning');
      return;
    }

    setContributing(true);
    try {
      const walletClient = createWalletClient({
        transport: custom(ethereum),
        chain: arcTestnet,
      });
      const publicClient = createPublicClient({
        transport: custom(ethereum),
        chain: arcTestnet,
      });

      const account = (await walletClient.getAddresses())[0];
      if (!account) {
        throw new Error('No wallet address found');
      }

      const approveHash = await walletClient.writeContract({
        address: CONTRACT_ADDRESSES.USDC as `0x${string}`,
        abi: [
          {
            constant: false,
            inputs: [
              { name: '_spender', type: 'address' },
              { name: '_value', type: 'uint256' },
            ],
            name: 'approve',
            outputs: [{ name: '', type: 'bool' }],
            type: 'function',
          },
        ],
        functionName: 'approve',
        args: [circleAddress as `0x${string}`, BigInt(circleData.contributionAmount * 10 ** 6)],
        account,
      });

      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      const contributeHash = await walletClient.writeContract({
        address: circleAddress as `0x${string}`,
        abi: TRUST_CIRCLE_ABI,
        functionName: 'contribute',
        account,
      });

      await publicClient.waitForTransactionReceipt({ hash: contributeHash });

      showToast('Contribution successful.', 'success');
      setContributions((current) => ({
        ...current,
        [account]: true,
      }));
    } catch (error) {
      logError('Contribution failed:', error);
      showToast(getUserErrorMessage('Unable to complete contribution. Please try again.'), 'error');
    } finally {
      setContributing(false);
      setShowConfirmContribution(false);
    }
  };

  const handleDistributePayout = async () => {
    if (!circleData || !circleAddress || !ethereum) {
      return;
    }

    if (
      circleData.status !== 'Active' ||
      !cycleDeadlinePassed ||
      (!allMembersContributed && !gracePeriodPassed)
    ) {
      showToast('Payout is available after the cycle deadline once all members have contributed, or after the 24-hour grace period.', 'warning');
      return;
    }

    setDistributingPayout(true);
    try {
      const walletClient = createWalletClient({
        transport: custom(ethereum),
        chain: arcTestnet,
      });
      const publicClient = createPublicClient({
        transport: custom(ethereum),
        chain: arcTestnet,
      });

      const account = (await walletClient.getAddresses())[0];
      if (!account) {
        throw new Error('No wallet address found');
      }

      const distributeHash = await walletClient.writeContract({
        address: circleAddress as `0x${string}`,
        abi: TRUST_CIRCLE_ABI,
        functionName: 'distributePayout',
        account,
      });

      await publicClient.waitForTransactionReceipt({ hash: distributeHash });

      showToast('Payout distributed successfully.', 'success');
      setRefreshIndex((current) => current + 1);
    } catch (error) {
      logError('Payout distribution failed:', error);
      showToast(getUserErrorMessage('Unable to distribute payout. Please try again.'), 'error');
    } finally {
      setDistributingPayout(false);
      setShowConfirmDistribute(false);
    }
  };

  const handleGenerateInvite = async () => {
    if (!circleAddress || !circleId) return;

    setGeneratingInvite(true);
    try {
      const response = await api.generateInviteCode(circleAddress, 720);
      const inviteCode = response.shortCode || response.inviteCode;
      const link = inviteCode ? `${window.location.origin}/join/${inviteCode}` : '';

      if (inviteCode) {
        setInviteLink(link);
        showToast('Invite link generated!', 'success');
      } else {
        throw new Error('No invite code returned');
      }
    } catch (error) {
      const localInviteCode = buildLocalInviteCode(circleAddress, parseInt(circleId));
      const fallbackLink = `${window.location.origin}/join/${localInviteCode}`;
      setInviteLink(fallbackLink);
      showToast('Generated local invite link', 'success');
    } finally {
      setGeneratingInvite(false);
    }
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      showToast('Invite link copied to clipboard!', 'success');
    } catch {
      showToast('Failed to copy link.', 'error');
    }
  };

  const handleMarkDefaulter = async (memberAddress: string) => {
    if (!circleData || !circleAddress || !ethereum) return;
    setMarkingDefaulter(true);
    try {
      const walletClient = createWalletClient({
        transport: custom(ethereum),
        chain: arcTestnet,
      });
      const publicClient = createPublicClient({
        transport: custom(ethereum),
        chain: arcTestnet,
      });

      const account = (await walletClient.getAddresses())[0];
      if (!account) throw new Error('No wallet address found');

      const hash = await walletClient.writeContract({
        address: circleAddress as `0x${string}`,
        abi: TRUST_CIRCLE_ABI,
        functionName: 'markDefaulter',
        args: [memberAddress as `0x${string}`],
        account,
      });

      await publicClient.waitForTransactionReceipt({ hash });
      showToast('Member marked as defaulter. Circle is paused.', 'success');
      setRefreshIndex((current) => current + 1);
    } catch (error) {
      logError('Failed to mark defaulter:', error);
      showToast(getUserErrorMessage('Unable to mark defaulter. Please try again.'), 'error');
    } finally {
      setMarkingDefaulter(false);
    }
  };

  const handleVoteOnResolution = async (continueCircle: boolean) => {
    if (!circleData || !circleAddress || !ethereum) return;
    setVoting(true);
    try {
      const walletClient = createWalletClient({
        transport: custom(ethereum),
        chain: arcTestnet,
      });
      const publicClient = createPublicClient({
        transport: custom(ethereum),
        chain: arcTestnet,
      });

      const account = (await walletClient.getAddresses())[0];
      if (!account) throw new Error('No wallet address found');

      const hash = await walletClient.writeContract({
        address: circleAddress as `0x${string}`,
        abi: TRUST_CIRCLE_ABI,
        functionName: 'voteOnDefaultResolution',
        args: [continueCircle],
        account,
      });

      await publicClient.waitForTransactionReceipt({ hash });
      showToast('Vote cast successfully.', 'success');
      setRefreshIndex((current) => current + 1);
    } catch (error) {
      logError('Failed to cast vote:', error);
      showToast(getUserErrorMessage('Unable to cast vote. Please try again.'), 'error');
    } finally {
      setVoting(false);
    }
  };

  const isOrganizer = walletAddress?.toLowerCase() === circleData?.organizer?.toLowerCase();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="section-title">Circle Detail</h1>
          <p className="section-subtitle">Review contributions, members, and payout order.</p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/home')}>
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </Button>
      </div>

      {loading ? (
        <Card>
          <LoadingSkeleton variant="card" count={2} className="h-44" />
        </Card>
      ) : !circleData ? (
        <Card title="Unable to load circle" subtitle="The circle may not exist or network calls failed.">
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-700/50 dark:bg-rose-950/40 dark:text-rose-200">
            <ExclamationTriangleIcon className="h-4 w-4" />
            Try refreshing from Home.
          </div>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card title={circleData.name} subtitle={circleData.description || 'Onchain rotating savings circle'}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={circleData.status} />
                <AddressDisplay address={circleAddress} />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border bg-app-elevated p-3">
                  <p className="text-xs uppercase tracking-wide text-muted">Contribution</p>
                  <p className="mt-1 text-lg font-bold text-[color:var(--text-primary)]">
                    {formatUsd(circleData.contributionAmount)}
                  </p>
                </div>
                <div className="rounded-xl border bg-app-elevated p-3">
                  <p className="text-xs uppercase tracking-wide text-muted">Schedule</p>
                  <p className="mt-1 text-lg font-bold text-[color:var(--text-primary)]">
                    {formatCycleDuration(circleData.cycleDuration)}
                  </p>
                </div>
                <div className="rounded-xl border bg-app-elevated p-3">
                  <p className="text-xs uppercase tracking-wide text-muted">Members</p>
                  <p className="mt-1 text-lg font-bold text-[color:var(--text-primary)]">{circleData.memberCount}</p>
                </div>
                <div className="rounded-xl border bg-app-elevated p-3">
                  <p className="text-xs uppercase tracking-wide text-muted">Current Cycle</p>
                  <p className="mt-1 text-lg font-bold text-[color:var(--text-primary)]">
                    {circleData.currentCycle + 1}
                  </p>
                </div>
              </div>
            </Card>

            <Card title="Cycle Progress" subtitle="Time remaining in current contribution window.">
              <div className="space-y-4">
                <div className="rounded-xl border bg-app-elevated p-3">
                  <p className="text-xs uppercase tracking-wide text-muted">{cycleProgressLabel}</p>
                  <p className={cycleProgressValueClass}>
                    <ClockIcon className="h-5 w-5" />
                    {timeLeftLabel}
                  </p>
                </div>

                <div className="rounded-xl border bg-app-elevated p-3">
                  <p className="text-xs uppercase tracking-wide text-muted">Organizer</p>
                  <AddressDisplay address={circleData.organizer} className="mt-1" />
                </div>

                {isMember && circleData.status === 'Active' && !hasContributed && !cycleDeadlinePassed ? (
                  <Button fullWidth onClick={() => setShowConfirmContribution(true)} loading={contributing}>
                    <CurrencyDollarIcon className="h-4 w-4" />
                    Contribute {formatUsd(circleData.contributionAmount)}
                  </Button>
                ) : null}

                {isMember && circleData.status === 'Active' && !hasContributed && cycleDeadlinePassed ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
                    Contribution deadline has passed for this cycle.
                  </div>
                ) : null}

                {hasContributed ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                    You already contributed this cycle.
                  </div>
                ) : null}

                {canDistributePayout ? (
                  <Button
                    fullWidth
                    variant="secondary"
                    onClick={() => setShowConfirmDistribute(true)}
                    loading={distributingPayout}
                  >
                    <BanknotesIcon className="h-4 w-4" />
                    Distribute Payout
                  </Button>
                ) : null}

                {circleData.status === 'Pending' && isOrganizer && (
                  <div className="space-y-2">
                    <Button fullWidth onClick={handleGenerateInvite} loading={generatingInvite}>
                      <LinkIcon className="h-4 w-4" />
                      Generate Invite Link
                    </Button>
                    {inviteLink && (
                      <div className="flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 p-3 dark:border-primary-700/60 dark:bg-primary-950/40">
                        <input
                          type="text"
                          readOnly
                          value={inviteLink}
                          className="flex-1 truncate bg-transparent text-sm text-primary-800 dark:text-primary-200"
                        />
                        <Button variant="ghost" size="sm" onClick={copyInviteLink}>
                          Copy
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            {circleData.status === 'Paused' && (
              <Card title="Default Resolution" subtitle="A member failed to contribute. Vote to resolve." className="col-span-full border-rose-200 bg-rose-50/50 dark:border-rose-900/30 dark:bg-rose-950/20">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-4 text-sm text-rose-800 dark:text-rose-200">
                    <ExclamationTriangleIcon className="h-5 w-5" />
                    <span>Defaulter: <AddressDisplay address={circleData.currentDefaulter || ''} className="inline-block" /></span>
                  </div>

                  <div className="flex gap-4 p-4 border rounded-xl bg-app-elevated">
                    <div className="flex-1 text-center">
                      <p className="text-lg font-bold">{circleData.continueVotes}</p>
                      <p className="text-xs uppercase text-muted">Continue</p>
                    </div>
                    <div className="flex-1 text-center border-l border-r">
                      <p className="text-lg font-bold">{circleData.dissolveVotes}</p>
                      <p className="text-xs uppercase text-muted">Dissolve</p>
                    </div>
                    <div className="flex-1 text-center">
                      <p className="text-lg font-bold">{circleData.memberCount}</p>
                      <p className="text-xs uppercase text-muted">Total Members</p>
                    </div>
                  </div>

                  {isMember && !circleData.hasVoted ? (
                    <div className="grid sm:grid-cols-2 gap-2">
                      <Button fullWidth onClick={() => handleVoteOnResolution(true)} loading={voting}>
                        Vote to Continue
                      </Button>
                      <Button fullWidth variant="secondary" onClick={() => handleVoteOnResolution(false)} loading={voting} className="!text-rose-600 dark:!text-rose-400">
                        Vote to Dissolve
                      </Button>
                    </div>
                  ) : isMember ? (
                    <div className="text-center p-3 text-sm rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-400">
                      You have already cast your vote. Waiting for others...
                    </div>
                  ) : null}
                </div>
              </Card>
            )}

            <Card title="Member Contributions" subtitle="Current cycle status by member.">
              {members.length === 0 ? (
                <EmptyState
                  icon={UserGroupIcon}
                  title="No members found"
                  description="Member list has not been populated yet."
                />
              ) : (
                <ul className="space-y-2">
                  {members.map((member) => (
                      <li
                        key={member}
                        className="flex items-center justify-between rounded-xl border bg-app-elevated px-3 py-2.5 flex-wrap gap-2"
                      >
                        <AddressDisplay address={member} />
                        <div className="flex items-center gap-2">
                          <StatusBadge status={contributions[member] ? 'Active' : 'Pending'} />
                          {isMember && circleData.status === 'Active' && !contributions[member] && gracePeriodPassed && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="!py-1 !text-xs bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-400"
                              onClick={() => handleMarkDefaulter(member)}
                              loading={markingDefaulter}
                            >
                              Mark Defaulter
                            </Button>
                          )}
                        </div>
                      </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Payout Order" subtitle="Recipient queue by cycle.">
              {payoutOrder.length === 0 ? (
                <EmptyState
                  icon={CurrencyDollarIcon}
                  title="No payout schedule yet"
                  description="Payout order will appear as soon as the circle starts."
                />
              ) : (
                <ol className="space-y-2">
                  {payoutOrder.map((recipient, index) => {
                    const payoutStatus =
                      index < circleData.currentCycle
                        ? 'Paid'
                        : index === circleData.currentCycle && circleData.status === 'Active'
                          ? 'Current recipient'
                          : 'Upcoming';

                    const payoutStatusClass =
                      payoutStatus === 'Paid'
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : payoutStatus === 'Current recipient'
                          ? 'text-primary-700 dark:text-primary-300'
                          : 'text-muted';

                    return (
                      <li
                        key={`${recipient}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-xl border bg-app-elevated px-3 py-2.5"
                      >
                        <div>
                          <span className="text-sm font-semibold text-[color:var(--text-primary)]">
                            Cycle {index + 1}
                          </span>
                          <p className={`text-xs font-semibold ${payoutStatusClass}`}>{payoutStatus}</p>
                        </div>
                        <AddressDisplay address={recipient} />
                      </li>
                    );
                  })}
                </ol>
              )}
            </Card>
          </section>
        </>
      )}

      <ConfirmDialog
        isOpen={showConfirmContribution}
        onClose={() => setShowConfirmContribution(false)}
        onConfirm={handleContribute}
        title="Confirm contribution"
        message={`You are about to contribute ${circleData ? formatUsd(circleData.contributionAmount) : '$0.00'} to this cycle.`}
        confirmLabel="Approve & Contribute"
        loading={contributing}
      />
      <ConfirmDialog
        isOpen={showConfirmDistribute}
        onClose={() => setShowConfirmDistribute(false)}
        onConfirm={handleDistributePayout}
        title="Distribute payout?"
        message="This will transfer the pooled funds for this cycle to the next payout recipient."
        confirmLabel="Distribute"
        loading={distributingPayout}
      />
    </div>
  );
}
