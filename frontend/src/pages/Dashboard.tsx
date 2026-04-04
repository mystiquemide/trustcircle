import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPublicClient, custom } from 'viem';
import {
  BellIcon,
  ClockIcon,
  Cog8ToothIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { AddressDisplay, Button, Card, Modal } from '../components/common';
import { Input, Select } from '../components/forms';
import { useWalletContext } from '../providers/WalletProvider';
import { useToast } from '../providers/ToastProvider';
import { api } from '../lib/api';
import { arcTestnet } from '../lib/arcChain';
import { CONTRACT_ADDRESSES } from '../contracts/addresses';
import { REPUTATION_REGISTRY_ABI } from '../contracts/ReputationRegistry';

interface UserPreferences {
  email: string;
  enablePushNotifications: boolean;
  timezoneName: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  email: '',
  enablePushNotifications: true,
  timezoneName: 'UTC',
};

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Asia/Kolkata',
  'Asia/Tokyo',
];

const LOCAL_PREFERENCES_KEY_PREFIX = 'trustcircle_user_preferences_';

const getPreferencesStorageKey = (walletAddress: string) =>
  `${LOCAL_PREFERENCES_KEY_PREFIX}${walletAddress.toLowerCase()}`;

const normalizePreferences = (value?: Partial<UserPreferences> | null): UserPreferences => ({
  email: typeof value?.email === 'string' ? value.email : '',
  enablePushNotifications: value?.enablePushNotifications !== false,
  timezoneName:
    typeof value?.timezoneName === 'string' && TIMEZONES.includes(value.timezoneName)
      ? value.timezoneName
      : 'UTC',
});

const loadStoredPreferences = (walletAddress: string): UserPreferences | null => {
  try {
    const payload = window.localStorage.getItem(getPreferencesStorageKey(walletAddress));
    if (!payload) {
      return null;
    }

    return normalizePreferences(JSON.parse(payload) as Partial<UserPreferences>);
  } catch {
    return null;
  }
};

const saveStoredPreferences = (walletAddress: string, preferences: UserPreferences) => {
  try {
    window.localStorage.setItem(getPreferencesStorageKey(walletAddress), JSON.stringify(preferences));
  } catch (error) {
    console.warn('Failed to cache preferences locally:', error);
  }
};

