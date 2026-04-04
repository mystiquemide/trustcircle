import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout';
import { WalletGuard } from './components/wallet';
import { DarkModeProvider } from './providers/DarkModeProvider';
import { ToastProvider } from './providers/ToastProvider';
import { WalletProvider } from './providers/WalletProvider';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const Home = lazy(() => import('./pages/Home'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CreateCircle = lazy(() => import('./pages/CreateCircle'));
const JoinCircle = lazy(() => import('./pages/JoinCircle'));
const CircleDetail = lazy(() => import('./pages/CircleDetail'));
const NotFound = lazy(() => import('./pages/NotFound'));

const RouteLoadingFallback = () => (
  <div className="flex min-h-screen items-center justify-center px-4">
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
      Loading page...
    </div>
  </div>
);

function App() {
  return (
    <DarkModeProvider>
      <ToastProvider>
        <WalletProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />

                <Route element={<WalletGuard />}>
                  <Route element={<Layout />}>
                    <Route path="/home" element={<Home />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/create" element={<CreateCircle />} />
                    <Route path="/join/:inviteCode" element={<JoinCircle />} />
                    <Route path="/circle/:circleId" element={<CircleDetail />} />
                  </Route>
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </WalletProvider>
      </ToastProvider>
    </DarkModeProvider>
  );
}

export default App;
