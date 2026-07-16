import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import Lenis from 'lenis';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';
import { supabase } from './lib/supabase';
import { useAuthStore } from './stores/authStore';
import { useGroupStore } from './stores/groupStore';
import { useCoinsStore } from './stores/coinsStore';
import { unlockAudio } from './lib/sensoryAudio';
import { AppShell } from './components/layout/AppShell';
import { RealtimeProvider } from './components/providers/RealtimeProvider';
import { LoginPage } from './pages/LoginPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { HomePage } from './pages/HomePage';
import { PageLoader } from './components/ui/LoadingSpinner';
import { ROUTES } from './lib/constants';
import { ReAuthModal } from './components/auth-v2/ReAuthModal';
import { AdminProtectedRoute } from './components/admin/AdminProtectedRoute';
import { AdminLayout } from './components/admin/AdminLayout';

// ── Lazy routes (code-split; off the first-paint critical path) ──────────────
// HomePage + Login/AuthCallback stay eager (the critical path). Everything below
// loads on demand; the Suspense fallback renders inside AnimatedOutlet (app) or
// AdminLayout (admin), so the shell/nav never blanks.
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage').then(m => ({ default: m.LeaderboardPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const LockerRoomPage = lazy(() => import('./pages/LockerRoomPage').then(m => ({ default: m.LockerRoomPage })));
const StatsPage = lazy(() => import('./pages/StatsPage').then(m => ({ default: m.StatsPage })));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const UserManagement = lazy(() => import('./components/admin/UserManagement').then(m => ({ default: m.UserManagement })));
const GroupManagement = lazy(() => import('./components/admin/GroupManagement').then(m => ({ default: m.GroupManagement })));

const pageVariants = {
  initial: { opacity: 0, y: 12, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring' as const, stiffness: 100, damping: 20 } },
  exit: { opacity: 0, y: -8, scale: 0.99, transition: { duration: 0.15 } },
};

function AnimatedOutlet({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ height: '100%' }}
      >
        {/* Suspense sits INSIDE the animated container, so a lazy chunk load
            shows the fallback while the route transition still plays seamlessly. */}
        <Suspense fallback={<PageLoader />}>{children}</Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, initialized, signOut } = useAuthStore();
  const navigate = useNavigate();
  const hadUser = useRef(false);
  const [showReAuth, setShowReAuth] = useState(false);

  // Track whether user was ever authenticated in this session
  useEffect(() => {
    if (user) {
      hadUser.current = true;
      setShowReAuth(false); // dismiss modal if user re-authenticates
    }
  }, [user]);

  // Detect unexpected session expiry (was logged in → now logged out)
  useEffect(() => {
    if (initialized && !loading && !user && hadUser.current) {
      setShowReAuth(true);
    }
  }, [user, initialized, loading]);

  if (!initialized || loading) return <PageLoader />;

  // Session expired while in-app → show re-auth overlay instead of hard redirect
  if (!user && showReAuth) {
    return (
      <ReAuthModal
        onSuccess={() => setShowReAuth(false)}
        onSignOut={() => {
          hadUser.current = false;
          setShowReAuth(false);
          signOut().finally(() => navigate(ROUTES.LOGIN, { replace: true }));
        }}
      />
    );
  }

  if (!user) return <Navigate to={ROUTES.LOGIN} replace />;

  return <>{children}</>;
}

function AppInitializer({ children }: { children: React.ReactNode }) {
  const { user, init } = useAuthStore();
  const { fetchGroups, activeGroupId } = useGroupStore();
  const initCoins = useCoinsStore(s => s.initCoins);

  // Lenis smooth scrolling — exponential easing for premium liquid feel
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      touchMultiplier: 2,
    });
    let rafId: number;
    function frame(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);
    return () => { lenis.destroy(); cancelAnimationFrame(rafId); };
  }, []);

  useEffect(() => {
    const cleanup = init();
    return cleanup;
  }, []);

  // Sprint 17 — unlock the synthesized-SFX AudioContext on the very first
  // tap anywhere in the app (autoplay policies require a real user gesture;
  // see lib/sensoryAudio.ts). Fires once, on this listener alone, then
  // removes itself — every later playSound() call reuses the same context.
  useEffect(() => {
    const onFirstGesture = () => {
      unlockAudio();
      window.removeEventListener('pointerdown', onFirstGesture);
    };
    window.addEventListener('pointerdown', onFirstGesture, { passive: true });
    return () => window.removeEventListener('pointerdown', onFirstGesture);
  }, []);

  useEffect(() => {
    if (user) {
      fetchGroups(user.id);
    }
  }, [user?.id]);

  // Init coins whenever user or active group changes. The daily bonus is no
  // longer claimed here — it's deposited proactively by the pg_cron
  // distribute_daily_allowance() sweep (V4 Sprint 12); RealtimeProvider's
  // Group Channel (V5 Sprint 35) is what picks up a midnight deposit live,
  // so there's no midnight-crossing recheck to do on this end anymore.
  useEffect(() => {
    if (!user || !activeGroupId) return;
    initCoins(user.id, activeGroupId);

    // Best-effort activity heartbeat for the 3-day inactivity cap on the daily
    // bonus — never blocks the UI, failure is silently ignored.
    supabase.rpc('touch_last_active').then(({ error }) => {
      if (error) console.warn('[AppInitializer] touch_last_active failed:', error.message);
    });
  }, [user?.id, activeGroupId]);

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppInitializer>
        {/* V5 Sprint 35 — mounted once, inside AppInitializer (so `user`
            has already started resolving) and above every route that
            calls useRealtimeSubscription(). Owns the Group Channel;
            individual pages/hooks never touch supabase.channel() directly
            for group-scoped tables anymore. */}
        <RealtimeProvider>
          <Routes>
            {/* Public routes */}
            <Route path={ROUTES.LOGIN} element={<LoginPage />} />
            <Route path={ROUTES.AUTH_CALLBACK} element={<AuthCallbackPage />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <AuthGuard>
                  <AppShell />
                </AuthGuard>
              }
            >
              <Route index element={<AnimatedOutlet><HomePage /></AnimatedOutlet>} />
              <Route path="leaderboard" element={<AnimatedOutlet><LeaderboardPage /></AnimatedOutlet>} />
              <Route path="locker-room" element={<AnimatedOutlet><LockerRoomPage /></AnimatedOutlet>} />
              <Route path="stats" element={<AnimatedOutlet><StatsPage /></AnimatedOutlet>} />
              <Route path="profile" element={<AnimatedOutlet><ProfilePage /></AnimatedOutlet>} />
              <Route path="settings" element={<AnimatedOutlet><SettingsPage /></AnimatedOutlet>} />
            </Route>

            {/* Admin console */}
            <Route
              path="/admin"
              element={
                <AdminProtectedRoute>
                  <AdminLayout />
                </AdminProtectedRoute>
              }
            >
              <Route index element={<AdminDashboardPage />} />
              <Route path="users"  element={<UserManagement />} />
              <Route path="groups" element={<GroupManagement />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
          </Routes>
        </RealtimeProvider>
        </AppInitializer>
      </BrowserRouter>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
