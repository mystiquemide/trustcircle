import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPublicClient, createWalletClient, custom, decodeEventLog } from 'viem';
import { ArrowLeftIcon, ClipboardDocumentIcon, LinkIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { TRUST_CIRCLE_FACTORY_ABI } from '../contracts/TrustCircleFactory';
import { TRUST_CIRCLE_FACTORY_ADDRESS } from '../contracts/addresses';
import { arcTestnet } from '../lib/arcChain';
import { api } from '../lib/api';
import { trackCircleLocally } from '../lib/circle';
import { buildLocalInviteCode, saveLocalInvite } from '../lib/invites';
import { formatUsd } from '../lib/format';
import { Button, Card, ConfirmDialog } from '../components/common';
import { Input, Select } from '../components/forms';
import { useToast } from '../providers/ToastProvider';

interface CircleFormValues {
  name: string;
  memberCount: number;
  contributionAmount: string;
  cycleDuration: number;
  payoutOrderMethod: number;
  isPublic: boolean;
}

const initialValues: CircleFormValues = {
  name: '',
  memberCount: 3,
  contributionAmount: '50',
  cycleDuration: 604800,
  payoutOrderMethod: 0,
  isPublic: false,
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function CreateCircle() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [values, setValues] = useState<CircleFormValues>(initialValues);
  const [loading, setLoading] = useState(false);
  const [isAborted, setIsAborted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [newCircleId, setNewCircleId] = useState<number | null>(null);

  const parsedContributionAmount = Number.parseFloat(values.contributionAmount);
  const contributionAmount = Number.isFinite(parsedContributionAmount) ? parsedContributionAmount : 0;

  const requiredCollateral = contributionAmount * values.memberCount;

  const handleInputChange = <K extends keyof CircleFormValues>(key: K, value: CircleFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const handleCopyInviteLink = async () => {
    if (!inviteLink) {
      return;
    }

    try {
      await window.navigator.clipboard.writeText(`${window.location.origin}${inviteLink}`);
      showToast('Invite link copied.', 'success');
    } catch {
      showToast('Unable to copy invite link automatically.', 'warning');
    }
  };

  const createCircle = async () => {
    setLoading(true);
    setIsAborted(false);
    setInviteLink('');
    setNewCircleId(null);

    try {
      if (contributionAmount < 1) {
        throw new Error('Contribution amount must be at least 1 USDC.');
      }

      if (!window.ethereum) {
        throw new Error('No wallet found');
      }

      const walletClient = createWalletClient({
        transport: custom(window.ethereum),
        chain: arcTestnet,
      });

      const publicClient = createPublicClient({
        transport: custom(window.ethereum),
        chain: arcTestnet,
        pollingInterval: 10_000,
      });

      const account = (await walletClient.getAddresses())[0];
      if (!account) {
        throw new Error('No wallet address found');
      }

      let chainNonce: number | undefined;
      try {
        chainNonce = await publicClient.getTransactionCount({
          address: account,
          blockTag: 'pending',
        });
      } catch (nonceError) {
        console.warn('Could not read current wallet nonce before creation:', nonceError);
      }

      let predictedCircleId: number | null = null;
      try {
        predictedCircleId = Number(
          await publicClient.readContract({
            address: TRUST_CIRCLE_FACTORY_ADDRESS as `0x${string}`,
            abi: TRUST_CIRCLE_FACTORY_ABI,
            functionName: 'circleIdCounter',
          })
        );
      } catch (counterError) {
        console.warn('Could not read next circle id before creation:', counterError);
      }

      const hash = await walletClient.writeContract({
        address: TRUST_CIRCLE_FACTORY_ADDRESS as `0x${string}`,
        abi: TRUST_CIRCLE_FACTORY_ABI,
        functionName: 'createCircle',
        args: [
          values.name,
          BigInt(values.memberCount),
          BigInt(Math.round(contributionAmount * 10 ** 6)),
          BigInt(values.cycleDuration),
          values.payoutOrderMethod,
          BigInt(Math.round(requiredCollateral * 10 ** 6)),
        ],
        account,
        nonce: chainNonce,
      });

      console.log('Transaction hash:', hash);
      const submittedTransaction = await publicClient.getTransaction({ hash }).catch(() => null);

      if (
        submittedTransaction &&
        chainNonce !== undefined &&
        Number(submittedTransaction.nonce) > chainNonce
      ) {
        throw new Error(
          `Wallet submitted nonce ${submittedTransaction.nonce}, but Arc is waiting for nonce ${chainNonce}. Reset the wallet account activity/nonce and try again.`
        );
      }

      let receipt: Awaited<ReturnType<typeof publicClient.waitForTransactionReceipt>> | null = null;
      let receiptError: unknown = null;

      try {
        receipt = await publicClient.waitForTransactionReceipt({
          hash,
          timeout: 300_000,
          pollingInterval: 10_000,
        });
      } catch (error) {
        receiptError = error;
      }

      let circleId: number | null = null;
      let circleAddress = '';

      if (receipt) {
        console.log('Receipt status:', receipt.status);

        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: TRUST_CIRCLE_FACTORY_ABI,
              data: log.data,
              topics: log.topics,
            });

            if (decoded.eventName === 'CircleCreated') {
              circleId = Number((decoded.args as any).circleId);
              console.log('Detected circleId from logs:', circleId);
              break;
            }
          } catch (e) {
            // ignore non-matching logs
          }
        }
      } else {
        console.warn('Receipt polling timed out. Attempting to recover circle from factory state.', receiptError);
      }

      const resolveCircleAddress = async (id: number) => {
        for (let attempt = 0; attempt < 36; attempt++) {
          try {
            const resolved = (await publicClient.readContract({
              address: TRUST_CIRCLE_FACTORY_ADDRESS as `0x${string}`,
              abi: TRUST_CIRCLE_FACTORY_ABI,
              functionName: 'circles',
              args: [BigInt(id)],
            })) as string;
            if (resolved && resolved !== ZERO_ADDRESS) {
              return resolved;
            }
          } catch {
            // wallet RPC may lag the submitted transaction briefly
          }
          await sleep(5000);
        }

        return '';
      };

      if (circleId === null && predictedCircleId !== null) {
        const recoveredAddress = await resolveCircleAddress(predictedCircleId);
        if (recoveredAddress) {
          circleId = predictedCircleId;
          circleAddress = recoveredAddress;
        }
      }

      if (circleId === null) {
        throw new Error(`Transaction submitted but the circle was not confirmed yet. Hash: ${hash}`);
      }

      // Best-effort address resolution — the RPC may be slow to sync after writes.
      // This is NOT fatal: we already have circleId from the event logs which is
      // all we need for navigation. The CircleDetail page will resolve the address.
      try {
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            const resolved = (await publicClient.readContract({
              address: TRUST_CIRCLE_FACTORY_ADDRESS as `0x${string}`,
              abi: TRUST_CIRCLE_FACTORY_ABI,
              functionName: 'circles',
              args: [BigInt(circleId)],
            })) as string;
            if (resolved && resolved !== '0x0000000000000000000000000000000000000000') {
              circleAddress = resolved;
              break;
            }
          } catch {
            // RPC not ready yet, will retry
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
      } catch {
        // Completely non-fatal — address will be resolved by CircleDetail page
      }

      if (!circleAddress) {
        circleAddress = await resolveCircleAddress(circleId);
      }

      console.log('Circle creation complete. ID:', circleId, 'Address:', circleAddress || '(pending resolution)');

      showToast('Circle created successfully.', 'success');
      window.localStorage.removeItem('trustcircle_home_cache');
      setNewCircleId(circleId);

      // Backend metadata sync — best effort, uses address if available
      if (circleAddress) {
        trackCircleLocally(account, circleAddress);
        void api.trackCircle(account, circleAddress).catch((error) => {
          console.warn('Failed to track created circle:', error);
        });

        try {
          await api.saveCircleMetadata(
            circleAddress,
            values.name,
            `Created with ${values.memberCount} members`,
            values.isPublic,
            circleId
          );
          const inviteResponse = await api.generateInviteCode(circleAddress, 720);
          setInviteLink(`/join/${inviteResponse.shortCode || circleId}`);
        } catch (apiError) {
          console.warn('Backend metadata sync failed (non-fatal):', apiError);
          const localInviteCode = buildLocalInviteCode(circleAddress, circleId);
          saveLocalInvite(localInviteCode, circleAddress, circleId);
          setInviteLink(`/join/${localInviteCode}`);
        }
      } else {
        // No address yet — generate a simple invite using circleId only
        setInviteLink(`/join/${circleId}`);
      }
    } catch (error) {
      if (isAborted) return;
      const message = error instanceof Error ? error.message : 'Failed to create circle';
      showToast(message, 'error');
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  const canSubmit = values.name.trim().length > 1 && values.memberCount >= 3 && contributionAmount >= 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="section-title">Create Circle</h1>
          <p className="section-subtitle">Start a new rotating savings group with transparent contribution rules.</p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/home')}>
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </Button>
      </div>

      <Card title="Circle Setup" subtitle="Choose member count, contribution amount, and cycle schedule.">
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) {
              setShowConfirm(true);
            }
          }}
        >
          <Input
            label="Circle Name"
            placeholder="Arc's Builders Circle"
            value={values.name}
            onChange={(event) => handleInputChange('name', event.target.value)}
            required
          />

          <Input
            label="Members (3-20)"
            type="number"
            min={3}
            max={20}
            value={values.memberCount}
            onChange={(event) => handleInputChange('memberCount', Number(event.target.value))}
            required
          />

          <Input
            label="Contribution per cycle (USDC)"
            type="number"
            min={1}
            step="0.01"
            inputMode="decimal"
            value={values.contributionAmount}
            onChange={(event) => handleInputChange('contributionAmount', event.target.value)}
            required
          />

          <div className="rounded-xl border bg-app-elevated p-3">
            <p className="text-xs uppercase tracking-wide text-muted">Required Collateral</p>
            <p className="mt-1 text-lg font-bold text-[color:var(--text-primary)]">
              {formatUsd(requiredCollateral)}
            </p>
          </div>

          <Select
            label="Cycle Duration"
            value={values.cycleDuration}
            onChange={(event) => handleInputChange('cycleDuration', Number(event.target.value))}
          >
            <option value={604800}>Weekly</option>
            <option value={1209600}>Biweekly</option>
            <option value={2629746}>Monthly</option>
          </Select>

          <Select
            label="Payout Order"
            value={values.payoutOrderMethod}
            onChange={(event) => handleInputChange('payoutOrderMethod', Number(event.target.value))}
          >
            <option value={0}>Random draw</option>
            <option value={1}>Manual organizer assignment</option>
          </Select>

          <div className="md:col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="isPublic"
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              checked={values.isPublic}
              onChange={(event) => handleInputChange('isPublic', event.target.checked)}
            />
            <label htmlFor="isPublic" className="text-sm text-gray-700 dark:text-gray-300">
              Make circle public (discoverable by others)
            </label>
          </div>

          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" loading={loading} disabled={!canSubmit}>
              <SparklesIcon className="h-4 w-4" />
              Create Circle
            </Button>
            {loading && (
              <Button
                variant="secondary"
                onClick={() => {
                  setIsAborted(true);
                  setLoading(false);
                  showToast('Circle creation cancelled.', 'info');
                }}
                className="ml-2"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>

      {inviteLink ? (
        <Card title="Invite Ready" subtitle="Share this link with your trusted members.">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-app-elevated p-3">
            <LinkIcon className="h-4 w-4 text-primary-600 dark:text-primary-300" />

            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wide text-muted">Shareable Invite Link</p>
              <a
                href={inviteLink}
                className="mt-1 block break-all text-sm font-semibold text-primary-700 underline decoration-primary-300 underline-offset-2 dark:text-primary-200"
              >
                {window.location.origin}
                {inviteLink}
              </a>
            </div>

            <Button variant="outline" size="sm" onClick={handleCopyInviteLink}>
              <ClipboardDocumentIcon className="h-4 w-4" />
              Copy Link
            </Button>

            {newCircleId !== null ? (
              <Button variant="secondary" size="sm" onClick={() => navigate(`/circle/${newCircleId}`)}>
                View Circle
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={createCircle}
        title="Create this circle?"
        message={`This will create an onchain circle with ${values.memberCount} members and ${contributionAmount} USDC per cycle.`}
        confirmLabel="Create Circle"
        loading={loading}
      />
    </div>
  );
}