export default function Dashboard() {
  const { address } = useWalletContext();
  const { showToast } = useToast();

  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reputationScore, setReputationScore] = useState<number | null>(null);
  const [loadingReputation, setLoadingReputation] = useState(true);

  useEffect(() => {
    if (!address) {
      setPreferences(DEFAULT_PREFERENCES);
      setLoadingPrefs(false);
      return;
    }

    let cancelled = false;

    const storedPreferences = loadStoredPreferences(address);
    if (storedPreferences) {
      setPreferences(storedPreferences);
      setLoadingPrefs(false);
    } else {
      setLoadingPrefs(true);
    }

    const loadPreferences = async () => {
      try {
        const response = await api.getUserPreferences(address);
        if (response && !cancelled) {
          const normalizedPreferences = normalizePreferences(response as Partial<UserPreferences>);
          setPreferences(normalizedPreferences);
          saveStoredPreferences(address, normalizedPreferences);
        }
      } catch (error) {
        console.log('No user preferences found yet:', error);
      } finally {
        if (!cancelled) {
          setLoadingPrefs(false);
        }
      }
    };

    void loadPreferences();

    return () => {
      cancelled = true;
    };
  }, [address]);

  useEffect(() => {
    if (!address) {
      setReputationScore(null);
      setLoadingReputation(false);
      return;
    }

    if (!window.ethereum) {
      setReputationScore(500);
      setLoadingReputation(false);
      return;
    }

    let cancelled = false;

    const loadReputation = async () => {
      setLoadingReputation(true);
      try {
        const publicClient = createPublicClient({
          transport: custom(window.ethereum as NonNullable<typeof window.ethereum>),
          chain: arcTestnet,
        });

        const score = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.ReputationRegistry,
          abi: REPUTATION_REGISTRY_ABI,
          functionName: 'getScore',
          args: [address as `0x${string}`],
        });

        if (!cancelled) {
          setReputationScore(Number(score));
        }
      } catch (error) {
        console.warn('Failed to load reputation score:', error);
        if (!cancelled) {
          setReputationScore(500);
        }
      } finally {
        if (!cancelled) {
          setLoadingReputation(false);
        }
      }
    };

    void loadReputation();

    return () => {
      cancelled = true;
    };
  }, [address]);

  const effectiveReputationScore = reputationScore ?? 500;
  const reputationProgress = Math.min(100, Math.max(0, (effectiveReputationScore / 1000) * 100));

  const profileCards = useMemo(
    () => [
      {
        title: 'Wallet Identity',
        value: address ? 'Connected' : 'Disconnected',
        icon: ShieldCheckIcon,
      },
      {
        title: 'Notification Mode',
        value: preferences.enablePushNotifications ? 'Push enabled' : 'Push disabled',
        icon: BellIcon,
      },
      {
        title: 'Timezone',
        value: preferences.timezoneName,
        icon: ClockIcon,
      },
    ],
    [address, preferences.enablePushNotifications, preferences.timezoneName]
  );

  const saveSettings = async () => {
    if (!address) {
      return;
    }

    setSavingPrefs(true);
    const nextPreferences = normalizePreferences(preferences);

    setPreferences(nextPreferences);
    saveStoredPreferences(address, nextPreferences);
    setSavingPrefs(false);
    setSettingsOpen(false);
    showToast('Settings saved.', 'success');

    void api
      .saveUserPreferences(
        address,
        nextPreferences.email || undefined,
        nextPreferences.enablePushNotifications,
        nextPreferences.timezoneName
      )
      .catch((error) => {
        console.warn('Failed to sync preferences to backend:', error);
      });
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="section-title">Dashboard</h1>
          <p className="section-subtitle">Manage account settings, preferences, and trust profile.</p>
        </div>
        <Button variant="outline" onClick={() => setSettingsOpen(true)}>
          <Cog8ToothIcon className="h-4 w-4" />
          Open Settings
        </Button>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {profileCards.map((item) => (
          <Card key={item.title} title={item.title}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-900/60 dark:text-primary-200">
                <item.icon className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold text-[color:var(--text-primary)]">{item.value}</p>
            </div>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card title="Profile" subtitle="Address and identity used for your circles.">
          {address ? (
            <div className="space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted">Wallet Address</p>
                <AddressDisplay address={address} truncate={false} className="mt-1" />
              </div>
              <p className="text-sm text-muted">
                Keep this wallet secure. Your circle memberships and reputation are tied to this address.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">No wallet connected.</p>
          )}
        </Card>

        <Card title="Reputation" subtitle="Onchain trust profile from ReputationRegistry.">
          <div className="space-y-3">
            {loadingReputation ? (
              <p className="text-sm text-muted">Loading score...</p>
            ) : (
              <>
                <p className="text-4xl font-extrabold text-primary-600 dark:text-primary-300">
                  {effectiveReputationScore}
                </p>
                {effectiveReputationScore === 500 ? (
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    Baseline - New member
                  </p>
                ) : null}
                <div className="space-y-1">
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-500"
                      style={{ width: `${reputationProgress}%` } as CSSProperties}
                    />
                  </div>
                  <p className="text-xs text-muted">{effectiveReputationScore} / 1,000</p>
                </div>
                <p className="text-sm text-muted">Score range: 0-1,000. Maintained by ReputationRegistry.</p>
              </>
            )}
          </div>
        </Card>
      </section>

      <Modal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Settings"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveSettings} loading={savingPrefs}>
              Save Preferences
            </Button>
          </div>
        }
      >
        {loadingPrefs ? (
          <p className="text-sm text-muted">Loading preferences...</p>
        ) : (
          <div className="space-y-4">
            <Input
              label="Email (optional)"
              type="email"
              value={preferences.email}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              helperText="Used for contribution reminders."
            />

            <Select
              label="Timezone"
              value={preferences.timezoneName}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  timezoneName: event.target.value,
                }))
              }
            >
              {TIMEZONES.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>

            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">Push Notifications</p>
                  <p className="text-xs text-muted">Notify me before contribution deadlines.</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPreferences((current) => ({
                      ...current,
                      enablePushNotifications: !current.enablePushNotifications,
                    }))
                  }
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                    preferences.enablePushNotifications
                      ? 'bg-primary-600 dark:bg-primary-500'
                      : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      preferences.enablePushNotifications ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
