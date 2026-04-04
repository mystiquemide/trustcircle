import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPublicClient, createWalletClient, custom, parseAbiItem } from 'viem';
import { ArrowLeftIcon, ClipboardDocumentIcon, LinkIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { TRUST_CIRCLE_FACTORY_ABI } from '../contracts/TrustCircleFactory';
import { TRUST_CIRCLE_FACTORY_ADDRESS } from '../contracts/addresses';
import { arcTestnet } from '../lib/arcChain';
import { api } from '../lib/api';
import { buildLocalInviteCode, saveLocalInvite } from '../lib/invites';
import { Button, Card, ConfirmDialog } from '../components/common';
import { Input, Select } from '../components/forms';
import { useToast } from '../providers/ToastProvider';

interface CircleFormValues {
  name: string;
  memberCount: number;
  contributionAmount: string;
  cycleDuration: number;
  payoutOrderMethod: number;
}

const initialValues: CircleFormValues = {
  name: '',
  memberCount: 3,
  contributionAmount: '50',
  cycleDuration: 604800,
  payoutOrderMethod: 0,
};

const circleCreatedEvent = parseAbiItem('event CircleCreated(uint256 circleId, address organizer)');

export default function CreateCircle() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [values, setValues] = useState<CircleFormValues>(initialValues);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [newCircleId, setNewCircleId] = useState<number | null>(null);

  const parsedContributionAmount = Number.parseFloat(values.contributionAmount);
  const contributionAmount = Number.isFinite(parsedContributionAmount) ? parsedContributionAmount : 0;

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
      });

      const account = (await walletClient.getAddresses())[0];
      if (!account) {
        throw new Error('No wallet address found');
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
        ],
        account,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      let circleId: number | null = null;
      let circleAddress = '';

      try {
        const createdLogs = await publicClient.getLogs({
          address: TRUST_CIRCLE_FACTORY_ADDRESS as `0x${string}`,
          event: circleCreatedEvent,
          fromBlock: receipt.blockNumber,
          toBlock: receipt.blockNumber,
        });

        const matchedLog = createdLogs.find((entry) => entry.transactionHash === hash);
        if (matchedLog) {
          circleId = Number(matchedLog.args.circleId);
        }
      } catch {
        // fallback to scanning below
      }

      if (circleId !== null) {
        try {
          const resolvedAddress = (await publicClient.readContract({
            address: TRUST_CIRCLE_FACTORY_ADDRESS as `0x${string}`,
            abi: TRUST_CIRCLE_FACTORY_ABI,
            functionName: 'getCircle',
            args: [BigInt(circleId)],
          })) as string;

          if (resolvedAddress && resolvedAddress !== '0x0000000000000000000000000000000000000000') {
            circleAddress = resolvedAddress;
          }
        } catch {
          // fallback to scanning below
        }
      }

      if (!circleAddress) {
        let lastValidId: number | null = null;
        for (let i = 0; i < 1000; i += 1) {
          try {
            const address = (await publicClient.readContract({
              address: TRUST_CIRCLE_FACTORY_ADDRESS as `0x${string}`,
              abi: TRUST_CIRCLE_FACTORY_ABI,
              functionName: 'getCircle',
              args: [BigInt(i)],
            })) as string;

            if (address && address !== '0x0000000000000000000000000000000000000000') {
              lastValidId = i;
              circleAddress = address;
            } else {
              break;
            }
          } catch {
            break;
          }
        }

        circleId = lastValidId;
      }

      if (!circleAddress || circleId === null) {
        throw new Error('Circle created but could not resolve circle details.');
      }

      showToast('Circle created successfully.', 'success');
      window.localStorage.removeItem('trustcircle_home_cache');
      setNewCircleId(circleId);

      try {
        await api.saveCircleMetadata(
          circleAddress,
          values.name,
          `Created with ${values.memberCount} members`
        );

        const inviteResponse = await api.generateInviteCode(circleAddress, 720);
        setInviteLink(`/join/${inviteResponse.shortCode || circleId}`);
      } catch (apiError) {
        console.error('Failed to save circle metadata:', apiError);

        const localInviteCode = buildLocalInviteCode(circleAddress, circleId);
        saveLocalInvite(localInviteCode, circleAddress, circleId);
        setInviteLink(`/join/${localInviteCode}`);
      }
    } catch (error) {
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
            className="md:col-span-2"
          >
            <option value={0}>Random draw</option>
            <option value={1}>Manual organizer assignment</option>
          </Select>

          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" loading={loading} disabled={!canSubmit}>
              <SparklesIcon className="h-4 w-4" />
              Create Circle
            </Button>
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
        message={`This will deploy an onchain circle with ${values.memberCount} members and ${contributionAmount} USDC per cycle.`}
        confirmLabel="Deploy Circle"
        loading={loading}
      />
    </div>
  );
}
