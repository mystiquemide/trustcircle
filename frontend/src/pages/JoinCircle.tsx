import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createPublicClient, createWalletClient, custom } from 'viem';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { TRUST_CIRCLE_ABI } from '../contracts/TrustCircle';
import { TRUST_CIRCLE_FACTORY_ABI } from '../contracts/TrustCircleFactory';
import { CONTRACT_ADDRESSES, TRUST_CIRCLE_FACTORY_ADDRESS } from '../contracts/addresses';
import { arcTestnet } from '../lib/arcChain';
import { api } from '../lib/api';
import { trackCircleLocally } from '../lib/circle';
import { getUserErrorMessage, logError } from '../lib/errors';
import { getLocalInvite } from '../lib/invites';
import { formatCycleDuration, formatUsd, truncateAddress } from '../lib/format';
import { Button, Card, ConfirmDialog, StatusBadge } from '../components/common';
import { LoadingSkeleton } from '../components/feedback';
import { useToast } from '../providers/ToastProvider';

interface CirclePreview {
  name: string;
  memberCount: number;
  contributionAmount: number;
  requiredCollateral: number;
  supportsCollateral: boolean;
  cycleDuration: number;
  status: number;
}

const isNumericId = (value: string) => /^\d+$/.test(value);
const isAddressInvite = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);

