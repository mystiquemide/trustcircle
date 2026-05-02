import {
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useState, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Logo } from '../components/common';
import { ConnectWalletButton } from '../components/wallet/ConnectWalletButton';
import { DarkModeToggle } from '../components/wallet/DarkModeToggle';
import { useWalletContext } from '../providers/WalletProvider';

const steps = [
  {
    title: 'Create a Circle',
    description: 'Set contribution amount, member cap, and contribution cadence in minutes.',
  },
  {
    title: 'Invite Trusted Members',
    description: 'Share invite links so friends can join your savings group in a few clicks.',
  },
  {
    title: 'Save Together',
    description: 'Each cycle is tracked onchain with transparent contributions and payout order.',
  },
];

const highlights = [
  {
    title: '24/7 Transparency',
    subtitle: 'Onchain activity ledger',
    description: 'Every contribution, payout, and membership action stays verifiable in real time.',
  },
  {
    title: 'USDC Savings Rail',
    subtitle: 'Stable-value coordination',
    description: 'Members save in USDC to avoid volatility while keeping trust rules enforceable.',
  },
  {
    title: 'Time-bound Cycles',
    subtitle: 'Automated cadence controls',
    description: 'Contribution windows and payout progression move with clear onchain deadlines.',
  },
];

const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How It Works' },
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isConnected, disconnect } = useWalletContext();
  const navigate = useNavigate();

  return (
    <div className="landing-bg relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="animate-glow-pulse absolute left-1/2 top-[-250px] h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="animate-float absolute right-[8%] top-[22%] h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="animate-float animate-stagger-2 absolute left-[6%] top-[68%] h-72 w-72 rounded-full bg-primary-400/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl dark:border-white/10 dark:bg-[#050b17]/85">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex">
            <Logo size="sm" showIcon={false} />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <DarkModeToggle />
            {isConnected ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => navigate('/home')}>Dashboard</Button>
                <Button size="sm" variant="secondary" onClick={disconnect}>Disconnect</Button>
              </>
            ) : (
              <ConnectWalletButton size="sm" redirectToHomeOnConnect />
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setMenuOpen((current) => !current)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <XMarkIcon className="h-5 w-5" /> : <Bars3Icon className="h-5 w-5" />}
          </Button>
        </div>

        {menuOpen ? (
          <div className="border-t border-slate-200/70 bg-white/95 px-4 py-3 dark:border-white/10 dark:bg-[#050b17]/95 md:hidden">
            <nav className="flex flex-col gap-1">
              {navLinks.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="mt-3 flex items-center gap-3">
              <DarkModeToggle />
              <div className="flex flex-1 gap-2">
                {isConnected ? (
                  <>
                    <Button size="sm" variant="ghost" fullWidth onClick={() => navigate('/home')}>Dashboard</Button>
                    <Button size="sm" variant="secondary" fullWidth onClick={disconnect}>Disconnect</Button>
                  </>
                ) : (
                  <ConnectWalletButton size="sm" fullWidth redirectToHomeOnConnect />
                )}
              </div>
            </div>
          </div>
        ) : null}
      </header>

      <main className="relative mx-auto w-full max-w-6xl px-4 pb-12 pt-16 sm:px-6 sm:pt-20 lg:px-8">
        <section className="mx-auto max-w-4xl text-center">
          <p
            className="landing-fade-up glow-border-pill inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary-200 sm:tracking-[0.2em]"
            style={{ '--landing-delay': '60ms' } as CSSProperties}
          >
            Arc Network Native Savings
          </p>

          <h1
            className="landing-fade-up mt-8 text-3xl font-extrabold leading-tight tracking-[-0.03em] text-slate-950 dark:text-white sm:text-5xl lg:text-7xl"
            style={{ '--landing-delay': '140ms' } as CSSProperties}
          >
            Save together. Build trust.
            <span className="mt-1 block text-primary-600 dark:text-primary-300">All onchain.</span>
          </h1>

          <p
            className="landing-fade-up mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-xl"
            style={{ '--landing-delay': '240ms' } as CSSProperties}
          >
            TrustCircle helps communities run transparent savings circles with programmable contribution rules,
            automatic payouts, and tamper-proof accountability.
          </p>

          <div
            className="landing-fade-up mt-10 flex items-center justify-center gap-2"
            style={{ '--landing-delay': '320ms' } as CSSProperties}
          >
            {isConnected ? (
              <>
                <Button size="lg" onClick={() => navigate('/home')}>Go to Dashboard</Button>
                <Button size="lg" variant="secondary" onClick={disconnect}>Disconnect</Button>
              </>
            ) : (
              <ConnectWalletButton size="lg" redirectToHomeOnConnect />
            )}
          </div>

          <p
            className="landing-fade-up mt-4 text-sm text-slate-500 dark:text-slate-400"
            style={{ '--landing-delay': '420ms' } as CSSProperties}
          >
            New to testnet?{' '}
            <a
              href="https://faucet.circle.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary-600 underline decoration-primary-500/70 underline-offset-2 transition hover:text-primary-700 dark:text-primary-300 dark:hover:text-primary-200"
            >
              Get free test USDC
            </a>
            .
          </p>
        </section>

        <section id="features" className="mt-10 grid gap-4 sm:mt-16 md:grid-cols-3">
          {highlights.map((highlight, index) => (
            <article
              key={highlight.title}
              className="landing-animated-card glass-card-landing rounded-2xl p-6 transition"
              style={{
                '--landing-delay': `${140 + index * 160}ms`,
              } as CSSProperties}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-200/80">{highlight.subtitle}</p>
              <h2 className="mt-2 text-xl font-bold leading-snug text-slate-950 dark:text-white">{highlight.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{highlight.description}</p>
            </article>
          ))}
        </section>

        <section id="how-it-works" className="mt-12 sm:mt-16 lg:mt-24">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <h2
              className="landing-fade-up text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl"
              style={{ '--landing-delay': '220ms' } as CSSProperties}
            >
              How TrustCircle Works
            </h2>
            <p
              className="landing-fade-up mt-3 text-sm text-slate-600 dark:text-slate-300 sm:text-base"
              style={{ '--landing-delay': '320ms' } as CSSProperties}
            >
              Three focused steps to launch and run a transparent savings circle with your community.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <article
                key={step.title}
                className="landing-animated-card glass-card-landing rounded-2xl p-6 transition"
                style={{
                  '--landing-delay': `${180 + index * 180}ms`,
                } as CSSProperties}
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-primary-400/40 bg-primary-500/10 text-xs font-semibold text-primary-700 dark:text-primary-100">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-xl font-bold text-slate-950 dark:text-white">{step.title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{step.description}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/70 bg-white/80 py-8 text-sm text-slate-500 dark:border-white/10 dark:bg-[#040913]/80 dark:text-slate-400">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center gap-3 px-4 text-center sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-4">
            <a href="#" className="py-2 transition hover:text-slate-900 dark:hover:text-slate-200">
              Terms & Conditions
            </a>
          </div>
          <p>Built on Arc Network</p>
          <p>&copy; 2026 TrustCircle. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
