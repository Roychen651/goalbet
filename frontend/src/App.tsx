import { useEffect, useRef, useState } from 'react';
import Lenis from 'lenis';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from './stores/authStore';
import { useGroupStore } from './stores/groupStore';
import { useCoinsStore } from './stores/coinsStore';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { HomePage } from './pages/HomePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { LockerRoomPage } from './pages/LockerRoomPage';
import { PageLoader } from './components/ui/LoadingSpinner';
import { ROUTES } from './lib/constants';
import { ReAuthModal } from './components/auth-v2/ReAuthModal';
import { AdminProtectedRoute } from './components/admin/AdminProtectedRoute';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { UserManagement } from './components/admin/UserManagement';
import { GroupManagement } from './components/admin/GroupManagement';

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
        {children}
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

// Returns today's date string in Israel timezone (e.g. "2026-03-20")
function getIsraelDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
}

function AppInitializer({ children }: { children: React.ReactNode }) {
  const { user, init } = useAuthStore();
  const { fetchGroups, activeGroupId } = useGroupStore();
  const initCoins = useCoinsStore(s => s.initCoins);
  const lastInitDateRef = useRef<string>('');

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

  useEffect(() => {
    if (user) {
      fetchGroups(user.id);
    }
  }, [user?.id]);

  // Init coins (+ claim daily bonus) whenever user or active group changes,
  // and re-check on tab focus in case the user crossed midnight without refreshing.
  useEffect(() => {
    if (!user || !activeGroupId) return;

    lastInitDateRef.current = getIsraelDate();
    initCoins(user.id, activeGroupId);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const today = getIsraelDate();
        if (today !== lastInitDateRef.current) {
          lastInitDateRef.current = today;
          initCoins(user.id, activeGroupId);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user?.id, activeGroupId]);

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInitializer>
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
      </AppInitializer>
    </BrowserRouter>
  );
}