export default function JoinCircle() {
  const { inviteCode = '' } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [circleAddress, setCircleAddress] = useState<string>('');
  const [circleId, setCircleId] = useState<string>('');
  const [circleData, setCircleData] = useState<CirclePreview | null>(null);
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [collateralLocked, setCollateralLocked] = useState(0);
  const [balanceCheckFailed, setBalanceCheckFailed] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!inviteCode) {
      return;
    }

    const loadCircle = async () => {
      setLoading(true);
      setCollateralLocked(0);
      try {
        if (!window.ethereum) {
          throw new Error('No wallet detected. Install a wallet to continue.');
        }

        const publicClient = createPublicClient({
          transport: custom(window.ethereum),
          chain: arcTestnet,
        });

        let resolvedAddress = '';
        let resolvedCircleId = inviteCode;

        if (isAddressInvite(inviteCode)) {
          resolvedAddress = inviteCode;
          resolvedCircleId = inviteCode;
        } else if (isNumericId(inviteCode)) {
          const address = await publicClient.readContract({
            address: TRUST_CIRCLE_FACTORY_ADDRESS as `0x${string}`,
            abi: TRUST_CIRCLE_FACTORY_ABI,
            functionName: 'circles',
            args: [BigInt(inviteCode)],
          });
          resolvedAddress = address as string;
        } else {
          try {
            const inviteData = await api.resolveInviteCode(inviteCode);
            resolvedAddress = inviteData.contractAddress;

            let foundId = '0';
            for (let i = 0; i < 100; i += 1) {
              try {
                const candidate = (await publicClient.readContract({
                  address: TRUST_CIRCLE_FACTORY_ADDRESS as `0x${string}`,
                  abi: TRUST_CIRCLE_FACTORY_ABI,
                  functionName: 'circles',
                  args: [BigInt(i)],
                })) as string;

                if (candidate.toLowerCase() === resolvedAddress.toLowerCase()) {
                  foundId = String(i);
                  break;
                }

                if (!candidate || candidate === '0x0000000000000000000000000000000000000000') {
                  break;
                }
              } catch {
                break;
              }
            }

            resolvedCircleId = foundId;
          } catch {
            const localInvite = getLocalInvite(inviteCode);
            if (!localInvite) {
              throw new Error('Invalid or expired invite code.');
            }

            resolvedAddress = localInvite.contractAddress;
            resolvedCircleId = String(localInvite.circleId);
          }
        }

        if (!resolvedAddress || resolvedAddress === '0x0000000000000000000000000000000000000000') {
          throw new Error('Invalid or expired invite code.');
        }

        setCircleAddress(resolvedAddress);
        setCircleId(resolvedCircleId);

        const [name, memberCount, contributionAmount, cycleDuration, status, requiredCollateralResult] = await Promise.all([
          publicClient.readContract({
            address: resolvedAddress as `0x${string}`,
            abi: TRUST_CIRCLE_ABI,
            functionName: 'name',
          }),
          publicClient.readContract({
            address: resolvedAddress as `0x${string}`,
            abi: TRUST_CIRCLE_ABI,
            functionName: 'memberCount',
          }),
          publicClient.readContract({
            address: resolvedAddress as `0x${string}`,
            abi: TRUST_CIRCLE_ABI,
            functionName: 'contributionAmount',
          }),
          publicClient.readContract({
            address: resolvedAddress as `0x${string}`,
            abi: TRUST_CIRCLE_ABI,
            functionName: 'cycleDuration',
          }),
          publicClient.readContract({
            address: resolvedAddress as `0x${string}`,
            abi: TRUST_CIRCLE_ABI,
            functionName: 'status',
          }),
          publicClient.readContract({
            address: resolvedAddress as `0x${string}`,
            abi: TRUST_CIRCLE_ABI,
            functionName: 'requiredCollateral',
          }).catch(() => null),
        ]);

        const supportsCollateral = requiredCollateralResult !== null && Number(requiredCollateralResult) > 0;
        const requiredCollateral = supportsCollateral ? Number(requiredCollateralResult) / 10 ** 6 : 0;

        setCircleData({
          name: name as string,
          memberCount: Number(memberCount),
          contributionAmount: Number(contributionAmount) / 10 ** 6,
          requiredCollateral,
          supportsCollateral,
          cycleDuration: Number(cycleDuration),
          status: Number(status),
        });

        const accounts = (await window.ethereum.request({ method: 'eth_accounts' })) as string[];
        const activeAddress = accounts[0];

        if (activeAddress) {
          try {
            const memberCheck = await publicClient.readContract({
              address: resolvedAddress as `0x${string}`,
              abi: TRUST_CIRCLE_ABI,
              functionName: 'isMember',
              args: [activeAddress as `0x${string}`],
            });
            setIsMember(Boolean(memberCheck));
          } catch {
            setIsMember(false);
          }

          if (supportsCollateral) {
            try {
              const locked = await publicClient.readContract({
                address: resolvedAddress as `0x${string}`,
                abi: TRUST_CIRCLE_ABI,
                functionName: 'collateralLocked',
                args: [activeAddress as `0x${string}`],
              });

              setCollateralLocked(Number(locked) / 10 ** 6);
            } catch {
              setCollateralLocked(0);
            }
          } else {
            setCollateralLocked(0);
          }

          try {
            const balance = await publicClient.readContract({
              address: CONTRACT_ADDRESSES.USDC as `0x${string}`,
              abi: [
                {
                  constant: true,
                  inputs: [{ name: '_owner', type: 'address' }],
                  name: 'balanceOf',
                  outputs: [{ name: 'balance', type: 'uint256' }],
                  type: 'function',
                },
              ],
              functionName: 'balanceOf',
              args: [activeAddress as `0x${string}`],
            });

            setUsdcBalance(Number(balance) / 10 ** 6);
            setBalanceCheckFailed(false);
          } catch {
            setBalanceCheckFailed(true);
          }
        }
      } catch (error) {
        logError('Failed to load invite:', error);
        showToast(getUserErrorMessage('Unable to load this invite. Please check the link and try again.'), 'error');
        setCircleData(null);
      } finally {
        setLoading(false);
      }
    };

    void loadCircle();
  }, [inviteCode, showToast]);

  const statusLabel = useMemo(() => {
    switch (circleData?.status) {
      case 0:
        return 'Pending';
      case 1:
        return 'Active';
      case 2:
        return 'Paused';
      case 3:
        return 'Resolved';
      case 4:
        return 'Dissolved';
      default:
        return 'Unknown';
    }
  }, [circleData?.status]);

  const needsCollateralLock = Boolean(
    circleData?.supportsCollateral && collateralLocked < circleData.requiredCollateral
  );
  const balanceRequiredToJoin = needsCollateralLock ? circleData?.requiredCollateral ?? 0 : 0;
  const hasEnoughUSDC = !needsCollateralLock || usdcBalance >= balanceRequiredToJoin;
  const canJoin = Boolean(circleData && !isMember && circleData.status === 0 && (hasEnoughUSDC || balanceCheckFailed));

  const handleJoin = async () => {
    if (!circleData) {
      return;
    }

    setJoining(true);
    try {
      if (!window.ethereum) {
        throw new Error('Wallet not connected');
      }

      const walletClient = createWalletClient({
        transport: custom(window.ethereum),
        chain: arcTestnet,
      });

      const publicClient = createPublicClient({
        transport: custom(window.ethereum),
        chain: arcTestnet,
      });

      const account = (await walletClient.getAddresses())[0];
      if (!account) {
        throw new Error('No wallet address found');
      }

      if (needsCollateralLock) {
        const collateralAmount = BigInt(Math.round(circleData.requiredCollateral * 10 ** 6));

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
          args: [circleAddress as `0x${string}`, collateralAmount],
          account,
        });

        await publicClient.waitForTransactionReceipt({ hash: approveHash });

        const lockHash = await walletClient.writeContract({
          address: circleAddress as `0x${string}`,
          abi: TRUST_CIRCLE_ABI,
          functionName: 'lockCollateral',
          account,
        });

        await publicClient.waitForTransactionReceipt({ hash: lockHash });
      }

      const joinHash = await walletClient.writeContract({
        address: circleAddress as `0x${string}`,
        abi: TRUST_CIRCLE_ABI,
        functionName: 'joinCircle',
        account,
      });

      await publicClient.waitForTransactionReceipt({ hash: joinHash });

      if (!isAddressInvite(inviteCode)) {
        void api.recordInviteJoin(inviteCode, account).catch((error) => {
          console.error('Failed to record invite join:', error);
        });
      }

      trackCircleLocally(account, circleAddress);
      void api.trackCircle(account, circleAddress).catch((error) => {
        console.error('Failed to track circle:', error);
      });

      window.localStorage.removeItem('trustcircle_home_cache');
      setIsMember(true);

      showToast('Joined circle successfully.', 'success');
      navigate(`/circle/${circleId || circleAddress}`);
    } catch (error) {
      logError('Failed to join circle:', error);
      showToast(getUserErrorMessage('Unable to join circle. Please try again.'), 'error');
    } finally {
      setJoining(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="section-title">Join Circle</h1>
          <p className="section-subtitle">Review terms and join once your wallet is ready.</p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/home')}>
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </Button>
      </div>

      {loading ? (
        <Card>
          <LoadingSkeleton variant="card" className="h-48" />
        </Card>
      ) : !circleData ? (
        <Card title="Invalid Invite" subtitle="We could not resolve this invite code.">
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-700/50 dark:bg-rose-950/40 dark:text-rose-200">
            <ExclamationTriangleIcon className="h-5 w-5" />
            <p className="text-sm">Check the invite link and try again.</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card title={circleData.name} subtitle={`Circle contract: ${truncateAddress(circleAddress, 8, 6)}`}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">Status</p>
              <StatusBadge status={statusLabel} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border bg-app-elevated p-3">
                <p className="text-xs uppercase tracking-wide text-muted">Contribution</p>
                <p className="mt-1 text-lg font-bold text-[color:var(--text-primary)]">
                  {formatUsd(circleData.contributionAmount)}
                </p>
              </div>
              {circleData.supportsCollateral ? (
                <div className="rounded-xl border bg-app-elevated p-3">
                  <p className="text-xs uppercase tracking-wide text-muted">Required Collateral</p>
                  <p className="mt-1 text-lg font-bold text-[color:var(--text-primary)]">
                    {formatUsd(circleData.requiredCollateral)}
                  </p>
                </div>
              ) : null}
              <div className="rounded-xl border bg-app-elevated p-3">
                <p className="text-xs uppercase tracking-wide text-muted">Members</p>
                <p className="mt-1 text-lg font-bold text-[color:var(--text-primary)]">{circleData.memberCount}</p>
              </div>
              <div className="rounded-xl border bg-app-elevated p-3 sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-muted">Schedule</p>
                <p className="mt-1 text-lg font-bold text-[color:var(--text-primary)]">
                  {formatCycleDuration(circleData.cycleDuration)}
                </p>
              </div>
            </div>
          </Card>

          <Card title="Ready to Join" subtitle="Approve USDC and sign join transaction.">
            <div className="space-y-4">
              <div className="rounded-xl border bg-app-elevated p-3">
                <p className="text-xs uppercase tracking-wide text-muted">Your USDC Balance</p>
                <p className="mt-1 text-lg font-bold text-[color:var(--text-primary)]">
                  {balanceCheckFailed ? 'Unable to verify' : formatUsd(usdcBalance)}
                </p>
              </div>

              {circleData.supportsCollateral ? (
                <div className="rounded-xl border bg-app-elevated p-3">
                  <p className="text-xs uppercase tracking-wide text-muted">Collateral Locked</p>
                  <p className="mt-1 text-lg font-bold text-[color:var(--text-primary)]">
                    {formatUsd(collateralLocked)}
                  </p>
                </div>
              ) : null}

              {isMember ? (
                <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <CheckCircleIcon className="h-5 w-5" />
                  You are already a member of this circle.
                </div>
              ) : null}

              {!hasEnoughUSDC && !balanceCheckFailed && !isMember ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
                  <p>
                    Balance is below the required {circleData.supportsCollateral ? 'collateral' : 'join amount'}.
                  </p>
                  <a
                    href="https://faucet.circle.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 font-semibold text-amber-700 underline decoration-amber-400 underline-offset-2 transition hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
                  >
                    Get Test USDC
                    <span aria-hidden="true">&rarr;</span>
                  </a>
                </div>
              ) : null}

              <Button
                fullWidth
                onClick={() => setShowConfirm(true)}
                disabled={!canJoin}
                loading={joining}
              >
                <UserGroupIcon className="h-4 w-4" />
                Join Circle
              </Button>
            </div>
          </Card>
        </div>
      )}

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleJoin}
        title="Join this circle?"
        message={
          circleData?.supportsCollateral
            ? `You will approve and lock ${formatUsd(circleData.requiredCollateral)} as collateral before joining.`
            : 'You will join this pending circle.'
        }
        confirmLabel={circleData?.supportsCollateral ? 'Approve, Lock & Join' : 'Join Circle'}
        loading={joining}
      />
    </div>
  );
}
