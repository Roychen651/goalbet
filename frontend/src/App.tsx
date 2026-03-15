import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuthStore } from './stores/authStore';
import { useGroupStore } from './stores/groupStore';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { HomePage } from './pages/HomePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { PageLoader } from './components/ui/LoadingSpinner';
import { ROUTES } from './lib/constants';

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
  const { user, loading, initialized } = useAuthStore();

  if (!initialized || loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return <>{children}</>;
}

function AppInitializer({ children }: { children: React.ReactNode }) {
  const { user, init } = useAuthStore();
  const { fetchGroups } = useGroupStore();

  useEffect(() => {
    const cleanup = init();
    return cleanup;
  }, []);

  useEffect(() => {
    if (user) {
      fetchGroups(user.id);
    }
  }, [user?.id]);

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
            <Route path="profile" element={<AnimatedOutlet><ProfilePage /></AnimatedOutlet>} />
            <Route path="settings" element={<AnimatedOutlet><SettingsPage /></AnimatedOutlet>} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
        </Routes>
      </AppInitializer>
    </BrowserRouter>
  );
}
