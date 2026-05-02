import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowTopRightOnSquareIcon,
  ChartBarIcon,
  PlusIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { Card, Button, StatusBadge } from '../components/common';
import { LoadingSkeleton, EmptyState } from '../components/feedback';
import { Input } from '../components/forms';
import { fetchUserCircles, fetchPublicCircles, type CircleInfo } from '../lib/circle';
import { formatTimeLeft, formatUsd } from '../lib/format';
import { useWalletContext } from '../providers/WalletProvider';
import { useToast } from '../providers/ToastProvider';

const CACHE_KEY = 'trustcircle_home_cache';
const CACHE_EXPIRY_MS = 5 * 60 * 1000;

interface CachePayload {
  timestamp: number;
  circles: CircleInfo[];
}

const loadCachedCircles = (): CircleInfo[] | null => {
  try {
    const payload = window.localStorage.getItem(CACHE_KEY);
    if (!payload) {
      return null;
    }

    const parsed = JSON.parse(payload) as CachePayload;
    const age = Date.now() - parsed.timestamp;
    if (age > CACHE_EXPIRY_MS) {
      window.localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed.circles;
  } catch {
    return null;
  }
};

const saveCachedCircles = (circles: CircleInfo[]) => {
  try {
    const payload: CachePayload = {
      timestamp: Date.now(),
      circles,
    };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // no-op
  }
};

export default function Home() {
  const navigate = useNavigate();
  const { address } = useWalletContext();
  const { showToast } = useToast();

  const [circles, setCircles] = useState<CircleInfo[]>([]);
  const [publicCircles, setPublicCircles] = useState<CircleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPublic, setLoadingPublic] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'my' | 'public'>('my');
  const [error, setError] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  // Load public circles independently — no wallet needed
  useEffect(() => {
    if (activeTab !== 'public') {
      setLoadingPublic(false);
      return;
    }

    const loadPublicCircles = async () => {
      setLoadingPublic(true);
      try {
        const allCircles = await fetchPublicCircles();
        setPublicCircles(allCircles);
      } catch (e) {
        console.error('Failed to load public circles:', e);
      } finally {
        setLoadingPublic(false);
      }
    };

    void loadPublicCircles();
  }, [activeTab]);

  // Load user's circles only when wallet is connected
  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    const cached = loadCachedCircles();
    if (cached) {
      setCircles(cached);
      setLoading(false);
    }

    const loadCircles = async (background = false) => {
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');

      try {
        const nextCircles = await fetchUserCircles(address as `0x${string}`);
        setCircles(nextCircles);
        saveCachedCircles(nextCircles);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load circles.';
        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

    void loadCircles(Boolean(cached));
  }, [address]);

  const stats = useMemo(() => {
    const totalCircles = circles.length;
    const activeCircles = circles.filter((circle) => circle.status === 'Active').length;
    const committed = circles.reduce((sum, circle) => sum + circle.contributionAmount, 0);

    return { totalCircles, activeCircles, committed };
  }, [circles]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Refresh both user circles and public circles
      const publicPromise = fetchPublicCircles().then((all) => setPublicCircles(all)).catch(() => {});

      if (address) {
        const nextCircles = await fetchUserCircles(address as `0x${string}`);
        setCircles(nextCircles);
        saveCachedCircles(nextCircles);
      }

      await publicPromise;
      showToast('Circles refreshed.', 'success');
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : 'Refresh failed.';
      showToast(message, 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleQuickJoin = () => {
    const normalizedCode = inviteCode.trim();
    if (!normalizedCode) {
      showToast('Enter an invite code first.', 'warning');
      return;
    }

    navigate(`/join/${normalizedCode}`);
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="section-title">Circle Home</h1>
          <p className="section-subtitle">Track savings circles, deadlines, and payout progress.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} loading={refreshing}>
            Refresh
          </Button>
          <Button onClick={() => navigate('/create')}>
            <PlusIcon className="h-4 w-4" />
            Create Circle
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="My Circles" subtitle="Circles you created or joined">
          <p className="text-3xl font-extrabold text-[color:var(--text-primary)]">{stats.totalCircles}</p>
          <p className="mt-1 text-xs text-muted">{publicCircles.length} total on network</p>
        </Card>
        <Card title="Active Circles" subtitle="Currently collecting contributions">
          <p className="text-3xl font-extrabold text-[color:var(--text-primary)]">{stats.activeCircles}</p>
        </Card>
        <Card title="Per-cycle Commitment" subtitle="Sum of your contributions">
          <p className="text-3xl font-extrabold text-[color:var(--text-primary)]">{formatUsd(stats.committed)}</p>
        </Card>
        <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer" className="block h-full">
          <Card title="Get Test USDC" subtitle="Fund your wallet on Arc testnet" className="h-full">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted">Need balance to join or contribute.</p>
              <ArrowTopRightOnSquareIcon className="h-5 w-5 shrink-0 text-primary-500" />
            </div>
          </Card>
        </a>
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card
          title={
            <div className="flex gap-2">
              <button onClick={() => setActiveTab('my')} className={`px-2 ${activeTab === 'my' ? 'font-bold' : 'text-muted'}`}>My Circles</button>
              <button onClick={() => setActiveTab('public')} className={`px-2 ${activeTab === 'public' ? 'font-bold' : 'text-muted'}`}>Public Circles</button>
            </div>
          }
          subtitle={activeTab === 'my' ? "Select any circle to view contribution status and payout order." : "Browse all circles on the network. Join any Pending circle directly."}
        >
          {loading || (activeTab === 'public' && loadingPublic) ? (
            <div className="grid gap-3 md:grid-cols-2">
              <LoadingSkeleton variant="card" count={4} className="h-36" />
            </div>
          ) : (activeTab === 'my' ? circles : publicCircles).length === 0 ? (
            <EmptyState
              icon={ChartBarIcon}
              title={activeTab === 'my' ? "No circles yet" : "No public circles"}
              description={activeTab === 'my' ? "Create your first savings circle or join an invite code from a trusted organizer." : "Check back later or create a public circle to start one!"}
              actionLabel="Create Circle"
              onAction={() => navigate('/create')}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(activeTab === 'my' ? circles : publicCircles).map((circle) => {
                const now = Math.floor(Date.now() / 1000);
                const deadline = circle.cycleStart + circle.cycleDuration;

                const timelineLabel = circle.status === 'Active' ? 'Deadline' : 'Status';
                const timelineValue =
                  circle.status === 'Pending'
                    ? 'Awaiting members'
                    : circle.status === 'Resolved' || circle.status === 'Dissolved'
                      ? 'Complete'
                      : circle.status === 'Paused'
                        ? 'Paused'
                        : formatTimeLeft(deadline - now);

                const timelineValueClass =
                  circle.status === 'Active'
                    ? 'font-semibold text-primary-600 dark:text-primary-300'
                    : 'font-semibold text-[color:var(--text-primary)]';

                return (
                  <div
                    key={circle.id}
                    onClick={() =>
                      activeTab === 'public'
                        ? navigate(`/join/${circle.address}`)
                        : navigate(`/circle/${circle.routeTarget ?? circle.id}`)
                    }
                    className="cursor-pointer rounded-xl border bg-app-secondary p-4 text-left transition hover:border-primary-300 hover:shadow-card"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-[color:var(--text-primary)]">{circle.name}</h3>
                      <StatusBadge status={circle.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted">{circle.memberCount} members</p>
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="text-secondary">Contribution</span>
                      <span className="font-semibold text-[color:var(--text-primary)]">
                        {formatUsd(circle.contributionAmount)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-sm">
                      <span className="text-secondary">{timelineLabel}</span>
                      <span className={timelineValueClass}>{timelineValue}</span>
                    </div>
                    {activeTab === 'public' && circle.status === 'Pending' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/join/${circle.address}`);
                        }}
                        className="mt-3 w-full rounded-lg bg-primary-600 px-3 py-2 text-center text-sm font-semibold text-white transition hover:bg-primary-700"
                      >
                        Join Circle
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {error ? (
            <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
              {error}
            </p>
          ) : null}
        </Card>

        <Card title="Quick Join" subtitle="Paste an invite code to join a circle in one step.">
          <div className="space-y-3">
            <Input
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="e.g. ABC12345 or 0"
            />
            <Button fullWidth onClick={handleQuickJoin}>
              <UserGroupIcon className="h-4 w-4" />
              Join Circle
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
